# ADR-007: Gestão de Dead Letter Queue (DLQ) e Endpoint Admin de Replay Manual

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Sofia (Engenheira de Segurança), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos), Larissa (Tech Lead)

---

## Contexto e Declaração do Problema

Eventos que excedem a política de 5 retentativas (ADR-003) são direcionados para a tabela `webhook_dead_letters`. Esses registros representam notificações que falharam permanentemente devido a indisponibilidades prolongadas do cliente B2B, alterações indevidas de URLs ou falhas de infraestrutura.

É necessário definir:
1. A política de reprocessamento (Replay) de mensagens retidas na DLQ.
2. Os controles de acesso e segurança para acionar o reprocessamento de eventos falhos.
3. O rastreamento e a auditoria dessas ações operacionais [`TRANSCRICAO.md:108-116`, `204-215`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L108-L116).

---

## Drivers de Decisão

* **Controle de Acesso Restrito (RBAC):** Reprocessar eventos em massa pode gerar carga nos sistemas de integração e impactar pedidos. Apenas operadores com permissão de nível administrativo podem executar essa ação [`TRANSCRICAO.md:208-212`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L208-L212).
* **Auditoria:** Toda ação de reprocessamento deve registrar quem foi o usuário que solicitou o replay [`TRANSCRICAO.md:211-212`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L211-L212).
* **Isolamento de Falhas:** A outbox de produção não deve sofrer com tentativas contínuas em registros conhecidamente mortos.

---

## Decisão Considerada e Escolhida

Decidiu-se pela **Criação de Tabela Isolada `webhook_dead_letters`** gerenciada por um **Endpoint Administrativo de Replay Manual (`POST /api/v1/admin/webhooks/dead-letter/:id/replay`)**, restrito exclusivamente a usuários com a role `ADMIN` [`TRANSCRICAO.md:108-116`, `204-215`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L108-L116).

### Especificações do Endpoint e Acesso:

1. **Rota de Replay:** `POST /api/v1/admin/webhooks/dead-letter/:id/replay`
2. **Controle de Acesso (RBAC):**
   - Protegido pelos middlewares existentes [`src/middlewares/auth.middleware.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/middlewares/auth.middleware.ts) e `requireRole(UserRole.ADMIN)` [`TRANSCRICAO.md:212`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L212).
   - Tentativas efetuadas por usuários com a role `OPERATOR` retornam HTTP 403 Forbidden (`WEBHOOK_REPLAY_FORBIDDEN`).
3. **Mecanismo de Replay:**
   - O registro é lido da tabela `webhook_dead_letters`.
   - Um novo registro é inserido na tabela `webhook_outbox` com `status = PENDING`, `retryCount = 0`, preservando o `eventId` original para garantir idempotência no cliente B2B.
   - O registro correspondente é removido ou marcado como arquivado em `webhook_dead_letters`.
   - É gerado log estruturado (Pino) registrando o `userId` do administrador que executou a operação.

---

## Alternativas Consideradas

### 1. Descarte Silencioso (Drop) de Eventos Falhos
* **Descrição:** Caso as 5 tentativas falhem, o evento é purgado do banco de dados sem historização.
* **Motivo do Descarte:** Descartado [`TRANSCRICAO.md:110`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L110). Impede qualquer possibilidade de auditoria, suporte ao cliente B2B ou reprocessamento manual em caso de incidente sanado do lado do cliente.

### 2. Replay Automático sem Intervenção Humana
* **Descrição:** Um cronjob interno que tenta reprocessar itens da DLQ periodicamente sem análise prévia.
* **Motivo do Descarte:** Descartado. Se o cliente continua com o endpoint quebrado ou incorreto, o replay automático geraria um loop infinito de retentativas e poluição de logs.

---

## Consequências

### Positivas
* **Segurança e Auditoria:** Operações de replay são estritamente controladas por papéis JWT (`UserRole.ADMIN`) e auditadas em log [`TRANSCRICAO.md:211-212`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L211-L212).
* **Restauração Segura de Eventos:** Eventos perdidos por falhas no lado do cliente podem ser re-enfileirados com facilidade após a confirmação de restabelecimento do serviço do cliente.

### Negativas / Trade-offs
* **Necessidade de Intervenção Manual:** Exige ação proativa do time de suporte/operações para disparar o replay através da API Admin.

---

## Referências ao Código Base

* `prisma/schema.prisma`: Enum `UserRole` (`ADMIN`, `OPERATOR`) e tabela `WebhookDeadLetter`.
* [`src/middlewares/auth.middleware.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/middlewares/auth.middleware.ts): Middleware de autorização `requireRole`.
