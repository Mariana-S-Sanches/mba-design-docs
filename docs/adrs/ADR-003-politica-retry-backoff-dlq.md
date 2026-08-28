# ADR-003: Política de Retry com Backoff Exponencial e Dead Letter Queue (DLQ)

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Larissa (Tech Lead), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos), Marcos (Product Manager)

---

## Contexto e Declaração do Problema

Durante a entrega de webhooks de saída, é esperado que endpoints de clientes B2B fiquem temporariamente indisponíveis por falhas de rede, manutenções programadas ou sobrecarga interna [`TRANSCRICAO.md:90-107`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L90-L107). O sistema precisa tratar tais falhas de forma resiliente, sem perder eventos e sem sobrecarregar endpoints em falha com requisições consecutivas de alta frequência.

Historicamente, clientes B2B já apresentaram janelas de indisponibilidade planejada de até 2 horas [`TRANSCRICAO.md:100-101`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L100-L101).

---

## Drivers de Decisão

* **Resiliência a Indisponibilidades Prolongadas:** Cobrir janelas operacionais de falha de até 15 horas.
* **Evitar NACK Block / Entupimento da Fila:** Garantir que registros com falha intermitente não travem o processamento de novos eventos destinados a outros clientes.
* **Rastreabilidade e Evidência de Erro:** Isolar mensagens que esgotaram as tentativas em uma estrutura separada (DLQ) para auditoria e reprocessamento futuro.

---

## Decisão Considerada e Escolhida

Decidiu-se adotar uma política de **Retry com Backoff Exponencial em 5 Tentativas** e transição automática para **Dead Letter Queue (DLQ)** em tabela separada [`TRANSCRICAO.md:90-111`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L90-L111).

### Regras de Retry e Intervalos:
* **Número Máximo de Tentativas:** 5 retentativas [`TRANSCRICAO.md:95-96`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L95-L96).
* **Progressão do Backoff Exponencial:**
  - 1ª Tentativa de Retry: 1 minuto após a primeira falha.
  - 2ª Tentativa de Retry: 5 minutos após a 1ª falha.
  - 3ª Tentativa de Retry: 30 minutos após a 2ª falha.
  - 4ª Tentativa de Retry: 2 horas após a 3ª falha.
  - 5ª Tentativa de Retry: 12 horas após a 4ª falha.
* **Janela Total Coberta:** ~14 horas e 36 minutos entre o disparo inicial e a última tentativa [`TRANSCRICAO.md:104-105`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L104-L105).
* **Timeout por Requisição HTTP:** 10 segundos [`TRANSCRICAO.md:248-251`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L248-L251). Respostas com status diferente de 2xx ou que estourem o timeout são contabilizadas como falha.

### Comportamento de DLQ:
Caso a 5ª retentativa falhe, o registro é removido/marcado como `FAILED` na tabela `webhook_outbox` e uma cópia contendo o payload integral, o histórico de erros e a causa da falha é inserida na tabela `webhook_dead_letters` [`TRANSCRICAO.md:108-111`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L108-L111).

---

## Alternativas Consideradas

### 1. Retry Agressivo (3 Tentativas em Janela Curta)
* **Descrição:** Executar 3 tentativas com intervalos curtos (ex: 1m, 5m, 15m), desistindo em ~30 minutos.
* **Motivo do Descarte:** Descartado [`TRANSCRICAO.md:98-101`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L98-L101). Uma janela de 30 minutos descarte eventos se o cliente estiver em manutenção preventiva (que costuma durar até 2 horas).

### 2. Retry Indefinido / Infinito
* **Descrição:** Retentar o envio continuamente sem limite de tentativas até que o endpoint retorne 200 OK.
* **Motivo do Descarte:** Descartado [`TRANSCRICAO.md:95-96`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L95-L96). Se o cliente alterar a URL ou desativar o servidor permanentemente, o banco ficaria retentando registros mortos indefinidamente, acumulando sujeira e consumindo recursos do worker.

---

## Consequências

### Positivas
* **Proteção contra Indisponibilidades Severas:** Cobre falhas temporárias durante a maior parte de um dia útil sem intervenção humana.
* **Tabela Outbox Limpa:** A movimentação para a `webhook_dead_letters` impede que registros irrecuperáveis sujem os índices de busca por itens `PENDING` na `webhook_outbox` [`TRANSCRICAO.md:110`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L110).

### Negativas / Trade-offs
* **Atraso na Notificação Final:** Um evento que se recupere na 5ª tentativa terá sido entregue com ~15 horas de atraso. No entanto, o cabeçalho `X-Timestamp` garantirá ao cliente a visibilidade de quando a tentativa original foi criada.

---

## Referências ao Código Base

* `prisma/schema.prisma`: Inclusão dos campos `retryCount`, `nextAttemptAt` e `lastError` no modelo `WebhookOutbox` e criação da tabela `WebhookDeadLetter`.
