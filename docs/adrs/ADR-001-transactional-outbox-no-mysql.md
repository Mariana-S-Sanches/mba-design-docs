# ADR-001: Adoção do Transactional Outbox Pattern no MySQL

* **Status:** Aceito
* **Data:** 2026-08-26
* **Decisores:** Larissa (Tech Lead), Diego (Engenheiro Sênior - Plataforma), Bruno (Engenheiro Pleno - Pedidos), Marcos (Product Manager), Sofia (Engenheira de Segurança)

---

## Contexto e Declaração do Problema

Nossos clientes B2B (Atlas Comercial, MaxDistribuição e Nova Cargo) solicitaram notificações em tempo real quando o status de seus pedidos for alterado no OMS [`TRANSCRICAO.md:18-19`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L18-L19). Atualmente, esses clientes realizam chamadas periódicas (*polling*) no endpoint `GET /api/v1/orders`, gerando alto consumo de recursos na nossa infraestrutura e latência insatisfatória para as operações deles.

Na arquitetura atual, a transação de mudança de status de um pedido é executada no método `changeStatus` de [`src/modules/orders/order.service.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/modules/orders/order.service.ts#L126-L179). Essa operação já é pesada, pois dentro de uma transação SQL (`prisma.$transaction`):
1. Atualiza a tabela `orders`;
2. Cria um registro de histórico na tabela `order_status_history`;
3. Decrementa ou incrementa o estoque na tabela `products` via `debitStock` / `replenishStock`.

O problema central é definir como notificar os sistemas externos sobre essas alterações de status sem comprometer a performance, o tempo de resposta do endpoint da API e a consistência transacional do banco de dados.

---

## Drivers de Decisão

* **Consistência Transacional (Atomacidade):** A alteração no status do pedido e a emissão da notificação devem ser atômicas. Não pode existir cenário em que o status do pedido seja atualizado no banco de dados mas a notificação não seja registrada, nem o oposto.
* **Isolamento de Performance (Desacoplamento HTTP):** Latências, lentidões ou indisponividades nos servidores dos clientes B2B não podem impactar o tempo de resposta ou a disponibilidade do OMS.
* **Simplicidade Operacional:** O time é enxuto [`TRANSCRICAO.md:52`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L52), priorizando soluções que reaproveitem a infraestrutura existente (MySQL) sem introduzir novas ferramentas complexas de gerenciar.

---

## Decisão Considerada e Escolhida

Decidiu-se implementar o **Transactional Outbox Pattern** no MySQL existente [`TRANSCRICAO.md:44-53`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L44-L53).

Sempre que a transição de status de um pedido ocorrer dentro do método `changeStatus` em [`src/modules/orders/order.service.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/modules/orders/order.service.ts#L126-L179), a inserção do evento na tabela `webhook_outbox` será executada dentro do mesmo bloco de transação do Prisma (`tx`).

### Alterações propostas na estrutura de dados (`prisma/schema.prisma`):

```prisma
model WebhookOutbox {
  id             String        @id @default(uuid()) @db.Char(36)
  subscriptionId String        @db.Char(36)
  eventId        String        @default(uuid()) @db.Char(36)
  eventType      String        @db.VarChar(100)
  payload        Json
  status         WebhookStatus @default(PENDING)
  retryCount     Int           @default(0)
  nextAttemptAt  DateTime      @default(now())
  lastError      String?       @db.Text
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  subscription   WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([status, nextAttemptAt])
  @@index([subscriptionId])
  @@map("webhook_outbox")
}
```

---

## Alternativas Consideradas

### 1. Disparo HTTP Síncrono no `OrderService`
* **Descrição:** Invocar diretamente os endpoints HTTP dos clientes B2B dentro do método `changeStatus` em [`src/modules/orders/order.service.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/modules/orders/order.service.ts#L126-L179).
* **Motivo do Descarte:** Descartado unanimemente [`TRANSCRICAO.md:30-37`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L30-L37). A transação de atualização do pedido já realiza operações pesadas em banco. Adicionar chamadas HTTP externas bloquearia a transação SQL. Caso o cliente estivesse lento ou fora do ar, o pedido seria travado ou forçado a sofrer rollback inadequado.

### 2. Message Broker Dedicado / Redis Streams
* **Descrição:** Publicar eventos em um cluster Redis Streams ou RabbitMQ imediatamente após a mudança de status.
* **Motivo do Descarte:** Descartado por complexidade operacional [`TRANSCRICAO.md:50-52`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L50-L52). Subir e manter um Redis Cluster/Broker traria sobrecarga de infraestrutura desnecessária para um time pequeno. Além disso, publicar no broker fora da transação SQL introduziria o risco do *dual-write problem* (o banco confirma a transação mas a publicação no broker falha).

---

## Consequências

### Positivas
* **Garantia de Consistência:** Se a transação SQL der commit, o evento estará garantido na `webhook_outbox`. Se a transação der rollback, a notificação é abortada automaticamente sem estado inconsistente [`TRANSCRICAO.md:48`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L48).
* **Zero Overhead de Infraestrutura Nova:** Reaproveitamento integral da instância MySQL e da conexão Prisma já existentes [`TRANSCRICAO.md:52`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L52).
* **Isolamento de Erros:** Indisponibilidade nos clientes externos não afeta o fluxo principal de vendas e alteração de pedidos do OMS.

### Negativas / Trade-offs
* **Crescimento da Tabela de Outbox:** A tabela `webhook_outbox` acumulará registros ao longo do tempo, necessitando de uma estratégia futura de expurgo/arquivamento de eventos processados com mais de 30 dias [`TRANSCRICAO.md:56`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md#L56).

---

## Referências ao Código Base

* [`src/modules/orders/order.service.ts`](file:///Users/marianasanches/Desktop/mba-design-docs/src/modules/orders/order.service.ts#L126-L179): Método `changeStatus` e controle de transação Prisma `this.prisma.$transaction`.
* [`prisma/schema.prisma`](file:///Users/marianasanches/Desktop/mba-design-docs/prisma/schema.prisma#L74-L97): Modelo `Order` e `OrderStatusHistory`.
