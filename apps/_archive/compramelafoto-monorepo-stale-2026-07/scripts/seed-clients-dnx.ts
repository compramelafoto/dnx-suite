import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Iniciando seed de clientes para DNX Estudio...");

  // 1) Buscar o crear el fotógrafo DNX Estudio
  let photographer = await prisma.user.findFirst({
    where: {
      role: "PHOTOGRAPHER",
      name: { contains: "DNX", mode: "insensitive" },
    },
  });

  if (!photographer) {
    // Crear fotógrafo DNX Estudio si no existe
    photographer = await prisma.user.create({
      data: {
        email: `dnx-estudio-${Date.now()}@example.com`, // Email único
        name: "DNX Estudio",
        role: "PHOTOGRAPHER",
        preferredLabId: 1, // DNX Estudio como laboratorio preferido
      },
    });
    console.log("✅ Fotógrafo DNX Estudio creado:", { id: photographer.id, name: photographer.name });
  } else {
    console.log("✅ Fotógrafo DNX Estudio encontrado:", { id: photographer.id, name: photographer.name });
  }

  const photographerId = photographer.id;
  const labId = 1; // DNX Estudio como laboratorio

  // 2) Obtener precios base para calcular totales
  const basePrices = await prisma.labBasePrice.findMany({
    where: { labId, isActive: true },
  });

  const priceBySize = new Map(basePrices.map((bp) => [bp.size, bp.unitPrice]));

  // 3) Crear varios clientes con pedidos
  const clientesData = [
    {
      name: "María González",
      email: "maria.gonzalez@email.com",
      phone: "+54 9 11 1234-5678",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 30, acabado: "BRILLO", fileKey: "foto1.jpg", originalName: "foto1.jpg" },
            { size: "15x20", quantity: 15, acabado: "MATE", fileKey: "foto2.jpg", originalName: "foto2.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-01-15"),
        },
        {
          items: [
            { size: "13x18", quantity: 50, acabado: "BRILLO", fileKey: "foto3.jpg", originalName: "foto3.jpg" },
          ],
          status: "READY_TO_PICKUP" as const,
          createdAt: new Date("2024-12-10"),
        },
      ],
    },
    {
      name: "Juan Pérez",
      email: "juan.perez@email.com",
      phone: "+54 9 11 2345-6789",
      orders: [
        {
          items: [
            { size: "15x20", quantity: 100, acabado: "BRILLO", fileKey: "foto4.jpg", originalName: "foto4.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-02-20"),
        },
      ],
    },
    {
      name: "Ana Martínez",
      email: "ana.martinez@email.com",
      phone: "+54 9 11 3456-7890",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 25, acabado: "MATE", fileKey: "foto5.jpg", originalName: "foto5.jpg" },
            { size: "13x18", quantity: 20, acabado: "BRILLO", fileKey: "foto6.jpg", originalName: "foto6.jpg" },
            { size: "15x20", quantity: 10, acabado: "BRILLO", fileKey: "foto7.jpg", originalName: "foto7.jpg" },
          ],
          status: "IN_PRODUCTION" as const,
          createdAt: new Date("2024-12-15"),
        },
      ],
    },
    {
      name: "Carlos Rodríguez",
      email: "carlos.rodriguez@email.com",
      phone: "+54 9 11 4567-8901",
      orders: [
        {
          items: [
            { size: "10x15", quantity: 80, acabado: "BRILLO", fileKey: "foto8.jpg", originalName: "foto8.jpg" },
          ],
          status: "SHIPPED" as const,
          createdAt: new Date("2024-11-05"),
        },
        {
          items: [
            { size: "13x18", quantity: 40, acabado: "MATE", fileKey: "foto9.jpg", originalName: "foto9.jpg" },
          ],
          status: "READY" as const,
          createdAt: new Date("2024-12-08"),
        },
      ],
    },
    {
      name: "Laura Fernández",
      email: "laura.fernandez@email.com",
      phone: "+54 9 11 5678-9012",
      orders: [
        {
          items: [
            { size: "15x20", quantity: 60, acabado: "BRILLO", fileKey: "foto10.jpg", originalName: "foto10.jpg" },
            { size: "10x15", quantity: 50, acabado: "MATE", fileKey: "foto11.jpg", originalName: "foto11.jpg" },
          ],
          status: "DELIVERED" as const,
          createdAt: new Date("2024-03-10"),
        },
      ],
    },
  ];

  // 4) Obtener descuentos para calcular precios correctos
  const discounts = await prisma.labSizeDiscount.findMany({
    where: { labId, isActive: true },
  });

  function calculateItemPrice(size: string, quantity: number): number {
    const basePrice = priceBySize.get(size) || 0;
    const discount = discounts.find((d) => d.size === size && d.minQty <= quantity);
    const discountPercent = discount?.discountPercent || 0;
    const discountedPrice = basePrice * (1 - discountPercent / 100);
    return Math.round(discountedPrice * quantity); // Total en pesos
  }

  let totalOrdersCreated = 0;

  // 5) Crear pedidos para cada cliente
  for (const clienteData of clientesData) {
    for (const orderData of clienteData.orders) {
      let orderTotal = 0;

      // Calcular total del pedido
      for (const item of orderData.items) {
        orderTotal += calculateItemPrice(item.size, item.quantity);
      }

      // Crear pedido
      const order = await prisma.printOrder.create({
        data: {
          labId,
          photographerId,
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
            create: orderData.items.map((item) => {
              const basePrice = priceBySize.get(item.size) || 0;
              // Calcular la cantidad total de ese tamaño en el pedido
              const totalQtyForSize = orderData.items
                .filter((i) => i.size === item.size)
                .reduce((sum, i) => sum + i.quantity, 0);
              // Buscar descuento apropiado
              const applicableDiscounts = discounts
                .filter((d) => d.size === item.size && d.minQty <= totalQtyForSize)
                .sort((a, b) => b.minQty - a.minQty); // Mayor descuento primero
              const discountPercent = applicableDiscounts[0]?.discountPercent || 0;
              const unitPrice = Math.round(basePrice * (1 - discountPercent / 100));
              const subtotal = unitPrice * item.quantity;

              return {
                fileKey: item.fileKey,
                originalName: item.originalName,
                size: item.size,
                acabado: item.acabado,
                quantity: item.quantity,
                unitPrice,
                subtotal,
              };
            }),
          },
        },
      });

      totalOrdersCreated++;
      console.log(`  ✓ Pedido creado para ${clienteData.name} (${orderData.items.length} items, Total: $${orderTotal.toFixed(2)})`);
    }
  }

  console.log("\n✅ Seed completado exitosamente!");
  console.log(`📊 Resumen:`);
  console.log(`   - Fotógrafo: ${photographer.name} (ID: ${photographerId})`);
  console.log(`   - Clientes creados: ${clientesData.length}`);
  console.log(`   - Pedidos creados: ${totalOrdersCreated}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
