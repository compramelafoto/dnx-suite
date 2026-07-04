import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Iniciando seed de clientes para fotógrafo...");

  // 1) Buscar o crear un fotógrafo de ejemplo
  let photographer = await prisma.user.findFirst({
    where: {
      role: "PHOTOGRAPHER",
    },
  });

  if (!photographer) {
    // Crear fotógrafo de ejemplo si no existe ninguno
    photographer = await prisma.user.create({
      data: {
        email: `fotografo-${Date.now()}@example.com`,
        name: "Estudio Fotográfico Ejemplo",
        role: "PHOTOGRAPHER",
        preferredLabId: 1,
      },
    });
    console.log("✅ Fotógrafo creado:", { id: photographer.id, name: photographer.name });
  } else {
    console.log("✅ Fotógrafo encontrado:", { id: photographer.id, name: photographer.name });
  }

  const photographerId = photographer.id;
  const labId = 1; // DNX Estudio como laboratorio

  // 2) Obtener precios base del laboratorio
  const basePrices = await prisma.labBasePrice.findMany({
    where: { labId, isActive: true },
  });

  const priceBySize = new Map(basePrices.map((bp) => [bp.size, bp.unitPrice]));

  // 3) Obtener descuentos
  const discounts = await prisma.labSizeDiscount.findMany({
    where: { labId, isActive: true },
  });

  // Función para calcular precio con descuento
  function calculatePriceWithDiscount(size: string, totalQtyForSize: number): number {
    const basePrice = priceBySize.get(size) || 0;
    const applicableDiscounts = discounts
      .filter((d) => d.size === size && d.minQty <= totalQtyForSize)
      .sort((a, b) => b.minQty - a.minQty);
    const discountPercent = applicableDiscounts[0]?.discountPercent || 0;
    return Math.round(basePrice * (1 - discountPercent / 100));
  }

  // 4) Datos de clientes con múltiples pedidos para que aparezcan como clientes históricos
  const clientesData = [
    {
      name: "Sofía López",
      email: "sofia.lopez@email.com",
      phone: "+54 9 11 1111-1111",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 25, acabado: "BRILLO", fileKey: "foto_sofia_1.jpg", originalName: "evento_2024_01.jpg" },
            { size: "13x18", quantity: 15, acabado: "BRILLO", fileKey: "foto_sofia_2.jpg", originalName: "evento_2024_02.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-01-20T10:00:00Z"),
        },
        {
          items: [
            { size: "15x20", quantity: 30, acabado: "MATE", fileKey: "foto_sofia_3.jpg", originalName: "evento_2024_06.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-06-15T14:30:00Z"),
        },
        {
          items: [
            { size: "10x15", quantity: 50, acabado: "BRILLO", fileKey: "foto_sofia_4.jpg", originalName: "evento_2024_11.jpg" },
            { size: "13x18", quantity: 20, acabado: "MATE", fileKey: "foto_sofia_5.jpg", originalName: "evento_2024_12.jpg" },
          ],
          status: "READY_TO_PICKUP" as const,
          createdAt: new Date("2024-12-10T09:00:00Z"),
        },
      ],
    },
    {
      name: "Roberto Martínez",
      email: "roberto.martinez@email.com",
      phone: "+54 9 11 2222-2222",
      orders: [
        {
          items: [
            { size: "15x20", quantity: 100, acabado: "BRILLO", fileKey: "foto_roberto_1.jpg", originalName: "casamiento_2024.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-03-10T11:00:00Z"),
        },
        {
          items: [
            { size: "13x18", quantity: 80, acabado: "BRILLO", fileKey: "foto_roberto_2.jpg", originalName: "cumple_2024.jpg" },
          ],
          status: "SHIPPED" as const,
          createdAt: new Date("2024-09-20T16:00:00Z"),
        },
      ],
    },
    {
      name: "Elena Rodríguez",
      email: "elena.rodriguez@email.com",
      phone: "+54 9 11 3333-3333",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 60, acabado: "MATE", fileKey: "foto_elena_1.jpg", originalName: "graduacion_2024.jpg" },
            { size: "13x18", quantity: 40, acabado: "BRILLO", fileKey: "foto_elena_2.jpg", originalName: "graduacion_2024_2.jpg" },
            { size: "15x20", quantity: 25, acabado: "BRILLO", fileKey: "foto_elena_3.jpg", originalName: "graduacion_2024_3.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-04-05T12:00:00Z"),
        },
        {
          items: [
            { size: "10x15", quantity: 100, acabado: "BRILLO", fileKey: "foto_elena_4.jpg", originalName: "navidad_2024.jpg" },
          ],
          status: "IN_PRODUCTION" as const,
          createdAt: new Date("2024-12-15T10:00:00Z"),
        },
      ],
    },
    {
      name: "Miguel Sánchez",
      email: "miguel.sanchez@email.com",
      phone: "+54 9 11 4444-4444",
      orders: [
        {
          items: [
            { size: "13x18", quantity: 35, acabado: "MATE", fileKey: "foto_miguel_1.jpg", originalName: "viaje_2024.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-02-28T15:00:00Z"),
        },
        {
          items: [
            { size: "15x20", quantity: 50, acabado: "BRILLO", fileKey: "foto_miguel_2.jpg", originalName: "familia_2024.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-07-12T13:00:00Z"),
        },
        {
          items: [
            { size: "10x15", quantity: 75, acabado: "MATE", fileKey: "foto_miguel_3.jpg", originalName: "reunion_2024.jpg" },
            { size: "13x18", quantity: 45, acabado: "BRILLO", fileKey: "foto_miguel_4.jpg", originalName: "reunion_2024_2.jpg" },
          ],
          status: "READY" as const,
          createdAt: new Date("2024-11-25T09:00:00Z"),
        },
      ],
    },
    {
      name: "Valentina Fernández",
      email: "valentina.fernandez@email.com",
      phone: "+54 9 11 5555-5555",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 20, acabado: "BRILLO", fileKey: "foto_valentina_1.jpg", originalName: "bautismo_2024.jpg" },
            { size: "15x20", quantity: 10, acabado: "MATE", fileKey: "foto_valentina_2.jpg", originalName: "bautismo_2024_2.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-05-18T10:30:00Z"),
        },
      ],
    },
    {
      name: "Diego García",
      email: "diego.garcia@email.com",
      phone: "+54 9 11 6666-6666",
      orders: [
        {
          items: [
            { size: "13x18", quantity: 55, acabado: "BRILLO", fileKey: "foto_diego_1.jpg", originalName: "deportes_2024.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-08-30T14:00:00Z"),
        },
        {
          items: [
            { size: "10x15", quantity: 90, acabado: "MATE", fileKey: "foto_diego_2.jpg", originalName: "deportes_2024_2.jpg" },
            { size: "15x20", quantity: 70, acabado: "BRILLO", fileKey: "foto_diego_3.jpg", originalName: "deportes_2024_3.jpg" },
          ],
          status: "SHIPPED" as const,
          createdAt: new Date("2024-10-15T11:00:00Z"),
        },
      ],
    },
    {
      name: "Carmen Torres",
      email: "carmen.torres@email.com",
      phone: "+54 9 11 7777-7777",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 40, acabado: "BRILLO", fileKey: "foto_carmen_1.jpg", originalName: "empresa_2024.jpg" },
            { size: "13x18", quantity: 30, acabado: "BRILLO", fileKey: "foto_carmen_2.jpg", originalName: "empresa_2024_2.jpg" },
            { size: "15x20", quantity: 20, acabado: "MATE", fileKey: "foto_carmen_3.jpg", originalName: "empresa_2024_3.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-01-10T09:00:00Z"),
        },
        {
          items: [
            { size: "13x18", quantity: 65, acabado: "BRILLO", fileKey: "foto_carmen_4.jpg", originalName: "empresa_2024_4.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-05-22T13:00:00Z"),
        },
      ],
    },
    {
      name: "Lucas Morales",
      email: "lucas.morales@email.com",
      phone: "+54 9 11 8888-8888",
      orders: [
        {
          items: [
            { size: "15x20", quantity: 85, acabado: "BRILLO", fileKey: "foto_lucas_1.jpg", originalName: "evento_2024.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-04-12T10:00:00Z"),
        },
        {
          items: [
            { size: "10x15", quantity: 120, acabado: "MATE", fileKey: "foto_lucas_2.jpg", originalName: "evento_2024_2.jpg" },
          ],
          status: "IN_PRODUCTION" as const,
          createdAt: new Date("2024-12-18T08:00:00Z"),
        },
      ],
    },
    {
      name: "Isabella Ramírez",
      email: "isabella.ramirez@email.com",
      phone: "+54 9 11 9999-9999",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 30, acabado: "BRILLO", fileKey: "foto_isabella_1.jpg", originalName: "quince_2024.jpg" },
            { size: "13x18", quantity: 25, acabado: "BRILLO", fileKey: "foto_isabella_2.jpg", originalName: "quince_2024_2.jpg" },
            { size: "15x20", quantity: 15, acabado: "MATE", fileKey: "foto_isabella_3.jpg", originalName: "quince_2024_3.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-06-20T16:00:00Z"),
        },
        {
          items: [
            { size: "13x18", quantity: 50, acabado: "BRILLO", fileKey: "foto_isabella_4.jpg", originalName: "evento_extra_2024.jpg" },
          ],
          status: "READY_TO_PICKUP" as const,
          createdAt: new Date("2024-12-05T12:00:00Z"),
        },
      ],
    },
    {
      name: "Andrés Castro",
      email: "andres.castro@email.com",
      phone: "+54 9 11 1010-1010",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 45, acabado: "MATE", fileKey: "foto_andres_1.jpg", originalName: "trabajo_2024.jpg" },
            { size: "15x20", quantity: 30, acabado: "BRILLO", fileKey: "foto_andres_2.jpg", originalName: "trabajo_2024_2.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-03-25T11:00:00Z"),
        },
      ],
    },
  ];

  let totalOrdersCreated = 0;
  let totalClientsCreated = 0;

  // 5) Crear pedidos para cada cliente
  for (const clienteData of clientesData) {
    let hasOrders = false;
    
    for (const orderData of clienteData.orders) {
      // Calcular totales por tamaño para aplicar descuentos correctamente
      const qtyBySize = new Map<string, number>();
      for (const item of orderData.items) {
        const currentQty = qtyBySize.get(item.size) || 0;
        qtyBySize.set(item.size, currentQty + item.quantity);
      }

      // Calcular total del pedido
      let orderTotal = 0;
      const itemsToCreate = orderData.items.map((item) => {
        const totalQtyForSize = qtyBySize.get(item.size) || item.quantity;
        const unitPrice = calculatePriceWithDiscount(item.size, totalQtyForSize);
        const subtotal = unitPrice * item.quantity;
        orderTotal += subtotal;

        return {
          fileKey: item.fileKey,
          originalName: item.originalName,
          size: item.size,
          acabado: item.acabado,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        };
      });

      // Crear pedido vinculado al fotógrafo
      const order = await prisma.printOrder.create({
        data: {
          labId,
          photographerId, // IMPORTANTE: Vinculado al fotógrafo
          customerName: clienteData.name,
          customerEmail: clienteData.email,
          customerPhone: clienteData.phone,
          pickupBy: "CLIENT",
          status: orderData.status,
          currency: "ARS",
          total: orderTotal,
          createdAt: orderData.createdAt,
          statusUpdatedAt: orderData.createdAt,
          items: {
            create: itemsToCreate,
          },
        },
      });

      totalOrdersCreated++;
      hasOrders = true;
      console.log(`  ✓ Pedido #${order.id} para ${clienteData.name} (${orderData.items.length} items, Total: $${orderTotal.toFixed(2)})`);
    }
    
    if (hasOrders) {
      totalClientsCreated++;
    }
  }

  console.log("\n✅ Seed completado exitosamente!");
  console.log(`📊 Resumen:`);
  console.log(`   - Fotógrafo: ${photographer.name} (ID: ${photographerId})`);
  console.log(`   - Clientes únicos: ${totalClientsCreated}`);
  console.log(`   - Pedidos creados: ${totalOrdersCreated}`);
  console.log(`\n💡 Estos clientes aparecerán en la tabla de clientes del panel del fotógrafo.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
