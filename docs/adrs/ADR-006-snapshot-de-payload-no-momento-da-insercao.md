# ADR-006: Snapshot de Payload no Momento da Inserção na Outbox

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Larissa (Tech Lead), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos)

---

## Contexto e Declaração do Problema

Quando o status de um pedido muda no OMS (ex: de `PAID` para `PROCESSING`), um evento é gerado. Entre o instante da transação SQL e o momento em que o worker efetivamente dispara a requisição HTTP outbound (devido ao intervalo de polling ou eventuais retentativas), o registro do pedido no banco de dados pode sofrer novas alterações por parte de operadores.

Surgiu a dúvida sobre como estruturar o corpo (payload) da notificação de webhook:
1. Montar um *snapshot* estático do payload JSON no exato momento do `changeStatus` e salvá-lo na outbox?
2. Salvar apenas os IDs (`order_id`, `event_type`) e consultar os dados do pedido no banco no momento do envio pelo worker? [`TRANSCRICAO.md:308-315`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L308-L315)

Além disso, definiu-se o tamanho máximo aceitável para o payload enviado (teto de **64 KB**) para evitar sobrecarga de memória e consumo de banda [`TRANSCRICAO.md:140-144`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L140-L144).

---

## Drivers de Decisão

* **Fidelidade Histórica:** O payload transmitido deve refletir rigorosamente o estado do pedido no momento exato em que aquela específica transição ocorreu.
* **Desempenho no Worker:** Evitar que o worker precise realizar múltiplos `JOINs` no banco para reconstruir o estado do pedido antes de cada disparo HTTP.
* **Tamanho de Payload Controlado:** Limitar o payload aos campos essenciais, evitando incluir arrays extensos como a lista completa de itens do pedido (`items`) [`TRANSCRICAO.md:256-258`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L256-L258).

---

## Decisão Considerada e Escolhida

Decidiu-se pela **Montagem de Snapshot Imutável de Payload JSON no Momento da Inserção** na tabela `webhook_outbox` [`TRANSCRICAO.md:308-315`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L308-L315).

### Estrutura do Payload (Snapshot):
O payload será serializado em JSON e armazenado na coluna `payload` (do tipo `Json` no MySQL/Prisma).

```json
{
  "event_id": "c39a823b-5e4d-4b8d-932d-123456789abc",
  "event_type": "order.status_changed",
  "timestamp": "2026-08-26T17:00:00.000Z",
  "data": {
    "order_id": "a1b2c3d4-e5f6-7a8b-9c0d-1234567890ab",
    "order_number": "ORD-000042",
    "customer_id": "f8e7d6c5-b4a3-2109-8765-43210fedcba9",
    "from_status": "PAID",
    "to_status": "PROCESSING",
    "subtotal_cents": 15000,
    "discount_cents": 1000,
    "total_cents": 14000
  }
}
```

* **Nota de Escopo:** O array de itens (`items`) é intencionalmente omitido do payload [`TRANSCRICAO.md:256-258`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L256-L258). Caso o cliente B2B precise dos detalhes dos produtos, ele pode realizar uma consulta em `GET /api/v1/orders/:id`.
* **Limite de Tamanho:** O payload é estritamente limitado ao teto de 64 KB. Caso ultrapasse essa marca, o envio é abortado com exceção de validação [`TRANSCRICAO.md:142-145`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L142-L145).

---

## Alternativas Consideradas

### 1. Renderização Dinâmica em Tempo de Disparo pelo Worker
* **Descrição:** Armazenar na outbox apenas `order_id`, `from_status` e `to_status`. Quando o worker fosse enviar o evento (segundos ou horas depois), ele faria um `tx.order.findUnique()` no MySQL e montaria o JSON no momento.
* **Motivo do Descarte:** Descartado unanimemente [`TRANSCRICAO.md:308-315`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L308-L315). Se o pedido sofresse atualizações adicionais antes do disparo do worker (ex: alteração de notas ou atualização para `SHIPPED`), o webhook enviado para o evento `PROCESSING` conteria dados inconsistentes do estado futuro do pedido.

---

## Consequências

### Positivas
* **Imutabilidade e Consistência Temporal:** A notificação reflete exatamente a fotografia do pedido no segundo da transição [`TRANSCRICAO.md:311-312`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L311-L312).
* **Velocidade de Processamento:** O worker apenas lê a coluna `payload` e envia o HTTP diretamente, sem overhead de queries SQL adicionais.

### Negativas / Trade-offs
* **Consumo de Armazenamento:** A coluna `payload` armazena dados redundantes em relação à tabela `orders`. No entanto, como o payload é enxuto (sem itens) e tem teto de 64 KB, o consumo é residual e aceitável.

---

## Referências ao Código Base

* [`src/modules/orders/order.service.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/modules/orders/order.service.ts#L126-L179): Método `changeStatus` onde a montagem do snapshot será invocada.
* [`prisma/schema.prisma`](file:///Users/marianasanches/Desktop/mba-design-docs/prisma/schema.prisma#L74-L97): Modelo `Order`.
