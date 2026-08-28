import { OrderStatus } from '@prisma/client';

const transitions: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

export function allowedTransitions(from: OrderStatus): ReadonlyArray<OrderStatus> {
  return transitions[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return transitions[status].length === 0;
}

export const STOCK_DEBIT_TRANSITION = {
  from: OrderStatus.PENDING,
  to: OrderStatus.PAID,
} as const;

export function shouldDebitStock(from: OrderStatus, to: OrderStatus): boolean {
  return from === STOCK_DEBIT_TRANSITION.from && to === STOCK_DEBIT_TRANSITION.to;
}

export function shouldReplenishStock(from: OrderStatus, to: OrderStatus): boolean {
  return (
    to === OrderStatus.CANCELLED && (from === OrderStatus.PAID || from === OrderStatus.PROCESSING)
  );
}
