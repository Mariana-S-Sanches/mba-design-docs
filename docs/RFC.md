# RFC-001: Sistema de Webhooks para Notificação de Mudança de Status de Pedidos

## 1. Metadados

* **Autor**: Time de Engenharia de Plataforma / OMS
* **Status**: Proposto (Em Revisão)
* **Data**: Agosto de 2026
* **Revisores Obrigatórios**:
  - Larissa (Tech Lead)
  - Marcos (Product Manager)
  - Bruno (Engenheiro Pleno - Pedidos)
  - Diego (Engenheiro Sênior - Plataforma)
  - Sofia (Engenheira de Segurança)

---

## 2. Resumo Executivo (TL;DR)

Esta RFC propõe a arquitetura para o novo **Sistema de Webhooks Outbound de Notificação de Pedidos** do OMS. A solução resolve o problema de sobrecarga por chamadas contínuas de *polling* de clientes B2B (Atlas Comercial, MaxDistribuição e Nova Cargo) ao notificar proativamente e em tempo quase-real (< 10 segundos) alterações no ciclo de vida dos pedidos.

A proposta baseia-se no **Transactional Outbox Pattern** utilizando a instância MySQL existente, assegurando atomicidade entre a alteração de status do pedido (`Order.status`) e o enfileiramento do evento na tabela `webhook_outbox`. Um processo de **Worker autônomo** (`src/worker.ts`) consome esses eventos a cada 2 segundos via *polling* e dispara requisições HTTP seguras.

A segurança é garantida por assinaturas criptográficas **HMAC-SHA256** no cabeçalho `X-Signature`, segredos exclusivos por endpoint com suporte a rotação suave (grace period de 24h) e protocolo **HTTPS obrigatório**. O modelo de entrega adota **At-Least-Once** com o cabeçalho `X-Event-Id` (UUID v4) para desduplicação no consumidor. Resiliência a falhas é fornecida por uma política de **5 retentativas com backoff exponencial** (~15h de cobertura) com segregação de falhas permanentes em uma **Dead Letter Queue (DLQ)** e endpoint de replay administrativo protegido por **RBAC (role: ADMIN)**.

---

## 3. Contexto e Declaração do Problema

### Cenário Atual
O sistema OMS é construído em Node.js / Express com Prisma ORM e MySQL 8. Atualmente, não há mecanismo de publicação de eventos ou mensageria externa assíncrona no ecossistema da aplicação [`TRANSCRICAO.md:50-52`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L50-L52).

### Gargalo de Negócio
Três clientes B2B estratégicos realizam requisições HTTP frequentes e concorrentes no endpoint `GET /api/v1/orders` para verificar se o status de seus pedidos mudou. Essa prática gera alto consumo ineficiente de banda e CPU, degrada a performance global da API e proporciona uma experiência insatisfatória aos clientes B2B [`TRANSCRICAO.md:18-19`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L18-L19).

### Necessidade
Prover um mecanismo de push outbound confiável, seguro e de baixa latência (< 10 segundos) para notificar os sistemas externos sobre qualquer mudança no estado (`OrderStatus`) de seus pedidos [`TRANSCRICAO.md:20-22`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L20-L22).

---

## 4. Proposta Técnica (Visão Geral da Arquitetura)

