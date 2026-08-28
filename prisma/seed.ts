import { PrismaClient, OrderStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_PASSWORD = 'admin123';
const OPERATOR_PASSWORD = 'operator123';

const customersSeed = [
  {
    name: 'Mariana Silva Santos',
    email: 'mariana.santos@exemplo.com.br',
    phone: '+5511987654321',
    document: '123.456.789-00',
    address: {
      street: 'Rua das Acácias',
      number: '125',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
    },
  },
  {
    name: 'Rafael Oliveira Pereira',
    email: 'rafael.pereira@exemplo.com.br',
    phone: '+5521976543210',
    document: '987.654.321-00',
    address: {
      street: 'Avenida Atlântica',
      number: '2000',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22021-001',
    },
  },
  {
    name: 'Camila Rodrigues Costa',
    email: 'camila.costa@exemplo.com.br',
    phone: '+5531965432109',
    document: '456.789.123-00',
    address: {
      street: 'Rua da Bahia',
      number: '870',
      city: 'Belo Horizonte',
      state: 'MG',
      zipCode: '30160-011',
    },
  },
  {
    name: 'João Pedro Almeida',
    email: 'joao.almeida@exemplo.com.br',
    phone: '+5541954321098',
    document: '321.654.987-00',
    address: {
      street: 'Avenida Sete de Setembro',
      number: '3401',
      city: 'Curitiba',
      state: 'PR',
      zipCode: '80250-210',
    },
  },
  {
    name: 'Beatriz Carvalho Lima',
    email: 'beatriz.lima@exemplo.com.br',
    phone: '+5551943210987',
    document: '654.987.321-00',
    address: {
      street: 'Rua dos Andradas',
      number: '1234',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90020-007',
    },
  },
  {
    name: 'Logística Atlas Comercial Ltda',
    email: 'contato@atlascomercial.com.br',
    phone: '+5511932109876',
    document: '12.345.678/0001-90',
    address: {
      street: 'Rua Vergueiro',
      number: '5500',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04101-300',
    },
  },
  {
    name: 'Thiago Mendes Ferreira',
    email: 'thiago.ferreira@exemplo.com.br',
    phone: '+5571921098765',
    document: '741.852.963-00',
    address: {
      street: 'Avenida Tancredo Neves',
      number: '620',
      city: 'Salvador',
      state: 'BA',
      zipCode: '41820-020',
    },
  },
  {
    name: 'Distribuidora Nordeste S.A.',
    email: 'compras@nordestedist.com.br',
    phone: '+5581910987654',
    document: '98.765.432/0001-10',
    address: {
      street: 'Avenida Boa Viagem',
      number: '4500',
      city: 'Recife',
      state: 'PE',
      zipCode: '51011-000',
    },
  },
  {
    name: 'Patrícia Souza Nogueira',
    email: 'patricia.nogueira@exemplo.com.br',
    phone: '+5562909876543',
    document: '159.357.486-00',
    address: {
      street: 'Avenida T-9',
      number: '880',
      city: 'Goiânia',
      state: 'GO',
      zipCode: '74230-040',
    },
  },
  {
    name: 'Eduardo Tavares Ribeiro',
    email: 'eduardo.ribeiro@exemplo.com.br',
    phone: '+5585908765432',
    document: '852.741.963-00',
    address: {
      street: 'Avenida Beira-Mar',
      number: '2300',
      city: 'Fortaleza',
      state: 'CE',
      zipCode: '60165-121',
    },
  },
];

const productsSeed = [
  { sku: 'NB-DELL-001', name: 'Notebook Dell Inspiron 15', description: 'Notebook 15.6", Intel i5, 16GB RAM, 512GB SSD', priceCents: 459900, stockQuantity: 25 },
  { sku: 'NB-LEN-002', name: 'Notebook Lenovo ThinkPad E14', description: 'Notebook 14", Intel i7, 32GB RAM, 1TB SSD', priceCents: 689900, stockQuantity: 12 },
  { sku: 'MON-LG-001', name: 'Monitor LG UltraWide 29"', description: 'Monitor 29" 21:9, IPS, 100Hz', priceCents: 189900, stockQuantity: 40 },
  { sku: 'MON-DEL-002', name: 'Monitor Dell 27" 4K', description: 'Monitor 27" UHD 4K IPS USB-C', priceCents: 279900, stockQuantity: 18 },
  { sku: 'KEY-LOG-001', name: 'Teclado Logitech MX Keys', description: 'Teclado sem fio, retroiluminado, layout ABNT2', priceCents: 89900, stockQuantity: 60 },
  { sku: 'MOU-LOG-002', name: 'Mouse Logitech MX Master 3S', description: 'Mouse sem fio ergonômico, 8000 DPI', priceCents: 69900, stockQuantity: 75 },
  { sku: 'HEAD-JBL-001', name: 'Headset JBL Quantum 400', description: 'Headset gamer com microfone, USB', priceCents: 49900, stockQuantity: 50 },
  { sku: 'WCAM-LOG-001', name: 'Webcam Logitech C920', description: 'Webcam Full HD 1080p com microfone', priceCents: 54900, stockQuantity: 35 },
  { sku: 'DOCK-DEL-001', name: 'Dock Station Dell WD19', description: 'Dock station USB-C 130W', priceCents: 169900, stockQuantity: 14 },
  { sku: 'SSD-SAM-001', name: 'SSD Samsung 980 Pro 1TB', description: 'SSD NVMe M.2 PCIe 4.0', priceCents: 89900, stockQuantity: 80 },
  { sku: 'RAM-CRU-001', name: 'Memória Crucial 16GB DDR4', description: 'Memória RAM DDR4 3200MHz', priceCents: 32900, stockQuantity: 100 },
  { sku: 'CABO-USC-001', name: 'Cabo USB-C 2m Anker', description: 'Cabo USB-C para USB-C 100W', priceCents: 12900, stockQuantity: 200 },
  { sku: 'HUB-AN-001', name: 'Hub USB-C Anker 7 em 1', description: 'Hub multifuncional USB-C 7 portas', priceCents: 29900, stockQuantity: 45 },
  { sku: 'SUP-NB-001', name: 'Suporte para Notebook Ergonômico', description: 'Suporte ajustável de alumínio', priceCents: 15900, stockQuantity: 90 },
  { sku: 'CAD-FX-001', name: 'Cadeira Ergonômica FlexForm', description: 'Cadeira de escritório com apoio lombar', priceCents: 219900, stockQuantity: 22 },
  { sku: 'IMP-HP-001', name: 'Impressora HP LaserJet Pro', description: 'Impressora laser monocromática', priceCents: 159900, stockQuantity: 16 },
  { sku: 'TONER-HP-001', name: 'Toner HP 105A Original', description: 'Toner preto para LaserJet', priceCents: 39900, stockQuantity: 70 },
  { sku: 'PAP-A4-001', name: 'Resma Papel A4 Chamex 500fl', description: 'Papel sulfite A4 75g', priceCents: 3290, stockQuantity: 300 },
  { sku: 'NOB-MOL-001', name: 'Caderno Moleskine Clássico', description: 'Caderno capa dura, 240 páginas', priceCents: 14900, stockQuantity: 120 },
  { sku: 'PEN-PLT-001', name: 'Caneta Pilot G2 Pretra', description: 'Caneta gel 0.7mm — caixa com 12', priceCents: 7990, stockQuantity: 250 },
];

async function reserveOrderNumber(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const seq = await tx.orderNumberSequence.upsert({
      where: { id: 1 },
      create: { id: 1, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
    const current = seq.nextValue - 1;
    return `ORD-${String(current).padStart(6, '0')}`;
  });
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Cleaning existing data...');
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.orderNumberSequence.deleteMany();

  // eslint-disable-next-line no-console
  console.log('Seeding users...');
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const operatorPasswordHash = await bcrypt.hash(OPERATOR_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@oms.local',
      name: 'Administrador do Sistema',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: 'operador@oms.local',
      name: 'Operador Padrão',
      passwordHash: operatorPasswordHash,
      role: UserRole.OPERATOR,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeding customers...');
  const customers = await Promise.all(
    customersSeed.map((c) => prisma.customer.create({ data: c })),
  );

  // eslint-disable-next-line no-console
  console.log('Seeding products...');
  const products = await Promise.all(
    productsSeed.map((p) => prisma.product.create({ data: p })),
  );

  // eslint-disable-next-line no-console
  console.log('Seeding orders...');
  const ordersPlan: { status: OrderStatus; itemIdxs: number[]; quantities: number[] }[] = [
    { status: OrderStatus.PENDING, itemIdxs: [0, 4], quantities: [1, 2] },
    { status: OrderStatus.PENDING, itemIdxs: [5], quantities: [3] },
    { status: OrderStatus.PENDING, itemIdxs: [10, 11], quantities: [2, 4] },
    { status: OrderStatus.PENDING, itemIdxs: [13], quantities: [2] },
    { status: OrderStatus.PAID, itemIdxs: [1, 3], quantities: [1, 1] },
    { status: OrderStatus.PAID, itemIdxs: [6, 7], quantities: [2, 2] },
    { status: OrderStatus.PAID, itemIdxs: [2], quantities: [1] },
    { status: OrderStatus.PAID, itemIdxs: [14], quantities: [1] },
    { status: OrderStatus.PAID, itemIdxs: [4, 5], quantities: [1, 1] },
    { status: OrderStatus.PROCESSING, itemIdxs: [0, 9], quantities: [1, 2] },
    { status: OrderStatus.PROCESSING, itemIdxs: [15, 16], quantities: [1, 3] },
    { status: OrderStatus.PROCESSING, itemIdxs: [12], quantities: [4] },
    { status: OrderStatus.PROCESSING, itemIdxs: [18, 19], quantities: [10, 20] },
    { status: OrderStatus.SHIPPED, itemIdxs: [1], quantities: [1] },
    { status: OrderStatus.SHIPPED, itemIdxs: [3, 4], quantities: [1, 2] },
    { status: OrderStatus.SHIPPED, itemIdxs: [8], quantities: [1] },
    { status: OrderStatus.SHIPPED, itemIdxs: [17], quantities: [50] },
    { status: OrderStatus.DELIVERED, itemIdxs: [0], quantities: [1] },
    { status: OrderStatus.DELIVERED, itemIdxs: [2, 5], quantities: [2, 1] },
    { status: OrderStatus.DELIVERED, itemIdxs: [7, 11], quantities: [1, 4] },
    { status: OrderStatus.DELIVERED, itemIdxs: [14], quantities: [1] },
    { status: OrderStatus.DELIVERED, itemIdxs: [10, 13], quantities: [2, 1] },
    { status: OrderStatus.DELIVERED, itemIdxs: [4, 5, 11], quantities: [1, 1, 2] },
    { status: OrderStatus.CANCELLED, itemIdxs: [1], quantities: [1] },
    { status: OrderStatus.CANCELLED, itemIdxs: [15], quantities: [1] },
    { status: OrderStatus.CANCELLED, itemIdxs: [3, 4], quantities: [1, 1] },
  ];

  const flowFromStatus: Record<OrderStatus, OrderStatus[]> = {
    PENDING: [],
    PAID: [OrderStatus.PENDING],
    PROCESSING: [OrderStatus.PENDING, OrderStatus.PAID],
    SHIPPED: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING],
    DELIVERED: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED],
    CANCELLED: [OrderStatus.PENDING],
  };

  for (let i = 0; i < ordersPlan.length; i++) {
    const plan = ordersPlan[i]!;
    const customer = customers[i % customers.length]!;
    const author = i % 3 === 0 ? admin : operator;

    const items = plan.itemIdxs.map((idx, j) => {
      const product = products[idx]!;
      const quantity = plan.quantities[j]!;
      const unitPriceCents = product.priceCents;
      return {
        product,
        quantity,
        unitPriceCents,
        totalCents: unitPriceCents * quantity,
      };
    });

    const subtotalCents = items.reduce((sum, it) => sum + it.totalCents, 0);
    const discountCents = i % 7 === 0 ? Math.floor(subtotalCents * 0.05) : 0;
    const totalCents = subtotalCents - discountCents;

    const orderNumber = await reserveOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: plan.status,
        subtotalCents,
        discountCents,
        totalCents,
        createdById: author.id,
        items: {
          create: items.map((it) => ({
            productId: it.product.id,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            totalCents: it.totalCents,
          })),
        },
      },
    });

    const path = [...flowFromStatus[plan.status], plan.status];
    let prev: OrderStatus | null = null;
    for (const s of path) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: prev,
          toStatus: s,
          changedById: author.id,
          reason: prev === null ? null : `seed transition ${prev}->${s}`,
        },
      });
      prev = s;
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed completed.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
