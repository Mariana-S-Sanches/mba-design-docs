# ADR-004: Autenticação via HMAC-SHA256 e Rotação de Secret com Grace Period

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Sofia (Engenheira de Segurança), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos), Larissa (Tech Lead)

---

## Contexto e Declaração do Problema

Ao emitir requisições HTTP outbound contendo dados sensíveis de pedidos para URLs externas dos clientes B2B, surgem dois riscos críticos de segurança:
1. **Autenticidade e Não-Repúdio:** O cliente precisa garantir que a requisição veio genuinamente do nosso OMS e não de um terceiro malicioso [`TRANSCRICAO.md:118-120`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L118-L120).
2. **Integridade do Payload:** O cliente precisa validar que o corpo da mensagem JSON não foi alterado em trânsito.
3. **Gestão de Chaves e Vazamentos:** Em caso de vazamento acidental de chaves no lado do cliente, deve haver um mecanismo seguro para rotacionar a secret sem causar queda ou rejeição súbita de requisições legítimas em trânsito [`TRANSCRICAO.md:130-134`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L130-L134).

---

## Drivers de Decisão

* **Padrão de Mercado para Webhooks Outbound:** Utilizar algoritmos criptográficos robustos suportados nativamente por qualquer linguagem/framework do mercado.
* **Isolamento de Impacto (Princípio do Menor Privilégio):** Segredos devem ser únicos por endpoint/inscrição de webhook. O vazamento de uma secret não pode comprometer a segurança de outros webhooks ou clientes [`TRANSCRICAO.md:126-127`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L126-L127).
* **Zero Downtime em Rotação:** Permitir que o cliente atualize suas chaves de integração suavemente.

---

## Decisão Considerada e Escolhida

Decidiu-se adotar assinatura de payload via **HMAC-SHA256**, segredos exclusivos por endpoint, suporte a **HTTPS obrigatório** e rotação de secret com **Grace Period de 24 horas** [`TRANSCRICAO.md:118-138`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L118-L138).

### Especificações Técnicas:

1. **Assinatura HMAC-SHA256:**
   - O corpo exato em string JSON do request é assinado usando a chave secreta (`secret`) do webhook via HMAC-SHA256.
   - O valor hex resultante é enviado no cabeçalho HTTP `X-Signature` [`TRANSCRICAO.md:120`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L120).
2. **Secret Único por Endpoint:**
   - Cada assinatura armazenará sua própria `secret` gerada aleatoriamente no momento do cadastro.
3. **Rotação com Grace Period (24 Horas):**
   - Na rotação via `POST /api/v1/webhooks/:id/rotate-secret`, a secret atual é movida para `previousSecret` e uma nova chave é gravada em `secret`.
   - O campo `secretExpiresAt` é preenchido com a data/hora atual + 24 horas [`TRANSCRICAO.md:130-134`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L130-L134).
   - Durante esse período de 24h, o worker assina a requisição com a nova secret, mas o cliente pode aceitar a antiga se ainda não atualizou seus servidores. Após 24h, a `previousSecret` é invalidada.
4. **HTTPS Obrigatório:**
   - Schemas Zod de validação de URL devem rejeitar qualquer protocolo que não seja `https://` com o erro `WEBHOOK_INVALID_URL` [`TRANSCRICAO.md:137-138`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L137-L138).

---

## Alternativas Consideradas

### 1. Secret Estático Global Compartilhado
* **Descrição:** Utilizar uma única chave secreta da plataforma inteira para assinar todos os webhooks de todos os clientes.
* **Motivo do Descarte:** Descartado por segurança [`TRANSCRICAO.md:126-127`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L126-L127). Se uma única empresa vazar a secret em seus logs ou repositório público, a segurança de todos os outros clientes B2B seria comprometida simultaneamente.

### 2. Autenticação via Basic Auth / Bearer Tokens Estáticos nas URLs
* **Descrição:** Incluir um token fixo na URL ou no header `Authorization` de destino.
* **Motivo do Descarte:** Descartado. Tokens estáticos no header não garantem a integridade do corpo da mensagem JSON contra modificações ou man-in-the-middle e são vulneráveis a vazamentos em servidores de proxy/log.

---

## Consequências

### Positivas
* **Garantia de Integridade e Origem:** O cliente consegue validar matematicamente que o payload foi gerado pelo nosso OMS e não sofreu alterações [`TRANSCRICAO.md:120`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L120).
* **Flexibilidade Operacional:** O grace period de 24 horas elimina indisponibilidades de integração durante a troca de chaves pelos times de TI dos clientes B2B [`TRANSCRICAO.md:131`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L131).

### Negativas / Trade-offs
* **Complexidade no Schema do Banco:** O modelo Prisma da tabela `WebhookSubscription` precisa armazenar `secret`, `previousSecret` e `secretExpiresAt`.

---

## Referências ao Código Base

* `prisma/schema.prisma`: Tabela `WebhookSubscription` contendo `secret`, `previousSecret` e `secretExpiresAt`.
* `src/modules/webhooks/webhook.security.ts` (a ser documentado): Módulo responsável por `crypto.createHmac('sha256', secret)`.
