# ADR-005: Garantia de Entrega At-Least-Once e Idempotência no Consumidor

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Larissa (Tech Lead), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos), Marcos (Product Manager)

---

## Contexto e Declaração do Problema

Em sistemas distribuídos operando sobre HTTP, falhas de rede durante o ACK de resposta (ex: o cliente processou a mensagem com sucesso e retornou HTTP 200, mas a conexão caiu antes de o worker receber a resposta) provocam retentativas de envio.

O sistema precisa definir o modelo semântico de entrega de mensagens (Garantia de Entrega) e o mecanismo padrão para evitar que o processamento duplicado de eventos altere indevidamente o estado dos clientes B2B [`TRANSCRICAO.md:144-158`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L144-L158).

---

## Drivers de Decisão

* **Confiabilidade de Entrega:** Nenhum evento legítimo de mudança de status pode ser perdido (Zero Event Loss).
* **Simplicidade de Protocolo:** Adotar os padrões estabelecidos de mercado (Stripe, GitHub, Twilio) [`TRANSCRICAO.md:154-155`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L154-L155).
* **Desacoplamento de Estado:** A responsabilidade por desduplicar requisições repetidas deve ser do consumidor.

---

## Decisão Considerada e Escolhida

Decidiu-se adotar o modelo de entrega **At-Least-Once** (Pelo Menos Uma Vez), incluindo o cabeçalho HTTP **`X-Event-Id`** com um UUID v4 único por evento [`TRANSCRICAO.md:144-158`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L144-L158).

### Especificações do Protocolo:
1. **Identificador Único (`X-Event-Id`):** Gerado na inserção do registro na outbox (coluna `eventId` UUID v4). Esse ID permanece rigorosamente o mesmo através de todas as retentativas de envio do mesmo evento.
2. **Cabeçalhos Enviados nas Requisições outbound:**
   - `X-Event-Id`: Identificador único global do evento para idempotência e deduplicação.
   - `X-Webhook-Id`: ID do cadastro da URL de webhook atingida [`TRANSCRICAO.md:264-266`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L264-L266).
   - `X-Signature`: Assinatura HMAC-SHA256 (ADR-004).
   - `X-Timestamp`: Data/hora ISO-8601 da tentativa de envio (proteção contra replay attack).
3. **Idempotência no Consumidor:** O cliente B2B deve armazenar os valores de `X-Event-Id` recebidos em um cache/tabela local (ex: por 7 dias) e desduplicar caso o mesmo `X-Event-Id` chegue mais de uma vez [`TRANSCRICAO.md:150-156`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L150-L156).

---

## Alternativas Consideradas

### 1. Delivery Exactly-Once via 2PC / Protocolo Distribuído
* **Descrição:** Coordenar transações distribuídas (Two-Phase Commit) sobre HTTP entre a nossa infraestrutura e o servidor de cada cliente B2B para garantir que a mensagem seja entregue exatamente uma vez.
* **Motivo do Descarte:** Descartado por ser impraticável [`TRANSCRICAO.md:154-155`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L154-L155). 2PC introduz altíssimo acoplamento, dependência de suporte a transação nos dois lados e extrema lentidão sobre a internet pública.

---

## Consequências

### Positivas
* **Impossibilidade de Perda de Eventos:** Em qualquer cenário de incerteza de rede, o worker retentará o envio até obter a confirmação explícita.
* **Alinhamento com Padrões de Mercado:** Padrão de integração simples de documentar no Portal do Desenvolvedor e amplamente conhecido por engenheiros de software [`TRANSCRICAO.md:154-157`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L154-L157).

### Negativas / Trade-offs
* **Requisito Operacional no Cliente:** Os clientes B2B precisam estar cientes de que a deduplicação via `X-Event-Id` é obrigatória no lado deles para evitar processar o mesmo webhook duas vezes.

---

## Referências ao Código Base

* `prisma/schema.prisma`: Campo `eventId String @default(uuid()) @db.Char(36)` na tabela `WebhookOutbox`.