### Desacoplamento Transacional (Transactional Outbox)
No método `changeStatus` de [`src/modules/orders/order.service.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/modules/orders/order.service.ts#L126-L179), a atualização do pedido, a alteração de histórico e a inserção do evento na tabela `webhook_outbox` são executadas dentro do mesmo bloco de transação SQL (`prisma.$transaction`). Caso a transação sofra rollback, o evento de webhook é cancelado atomicamente, garantindo consistência estrita.

### Pipeline de Entrega Assíncrona (Worker Autônomo)
O processamento e envio dos webhooks é feito por um processo separado (`src/worker.ts`), desacoplado da API Web Express. O worker executa um loop de *polling* a cada 2 segundos, lendo lotes de eventos `PENDING` ou `FAILED` prontos para retentativa, garantindo latência total de entrega bem abaixo do teto de 10 segundos [`TRANSCRICAO.md:58-76`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L58-L76).

### Segurança e Confiança
* **Autenticidade & Integridade:** Cada payload JSON é assinado via HMAC-SHA256 utilizando a secret do cadastro do cliente, enviada no cabeçalho `X-Signature` [`TRANSCRICAO.md:120`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L120).
* **Segredos Únicos e Rotação:** Cada cadastro de webhook possui uma chave própria. O sistema suporta rotação de chave via API com um *grace period* de 24 horas (`previousSecret` e `secretExpiresAt`), permitindo a transição sem downtime no cliente [`TRANSCRICAO.md:130-134`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L130-L134).
* **Validação de Transport:**URLs de webhook devem obrigatoriamente utilizar o protocolo `https://` [`TRANSCRICAO.md:123`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L123).

### Modelo de Entrega e Idempotência
O sistema garante a entrega no modelo **At-Least-Once**. Para que os clientes B2B realizem a desduplicação de eventos, cada notificação contém os cabeçalhos:
* `X-Event-Id`: Identificador único (UUID v4) gerado na criação do evento e mantido idêntico em todas as retentativas.
* `X-Webhook-Id`: Identificador do cadastro de webhook do cliente.
* `X-Timestamp`: Data/hora ISO-8601 da tentativa de envio (para prevenção contra ataques de replay) [`TRANSCRICAO.md:260-266`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L260-L266).

### Resiliência e Recuperação
* **Política de Retry:** 5 retentativas organizadas em backoff exponencial (1m, 5m, 30m, 2h, 12h), cobrindo uma janela de falha intermitente de ~15 horas [`TRANSCRICAO.md:102-107`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L102-L107).
* **Dead Letter Queue (DLQ):** Eventos que excedem a 5ª tentativa são movidos para a tabela `webhook_dead_letters` [`TRANSCRICAO.md:108-110`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L108-L110).
* **Replay Administrativo:** Reprocessamento manual via endpoint `POST /api/v1/admin/webhooks/dead-letter/:id/replay`, protegido por controle de acesso baseado em função (RBAC: `role: ADMIN`) [`TRANSCRICAO.md:208-212`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L208-L212).

---

## 5. Decisões Arquiteturais Relacionadas (ADRs)

Para um aprofundamento nos detalhes de cada decisão técnica, consulte os registros individuais:

* [ADR-001: Transactional Outbox no MySQL](adrs/ADR-001-transactional-outbox-no-mysql.md)
* [ADR-002: Arquitetura de Polling Worker](adrs/ADR-002-polling-worker-architecture.md)
* [ADR-003: Política de Retry com Backoff e DLQ](adrs/ADR-003-politica-retry-backoff-dlq.md)
* [ADR-004: Autenticação HMAC-SHA256 e Rotação de Segredos](adrs/ADR-004-autenticacao-hmac-sha256-e-rotacao.md)
* [ADR-005: Garantia At-Least-Once e Idempotência](adrs/ADR-005-garantia-at-least-once-e-idempotencia.md)
* [ADR-006: Snapshot de Payload no Momento da Inserção](adrs/ADR-006-snapshot-de-payload-no-momento-da-insercao.md)
* [ADR-007: Gestão de DLQ e Replay Administrativo](adrs/ADR-007-gestao-dlq-e-replay-admin.md)

---

## 6. Alternativas Consideradas e Motivos de Descarte

### Alternativa 1: Disparo HTTP Síncrono no `OrderService`
* **Motivo do Descarte:** Travaria a transação do banco de dados enquanto aguardasse a resposta HTTP externa. Indisponibilidades ou lentidões nos clientes fariam os pedidos falharem ou demorarem excessivamente para serem salvos [`TRANSCRICAO.md:30-37`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L30-L37).

### Alternativa 2: Introdução de Message Broker Dedicado (Redis Streams / RabbitMQ / Kafka)
* **Motivo do Descarte:** Requereria provisionar e manter uma infraestrutura de mensageria adicional, trazendo *overengineering* e sobrecarga operacional desnecessária para o tamanho do time. A outbox no MySQL existente atende plenamente à volumetria [`TRANSCRICAO.md:50-53`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L50-L53).

### Alternativa 3: Database Triggers no MySQL
* **Motivo do Descarte:** O MySQL 8 não oferece mecanismo nativo de escuta reativa (tipo `LISTEN/NOTIFY`). Triggers no banco não conseguem notificar processos de código externo de forma limpa e auditável [`TRANSCRICAO.md:62-65`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L62-L65).

---

## 7. Questões em Aberto e Próximos Passos (Fase 2+)

* **Alerta de Falhas Críticas / Notificação por E-mail ao Cliente:** O envio de e-mails de alerta quando um cliente acumular falhas consecutivas foi postergado para avaliação após a entrada da feature em produção [`TRANSCRICAO.md:218-223`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L218-L223).
* **Rate Limiting de Saída (Outbound Throttling):** A necessidade de limitar o volume de disparos simultâneos para um mesmo cliente será monitorada via métricas em produção para futura implementação, se necessário [`TRANSCRICAO.md:224-230`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L224-L230).
* **Escalonamento Horizontal de Múltiplos Workers:** Atualmente um único worker atende à demanda mantendo ordering por `order_id`. O escalonamento com múltiplos workers concorrentes (usando lock pessimista ou particionamento) será desenhado na Fase 2 [`TRANSCRICAO.md:80-86`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L80-L86).
* **Interface Visual de Gerenciamento (Dashboard):** A criação de um painel gráfico para visualização de webhooks no frontend ficou fora do escopo do backend e será desenvolvida como projeto separado [`TRANSCRICAO.md:232-237`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L232-L237).

---

## 8. Impactos, Riscos e Mitigações

### Carga de Leitura no MySQL
* **Risco:** O *polling* constante a cada 2 segundos pode gerar contenção de leitura no banco.
* **Mitigação:** Criação de índice composto na tabela `webhook_outbox` cobrindo `(status, nextAttemptAt)` e leitura restrita em batches de tamanho reduzido [`TRANSCRICAO.md:56`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L56).

### Endpoints de Clientes Inacessíveis / Trava de Conexão
* **Risco:** Clientes lentos que deixam conexões abertas penduradas poderiam esgotar os sockets do worker.
* **Mitigação:** Aplicação rigorosa de *timeout* HTTP de 10 segundos em todas as requisições de saída efetuadas pelo worker [`TRANSCRICAO.md:248-251`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L248-L251).
