# PRD-001: Sistema de Webhooks para Notificação de Pedidos em Tempo Real

## 1. Resumo e Contexto da Feature

O **Sistema de Webhooks Outbound de Notificação de Pedidos** é uma capacidade estratégica da plataforma OMS (Order Management System). Sua finalidade é notificar proativamente e em tempo quase-real (< 10 segundos) sistemas externos de parceiros B2B (como ERPs, WMSs e plataformas logísticas) sempre que houver uma transição no ciclo de vida de um pedido (representada pelas alterações no enum `OrderStatus`: `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).

Atualmente, clientes B2B estratégicos como **Atlas Comercial**, **MaxDistribuição** e **Nova Cargo** operam no modelo de *polling* agressivo [`TRANSCRICAO.md:18-19`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L18-L19). Esta funcionalidade substitui esse modelo por uma arquitetura guiada a eventos baseada no **Transactional Outbox Pattern**, permitindo que atualizações de pedidos sejam transmitidas via requisições HTTP `POST` seguras, assinadas criptograficamente e resilientes a falhas.

---

## 2. Problema e Motivação

### Dores Atuais do Negócio
* **Carga Ineficiente na Infraestrutura:** Clientes B2B efetuam requisições repetitivas no endpoint `GET /api/v1/orders` para verificar se o status de seus pedidos mudou. Isso gera desperdício de CPU, alto tráfego de rede e consumo desnecessário de conexões no banco de dados MySQL.
* **Gargalo Logístico e Operacional:** O atraso inerente às consultas por polling impede que sistemas parceiros de armazém (WMS) e transportadoras iniciem a separação, faturamento e expedição de pedidos imediatamente após a confirmação de pagamento (`PAID`).
* **Risco de Churn de Clientes B2B:** Clientes de grande porte como a Atlas Comercial indicaram a necessidade de notificações em tempo real como requisito essencial para a continuidade do contrato [`TRANSCRICAO.md:18`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L18).

---

## 3. Público-Alvo e Cenários de Uso

### Personas

1. **Engenheiro de Integração B2B (Cliente Externo):**
   - *Necessidade:* Configurar endpoints HTTPS seguros para receber notificações automáticas de mudança de status e consumir payloads previsíveis assinados via HMAC.
2. **Operador Logístico / Parceiro de Transporte:**
   - *Necessidade:* Receber notificações instantâneas quando pedidos transicionam para `PAID` (para iniciar separação em estoque) e `SHIPPED` (para iniciar o rastreamento do envio).
3. **Administrador do OMS (Equipe Interna):**
   - *Necessidade:* Gerenciar cadastros de webhooks, acompanhar histórico de entregas, investigar falhas de envio e reprocessar mensagens mortas (DLQ).

### Cenários de Uso Principais

* **Cenário A — Separação Automática no WMS:** Assim que o pedido passa para o status `PAID`, o OMS notifica o WMS do cliente B2B via webhook. O WMS recebe a notificação em < 2 segundos e agenda automaticamente a colheita do produto no estoque.
* **Cenário B — Rastreamento e Logística de Expedição:** Quando o pedido é marcado como `SHIPPED`, o webhook dispara uma notificação contendo os dados do pedido para a plataforma da transportadora parceira.
* **Cenário C — Ajuste Fiscais e Cancelamentos:** Quando um pedido é transicionado para `CANCELLED`, o webhook avisa o sistema ERP do cliente B2B para estornar a reserva de limite financeiro e efetuar o cancelamento da nota fiscal.

---

## 4. Objetivos e Métricas de Sucesso

### Metas Quantitativas

* **PRD-MET-01 (Métrica Primária 1 — Latência de Entrega):** 99% dos eventos de webhook entregues no endpoint de destino em menos de **10 segundos** a partir do momento em que a transação de mudança de status é confirmada no OMS [`TRANSCRICAO.md:20-22`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L20-L22).
* **PRD-MET-02 (Métrica Primária 2 — Redução de Polling):** Reduzir em pelo menos **80%** o volume de requisições `GET /api/v1/orders` com propósito de polling originadas por parceiros B2B integrados em até 60 dias pós-lançamento.
* **PRD-MET-03 (Métrica Secundária — Taxa de Sucesso de Primeira Tentativa):** Atingir **99.5%** de entregas bem-sucedidas (HTTP 2xx) na primeira tentativa ou durante a janela de retentativas automáticas antes do encaminhamento para a Dead Letter Queue (DLQ).

---

## 5. Escopo da Feature

### 5.1. Em Escopo (Fase 1)

* **Gestão de Webhooks via API REST:** Endpoints para criar, listar, atualizar, desativar e excluir cadastros de webhooks por cliente B2B.
* **Filtro Seletivo por Eventos:** Inscrição granular informando quais status do enum `OrderStatus` o webhook deseja escutar.
* **Segurança e Rotação de Segredos:** Geração automática de chaves HMAC e suporte a rotação com *grace period* de 24 horas (`secretExpiresAt`).
* **Transactional Outbox:** Garantia de persistência atômica da alteração do pedido e do evento na tabela `webhook_outbox` dentro da mesma transação SQL.
* **Worker Autônomo:** Processo de execução independente (`src/worker.ts`) consumindo a outbox via *polling* a cada 2 segundos.
* **Resiliência e Retries:** Política de 5 retentativas com backoff exponencial (1m, 5m, 30m, 2h, 12h; janela de ~15h).
* **Dead Letter Queue (DLQ) & Replay:** Segregação de eventos falhos na tabela `webhook_dead_letters` e endpoint de reprocessamento manual restrito a administradores (`role: ADMIN`).
* **Auditoria e Histórico:** Endpoint para consulta dos logs de despacho e respostas HTTP das tentativas de envio.

### 5.2. Fora de Escopo (Explicitamente Adiado / Descartado)

* **Notificação de Falha por E-mail ao Cliente:** Alertas automáticos por e-mail após a exaustão de tentativas foram adiados para a Fase 2 [`TRANSCRICAO.md:218-223`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L218-L223).
* **Rate Limiting de Saída por Cliente:** Mecanismos de throttling ativo no worker foram mantidos em aberto para avaliação baseada no tráfego real em produção [`TRANSCRICAO.md:224-230`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L224-L230).
* **Interface Visual (Dashboard Frontend):** O desenvolvimento de uma UI no painel web foi delegado para a equipe de produto/frontend; a API expõe apenas contratos REST [`TRANSCRICAO.md:232-237`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L232-L237).
* **Brokers / Protocolos Não-HTTP:** Implementação de mensageria via Redis, RabbitMQ, Kafka ou protocolos WebSockets/gRPC foi desconsiderada para evitar complexidade operacional (*overengineering*) [`TRANSCRICAO.md:50-52`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L50-L52).

---

## 6. Requisitos Funcionais

* **PRD-FR-01 (Cadastro de Webhook):** O sistema deve disponibilizar o endpoint `POST /api/v1/webhooks` para registrar um novo webhook. O cliente deve fornecer a URL de destino (obrigatório protocolo HTTPS) e a lista de status (`OrderStatus`) a escutar. O sistema deve gerar e retornar uma secret criptográfica (`whsec_*`).
* **PRD-FR-02 (Gestão de Assinaturas):** O sistema deve permitir consultar (`GET /api/v1/webhooks`), atualizar a URL e lista de eventos (`PATCH /api/v1/webhooks/:id`) e desativar/excluir (`DELETE /api/v1/webhooks/:id`) assinaturas existentes.
* **PRD-FR-03 (Filtragem Seletiva de Eventos):** O enfileiramento de um evento na tabela `webhook_outbox` deve ocorrer exclusivamente se houver pelo menos uma assinatura ativa do cliente que contenha o novo status (`toStatus`) do pedido na sua lista de eventos.
* **PRD-FR-04 (Rotação de Segredos sem Downtime):** O sistema deve disponibilizar o endpoint `POST /api/v1/webhooks/:id/rotate-secret`. Ao ser acionado, o sistema deve gerar uma nova chave, mover a chave atual para `previousSecret` e manter a chave antiga válida por 24 horas (`secretExpiresAt`) para que o cliente atualize seus servidores sem interrupção de serviço.
* **PRD-FR-05 (Enfileiramento Atômico de Eventos):** O registro do evento na outbox deve ocorrer atomicamente na mesma transação SQL (`prisma.$transaction`) do método `OrderService.changeStatus`. Caso a alteração do pedido falhe ou sofra rollback, a gravação do webhook deve ser abortada.
* **PRD-FR-06 (Entrega Assíncrona com Assinatura HMAC):** O worker deve ler registros pendentes da outbox, assinar o corpo da mensagem JSON com a secret do webhook via HMAC-SHA256 e enviá-lo no cabeçalho `X-Signature`.
* **PRD-FR-07 (Resiliência e Retentativas Automáticas):** Em caso de falha de conexão ou resposta HTTP diferente de 2xx, o sistema deve reagendar a entrega para até 5 tentativas utilizando progressão exponencial (1m, 5m, 30m, 2h, 12h).
* **PRD-FR-08 (Isolamento em Dead Letter Queue):** Registros que esgotarem as 5 tentativas de retentativa sem sucesso devem ser removidos da fila ativa e salvos na tabela `webhook_dead_letters` contendo o payload original e o motivo da falha.
* **PRD-FR-09 (Reprocessamento Manual de DLQ):** O sistema deve disponibilizar o endpoint `POST /api/v1/admin/webhooks/dead-letter/:id/replay`, restrito a usuários com privilégios de administrador (`role: ADMIN`), para re-enfileirar mensagens da DLQ na outbox.
* **PRD-FR-10 (Consulta de Histórico de Entregas):** O sistema deve fornecer o endpoint `GET /api/v1/webhooks/:id/deliveries` permitindo aos clientes consultar as últimas tentativas de entrega efetuadas, incluindo timestamp, código HTTP de resposta e mensagem de erro, se houver.

---

## 7. Requisitos Não Funcionais

* **PRD-NFR-01 (Segurança de Transporte):** URLs de destino cadastradas em assinaturas de webhook devem utilizar estritamente o protocolo `https://`. Requisições para cadastrar URLs `http://` devem ser rejeitadas com erro de validação (`WEBHOOK_INVALID_URL`).
* **PRD-NFR-02 (Integridade Criptográfica):** Todas as notificações enviadas pelo worker devem incluir a assinatura HMAC-SHA256 no cabeçalho `X-Signature`.
* **PRD-NFR-03 (Desempenho e Latência):** O worker de envio deve rodar em processo isolado em um loop de *polling* com intervalo fixo de 2 segundos, garantindo a entrega em menos de 10 segundos para 99% das notificações sob carga nominal.
* **PRD-NFR-04 (Tamanho de Payload Limitado):** O payload da notificação deve ser montado como um snapshot enxuto contendo apenas os atributos essenciais do pedido (sem a lista detalhada de itens), respeitando o tamanho máximo de **64 KB**.
* **PRD-NFR-05 (Timeouts de Rede Estritos):** O cliente HTTP do worker deve aplicar um timeout estrito de **10 segundos** por chamada. Endpoints que não responderem nesse intervalo devem ser considerados falhos.
* **PRD-NFR-06 (Controle de Acesso RBAC):** Endpoints administrativos de gestão da DLQ e reprocessamento de mensagens devem exigir autenticação JWT e validação do papel de usuário `UserRole.ADMIN`.
* **PRD-NFR-07 (Idempotência e Rastreabilidade):** Toda notificação deve incluir os cabeçalhos `X-Event-Id` (UUID v4 único por evento) e `X-Timestamp` para permitir que o cliente consumidor desduplique mensagens no modelo At-Least-Once.

---

## 8. Decisões e Trade-Offs Principais

A arquitetura escolhida reflete a busca por **simplicidade operacional e menor Custo Total de Propriedade (TCO)** [`TRANSCRICAO.md:50-53`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L50-L53).

* **Transactional Outbox no MySQL vs. Message Broker Dedicado (Redis/RabbitMQ):** Optou-se por utilizar o MySQL existente para gravar os eventos da outbox na mesma transação dos pedidos. Isso elimina o problema de *dual-write* e evita custos de infraestrutura e manutenção de clusters adicionais.
* **Polling Worker de 2s vs. Disparo HTTP Síncrono:** O disparo síncrono no `OrderService` foi rejeitado por acoplar o tempo de resposta da nossa API à disponibilidade e latência dos servidores dos clientes B2B. O polling worker desacopla os processos e atende com folga o requisito de latência < 10s.

---

## 9. Dependências

* **Banco de Dados & ORM:** MySQL 8 e Prisma ORM (modelos `WebhookSubscription`, `WebhookOutbox`, `WebhookDeadLetter`).
* **Segurança Node.js:** Módulo nativo `crypto` para geração de chaves aleatórias e cálculo do digest HMAC-SHA256.
* **Cliente HTTP do Worker:** Client HTTP configurado com timeout de 10s e interceptors para injeção de headers.
* **Autenticação:** Middleware JWT existente e controle de acesso RBAC baseado no enum `UserRole`.

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Plano de Mitigação |
| :--- | :---: | :---: | :--- |
| **Sobrecarga de Leitura no MySQL por Polling Frequente** | Baixa | Médio | Criação de índice composto em `(status, nextAttemptAt)` na tabela `webhook_outbox` e leitura em batches reduzidos (ex: 50 itens). |
| **Endpoints de Clientes Indisponíveis ou Lentos** | Média | Alto | Timeout HTTP estrito de 10 segundos por disparo e política de backoff exponencial progressivo para não reter threads do worker. |
| **Processamento Duplicado no Cliente (At-Least-Once)** | Média | Médio | Envio obrigatório do cabeçalho `X-Event-Id` único por evento e documentação técnica detalhada no Developer Portal instruindo o cliente a desduplicar notificações. |
| **Vazamento de Secret no Lado do Cliente** | Baixa | Alto | Chaves de webhook exclusivas por cadastro e suporte a endpoint de rotação de secret com *grace period* de 24 horas. |

---

## 11. Critérios de Aceitação do Negócio

- [ ] **Cadastro e Validação:** Cliente consegue cadastrar um webhook informando URL HTTPS válida e lista de eventos, recebendo uma chave secreta no formato `whsec_*`.
- [ ] **Recebimento de Notificações:** Quando um pedido é pago (`PAID`) ou despachado (`SHIPPED`), o cliente cadastrado recebe uma requisição HTTP `POST` contendo os cabeçalhos `X-Signature`, `X-Event-Id` e `X-Timestamp` em menos de 10 segundos.
- [ ] **Validação de HMAC:** O cliente consegue validar com sucesso a assinatura HMAC-SHA256 utilizando o payload recebido e a chave secreta gerada.
- [ ] **Rotação sem Downtime:** Durante o período de 24h após a rotação de secret, o cliente consegue validar assinaturas tanto com a chave nova quanto com a chave anterior.
- [ ] **Efetividade do Retry e DLQ:** Em caso de simulação de queda do servidor receptor, o worker executa até 5 tentativas espaçadas e, ao final, move a notificação para a tabela de DLQ.
- [ ] **Replay por Administrador:** Administrador autenticado como `ADMIN` consegue reprocessar um item da DLQ via API e confirmar seu envio na outbox.

---

## 12. Estratégia de Testes e Validação

### Testes Unitários
* Validação de Schemas Zod para criação e edição de webhooks (rejeição de URLs HTTP).
* Cálculo de algoritmo HMAC-SHA256 com chave primária e chave secundária expirável.
* Cálculo do algoritmo de Backoff Exponencial para os intervalos de retry.

### Testes de Integração
* Verificação da atomacidade da transação: alterar o status do pedido via `OrderService.changeStatus` deve criar a linha na `webhook_outbox` no mesmo commit do banco.
* Confirmação de rollback: forçar um erro na transação de pedido deve impedir que a notificação seja gravada na outbox.

### Testes End-to-End (E2E)
* Execução do worker `src/worker.ts` contra um servidor HTTP Mock simulando os cenários:
  1. Retorno `200 OK`: Notificação marcada como `DELIVERED`.
  2. Retorno `500 Internal Error`: Notificação remarcada para retry com `nextAttemptAt` no futuro.
  3. Timeout (> 10s): Notificação cancelada por timeout e remarcada para retry.
  4. Exaustão de 5 tentativas: Transferência automática do registro para a tabela `webhook_dead_letters`.
