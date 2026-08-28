# ADR-002: Arquitetura do Worker de Polling Desacoplado

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Larissa (Tech Lead), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos), Marcos (Product Manager)

---

## Contexto e Declaração do Problema

Com a escolha do Transactional Outbox Pattern (ADR-001), os eventos de mudança de status de pedidos são gravados na tabela `webhook_outbox` com o status `PENDING`. Faz-se necessário definir o mecanismo de leitura e envio das requisições HTTP para os endpoints dos clientes B2B.

As principais restrições identificadas na reunião técnica foram:
1. Requisito de Latência: Qualquer tempo de entrega abaixo de 10 segundos é considerado "tempo real" aceitável pelos clientes B2B [`TRANSCRICAO.md:20-22`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L20-L22).
2. Isolamento de Processos: O processamento das notificações não pode rodar no mesmo processo da API HTTP Express (ponto focal de tráfego de usuários), sob risco de concorrência por Event Loop ou falhas de reinicialização da API derrubarem a execução de despachos pendentes [`TRANSCRICAO.md:70-76`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L70-L76).

---

## Drivers de Decisão

* **Isolamento de Falha:** Reinicializações da API HTTP não devem paralisar ou corromper a execução de notificações pendentes.
* **Previsibilidade de Latência:** Garantir o processamento contínuo com latência máxima menor que 10 segundos.
* **Simplicidade de Execução:** Execução autônoma que compartilhe o mesmo repositório TypeScript, conexão Prisma e banco de dados MySQL sem demandar brokers ou listeners externos.

---

## Decisão Considerada e Escolhida

Decidiu-se criar um **Worker em Processo Autônomo e Desacoplado** (`src/worker.ts`), executando um loop de **polling contínuo a cada 2 segundos** [`TRANSCRICAO.md:58-76`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L58-L76).

### Detalhes de Funcionamento:
1. **Entry Point Dedicado:** O arquivo `src/worker.ts` funcionará como ponto de entrada independente da aplicação, disparado via script `npm run worker` [`TRANSCRICAO.md:72`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L72).
2. **Processamento em Batches:** A cada 2 segundos, o worker consulta a tabela `webhook_outbox` buscando registros onde `status = 'PENDING'` ou (`status = 'FAILED'` AND `nextAttemptAt <= NOW()`), ordenados por `createdAt ASC` [`TRANSCRICAO.md:56`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L56).
3. **Mecanismo de Lock:** Durante o processamento de um lote, os registros têm seu status transicionado para `PROCESSING` para evitar processamento duplicado pela mesma instância.
4. **Ordering Garantido por Order ID:** Como haverá uma única instância do worker rodando por padrão (Single-Worker), a ordem sequencial de disparos para um mesmo pedido (`order_id`) é garantida por ordem de criação (`createdAt`) [`TRANSCRICAO.md:78-86`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L78-L86).

---

## Alternativas Consideradas

### 1. Database Triggers no MySQL
* **Descrição:** Utilizar triggers no MySQL para disparar requisições ou notificar o worker imediatamente no momento da alteração de status.
* **Motivo do Descarte:** Descartado [`TRANSCRICAO.md:62-65`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L62-L65). O MySQL não possui suporte nativo a mecanismo tipo `LISTEN/NOTIFY` (como no PostgreSQL). Triggers no MySQL executam apenas comandos SQL e não conseguem notificar processos externos sem recorrer a improvisos não confiáveis (ex: gravação em arquivos ou chamadas de scripts do sistema operacional).

### 2. Processamento In-Process (Dentro da API Express)
* **Descrição:** Agendar `setInterval` ou listeners de eventos dentro do arquivo [`src/app.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/app.ts) ou [`src/server.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/server.ts).
* **Motivo do Descarte:** Descartado [`TRANSCRICAO.md:70-76`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L70-L76). Se a API reiniciasse ou sofresse auto-scale/deploys, o loop do worker seria interrompido ou instanciado em duplicidade sem controle granular de concorrência.

---

## Consequências

### Positivas
* **Cumprimento do SLA de Latência:** O intervalo de 2 segundos garante que o tempo total entre a transação e o envio HTTP fique bem abaixo do teto de 10 segundos [`TRANSCRICAO.md:64-68`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L64-L68).
* **Resiliência e Isolamento:** Falhas ou reinicializações na API HTTP Express (`src/server.ts`) não afetam o envio de webhooks pelo worker (`src/worker.ts`).
* **Reuso de Código:** O worker reutiliza o mesmo Prisma Client, modelos Zod e utilitários da pasta `src/shared/`.

### Negativas / Trade-offs
* **Garantia de Ordering Limitada a Single-Worker:** Caso a infraestrutura venha a escalar para múltiplos workers concorrentes no futuro, a ordenação estrita por `order_id` exigirá locks pessimistas no banco ou particionamento de eventos [`TRANSCRICAO.md:80-86`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L80-L86).

---

## Referências ao Código Base

* [`src/server.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/server.ts): Ponto de entrada da API Web Express (sirve de referência para criação de `src/worker.ts`).
* [`src/app.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/app.ts#L22-L53): Padrão de injeção de dependências do PrismaClient que será replicado no worker.
