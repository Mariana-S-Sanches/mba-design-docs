# Matriz de Rastreabilidade de Engenharia (Tracker)

> Este documento estabelece a rastreabilidade bidirecional entre as decisões, requisitos e contratos técnicos registrados nos Design Docs (`PRD.md`, `RFC.md`, `FDD.md`, `docs/adrs/`) e suas respectivas fontes originais na reunião técnica (`TRANSCRICAO.md`) e no código base da aplicação.

## Tabela de Rastreabilidade

| ID | Documento | Tipo | Conteúdo (resumo) | Fonte | Localização |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ADR-001 | `docs/adrs/ADR-001-transactional-outbox-no-mysql.md` | Decisão Arquitetural | Adotar o Transactional Outbox Pattern no MySQL gravando eventos na transação do pedido | TRANSCRICAO | [09:06] Diego |
| ADR-002 | `docs/adrs/ADR-002-polling-worker-architecture.md` | Decisão Arquitetural | Worker autônomo em polling de 2s lendo batches pendentes da outbox | TRANSCRICAO | [09:10] Larissa |
| ADR-003 | `docs/adrs/ADR-003-politica-retry-backoff-dlq.md` | Decisão Arquitetural | Retry com backoff exponencial (1m, 5m, 30m, 2h, 12h) e transição para DLQ após 5 falhas | TRANSCRICAO | [09:17] Larissa |
| ADR-004 | `docs/adrs/ADR-004-autenticacao-hmac-sha256-e-rotacao.md` | Decisão Arquitetural | Assinatura HMAC-SHA256, secret por endpoint e rotação com grace period de 24h | TRANSCRICAO | [09:22] Sofia |
| ADR-005 | `docs/adrs/ADR-005-garantia-at-least-once-e-idempotencia.md` | Decisão Arquitetural | Entrega At-least-once com cabeçalho X-Event-Id para deduplicação no cliente consumidor | TRANSCRICAO | [09:26] Larissa |
| ADR-006 | `docs/adrs/ADR-006-snapshot-de-payload-no-momento-da-insercao.md` | Decisão Arquitetural | Payload JSON montado em formato snapshot imutável durante o changeStatus | TRANSCRICAO | [09:52] Larissa |
| ADR-007 | `docs/adrs/ADR-007-gestao-dlq-e-replay-admin.md` | Decisão Arquitetural | Tabela webhook_dead_letters com endpoint de replay manual restrito à role ADMIN | TRANSCRICAO | [09:36] Larissa |
| PRD-FR-01 | `docs/PRD.md` | Requisito Funcional | Endpoint POST /webhooks para cadastrar URL HTTPS, eventos e gerar secret criptográfica | TRANSCRICAO | [09:31] Marcos |
| PRD-FR-02 | `docs/PRD.md` | Requisito Funcional | Endpoints GET, PATCH e DELETE para gerenciar assinaturas de webhooks ativas | TRANSCRICAO | [09:33] Bruno |
| PRD-FR-03 | `docs/PRD.md` | Requisito Funcional | Filtragem na inserção da outbox para gravar apenas eventos escutados pelo cliente | TRANSCRICAO | [09:34] Bruno |
| PRD-FR-04 | `docs/PRD.md` | Requisito Funcional | Rotação de secret via API mantendo a chave antiga válida por 24 horas (grace period) | TRANSCRICAO | [09:21] Sofia |
| PRD-FR-05 | `docs/PRD.md` | Requisito Funcional | Inserção atômica na outbox dentro do bloco prisma.$transaction do changeStatus | TRANSCRICAO | [09:40] Bruno |
| PRD-FR-06 | `docs/PRD.md` | Requisito Funcional | Envios HTTP pelo worker contendo a assinatura HMAC-SHA256 no header X-Signature | TRANSCRICAO | [09:20] Sofia |
| PRD-FR-07 | `docs/PRD.md` | Requisito Funcional | Retentativas automáticas em 5 tentativas com intervalos exponenciais até 12 horas | TRANSCRICAO | [09:17] Larissa |
| PRD-FR-08 | `docs/PRD.md` | Requisito Funcional | Isolamento de eventos irrecuperáveis na tabela de Dead Letter Queue após 5 falhas | TRANSCRICAO | [09:18] Diego |
| PRD-FR-09 | `docs/PRD.md` | Requisito Funcional | Endpoint admin de replay manual de DLQ exigindo autorização JWT com role ADMIN | TRANSCRICAO | [09:36] Sofia |
| PRD-FR-10 | `docs/PRD.md` | Requisito Funcional | Endpoint GET /webhooks/:id/deliveries para histórico de tentativas e respostas HTTP | TRANSCRICAO | [09:34] Marcos |
| PRD-NFR-01 | `docs/PRD.md` | Requisito Não Funcional | Protocolo HTTPS obrigatório para cadastro de URLs de destino de webhooks | TRANSCRICAO | [09:23] Sofia |
| PRD-NFR-02 | `docs/PRD.md` | Requisito Não Funcional | Validação de integridade via assinatura HMAC-SHA256 no header X-Signature | TRANSCRICAO | [09:20] Sofia |
| PRD-NFR-03 | `docs/PRD.md` | Requisito Não Funcional | Latência máxima de entrega inferior a 10 segundos com worker em polling de 2s | TRANSCRICAO | [09:02] Marcos |
| PRD-NFR-04 | `docs/PRD.md` | Requisito Não Funcional | Limite de tamanho de payload snapshot fixado no teto máximo de 64 KB | TRANSCRICAO | [09:24] Larissa |
| PRD-NFR-05 | `docs/PRD.md` | Requisito Não Funcional | Timeout estrito de 10 segundos nas chamadas HTTP de disparo efetuadas pelo worker | TRANSCRICAO | [09:42] Diego |
| PRD-NFR-06 | `docs/PRD.md` | Requisito Não Funcional | Controle de acesso RBAC exigindo UserRole.ADMIN para reprocessamento na DLQ | TRANSCRICAO | [09:36] Larissa |
| PRD-NFR-07 | `docs/PRD.md` | Requisito Não Funcional | Inclusão do header X-Event-Id com UUID único para suporte à idempotência no consumidor | TRANSCRICAO | [09:25] Diego |
| PRD-MET-01 | `docs/PRD.md` | Métrica de Sucesso | Entrega de 99% das notificações de webhook em latência menor que 10 segundos | TRANSCRICAO | [09:02] Marcos |
| PRD-MET-02 | `docs/PRD.md` | Métrica de Sucesso | Redução de 80% no polling excessivo de GET /orders em até 60 dias pós-lançamento | TRANSCRICAO | [09:00] Marcos |
| PRD-MET-03 | `docs/PRD.md` | Métrica de Sucesso | Taxa de sucesso de entrega de 99.5% acumulada antes da transição para DLQ | TRANSCRICAO | [09:15] Diego |
| RFC-PROP-01 | `docs/RFC.md` | Proposta Técnica | Transactional Outbox Pattern no MySQL gravando eventos na tabela webhook_outbox | TRANSCRICAO | [09:06] Diego |
| RFC-PROP-02 | `docs/RFC.md` | Proposta Técnica | Worker autônomo src/worker.ts consumindo outbox a cada 2s e enviando HTTP | TRANSCRICAO | [09:11] Larissa |
| RFC-ALT-01 | `docs/RFC.md` | Alternativa Descartada | Disparo HTTP síncrono no OrderService desacoplado devido a risco de travamento de transação | TRANSCRICAO | [09:04] Bruno |
| RFC-ALT-02 | `docs/RFC.md` | Alternativa Descartada | Message Broker dedicado (Redis Streams / RabbitMQ) descartado por sobrecarga operacional | TRANSCRICAO | [09:07] Diego |
| RFC-ALT-03 | `docs/RFC.md` | Alternativa Descartada | Database Triggers no MySQL descartadas por ausência de primitiva LISTEN/NOTIFY nativa | TRANSCRICAO | [09:09] Diego |
| RFC-ALT-04 | `docs/RFC.md` | Alternativa Descartada | Secret estático global descartado em favor de secret único por endpoint para isolamento | TRANSCRICAO | [09:21] Sofia |
| RFC-OPEN-01 | `docs/RFC.md` | Questão em Aberto | Alertas automáticos por e-mail ao cliente após 5 falhas consecutivas (adiado Fase 2) | TRANSCRICAO | [09:37] Larissa |
| RFC-OPEN-02 | `docs/RFC.md` | Questão em Aberto | Rate limiting de saída (outbound throttling) por cliente mantido para monitoramento | TRANSCRICAO | [09:39] Larissa |
| RFC-OPEN-03 | `docs/RFC.md` | Questão em Aberto | Escalonamento horizontal para múltiplos workers em paralelo com lock ou particionamento | TRANSCRICAO | [09:13] Diego |
| RFC-OPEN-04 | `docs/RFC.md` | Questão em Aberto | Painel gráfico / Dashboard visual no frontend mantido como projeto separado | TRANSCRICAO | [09:40] Larissa |
| FDD-INT-01 | `docs/FDD.md` | Integração de Código | Modelos WebhookSubscription, WebhookOutbox e WebhookDeadLetter no schema do banco | CODIGO | prisma/schema.prisma |
| FDD-INT-02 | `docs/FDD.md` | Integração de Código | Injeção da publicação atômica na outbox dentro do prisma.$transaction no changeStatus | CODIGO | src/modules/orders/order.service.ts |
| FDD-INT-03 | `docs/FDD.md` | Integração de Código | Máquina de estados OrderStatus e matriz de transições permitidas | CODIGO | src/modules/orders/order.status.ts |
| FDD-INT-04 | `docs/FDD.md` | Integração de Código | Injeção dos novos controladores de webhooks no roteador central /api/v1 | CODIGO | src/app.ts |
| FDD-INT-05 | `docs/FDD.md` | Integração de Código | Hierarquia de exceções de aplicação padronizadas estendendo a classe AppError | CODIGO | src/shared/errors/app-error.ts |
| FDD-INT-06 | `docs/FDD.md` | Integração de Código | Definição de erros HTTP genéricos e específicos com códigos numéricos de status | CODIGO | src/shared/errors/http-errors.ts |
| FDD-INT-07 | `docs/FDD.md` | Integração de Código | Middlewares de autenticação JWT e autorização por função de usuário requireRole | CODIGO | src/middlewares/auth.middleware.ts |
| FDD-FLOW-01 | `docs/FDD.md` | Fluxo de Execução | Diagrama e passos do fluxo de enfileiramento atômico do evento no changeStatus | TRANSCRICAO | [09:40] Bruno |
| FDD-FLOW-02 | `docs/FDD.md` | Fluxo de Execução | Diagrama e passos do loop de polling do worker com envio HTTP e tratamento de resposta | TRANSCRICAO | [09:08] Diego |
| FDD-FLOW-03 | `docs/FDD.md` | Fluxo de Execução | Diagrama e transição de estados de retentativas exponenciais e isolamento em DLQ | TRANSCRICAO | [09:17] Diego |
| FDD-FLOW-04 | `docs/FDD.md` | Fluxo de Execução | Diagrama e passos do reprocessamento manual de DLQ via endpoint admin | TRANSCRICAO | [09:18] Diego |
| FDD-API-01 | `docs/FDD.md` | Contrato de API | Especificação do endpoint POST /api/v1/webhooks com request e response bodies | TRANSCRICAO | [09:31] Marcos |
| FDD-API-02 | `docs/FDD.md` | Contrato de API | Especificação dos endpoints GET e PATCH /api/v1/webhooks para gestão | TRANSCRICAO | [09:33] Bruno |
| FDD-API-03 | `docs/FDD.md` | Contrato de API | Especificação do endpoint POST /api/v1/webhooks/:id/rotate-secret com grace period | TRANSCRICAO | [09:21] Sofia |
| FDD-API-04 | `docs/FDD.md` | Contrato de API | Especificação do endpoint GET /api/v1/webhooks/:id/deliveries para histórico | TRANSCRICAO | [09:34] Marcos |
| FDD-API-05 | `docs/FDD.md` | Contrato de API | Especificação do endpoint POST /api/v1/admin/webhooks/dead-letter/:id/replay | TRANSCRICAO | [09:35] Diego |
| FDD-API-06 | `docs/FDD.md` | Contrato de API | Contrato HTTP de saída enviado pelo worker aos clientes B2B (Headers e Snapshot JSON) | TRANSCRICAO | [09:44] Diego |
