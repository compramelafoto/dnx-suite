import { PrismaClient, Role, LabApprovalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed completo de datos de prueba...\n");

  const defaultPassword = "123456";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // ============================================
  // 1. CREAR ADMIN
  // ============================================
  console.log("📋 Paso 1: Creando usuario ADMIN...");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@compramelafoto.com";
  const adminPassword = process.env.ADMIN_PASSWORD || defaultPassword;
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPasswordHash,
      role: Role.ADMIN,
      name: "Admin",
    },
    create: {
      email: adminEmail,
      password: adminPasswordHash,
      role: Role.ADMIN,
      name: "Admin",
    },
  });
  console.log(`   ✅ ADMIN: ${admin.email} (Password: ${adminPassword})\n`);

  // ============================================
  // 2. CREAR CONFIGURACIÓN DE LA APP
  // ============================================
  console.log("📋 Paso 2: Creando configuración de la app...");
  const appConfig = await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {
      minDigitalPhotoPrice: 5000, // $5000 ARS
      platformCommissionPercent: 10,
    },
    create: {
      id: 1,
      minDigitalPhotoPrice: 5000, // $5000 ARS
      platformCommissionPercent: 10,
    },
  });
  console.log(`   ✅ Configuración creada (Precio mínimo digital: $${appConfig.minDigitalPhotoPrice})\n`);

  // ============================================
  // 3. CREAR LABORATORIO Y USUARIO LAB
  // ============================================
  console.log("📋 Paso 3: Creando laboratorio...");
  const labUser = await prisma.user.upsert({
    where: { email: "lab@compramelafoto.com" },
    update: {
      password: passwordHash,
      role: Role.LAB,
      name: "DNX Estudio",
    },
    create: {
      email: "lab@compramelafoto.com",
      password: passwordHash,
      role: Role.LAB,
      name: "DNX Estudio",
    },
  });

  const lab = await prisma.lab.upsert({
    where: { userId: labUser.id },
    update: {
      name: "DNX Estudio",
      email: "contacto@dnxestudio.com",
      phone: "+54 11 1234-5678",
      address: "Av. Ejemplo 123",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      approvalStatus: LabApprovalStatus.APPROVED,
      isActive: true,
    },
    create: {
      id: 1,
      name: "DNX Estudio",
      email: "contacto@dnxestudio.com",
      phone: "+54 11 1234-5678",
      address: "Av. Ejemplo 123",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      userId: labUser.id,
      approvalStatus: LabApprovalStatus.APPROVED,
      isActive: true,
    },
  });
  console.log(`   ✅ Laboratorio: ${lab.name} (Email: lab@compramelafoto.com, Password: ${defaultPassword})\n`);

  // ============================================
  // 4. CREAR PRECIOS DEL LABORATORIO
  // ============================================
  console.log("📋 Paso 4: Creando precios del laboratorio...");
  
  function percentFrom(base: number, discounted: number) {
    return ((base - discounted) / base) * 100;
  }

  const basePrices = [
    { size: "10x15", unitPrice: 1300 },
    { size: "13x18", unitPrice: 1900 },
    { size: "15x20", unitPrice: 2200 },
  ];

  const refPrices = [
    { size: "10x15", p50: 1000, p100: 900 },
    { size: "13x18", p50: 1600, p100: 1300 },
    { size: "15x20", p50: 1900, p100: 1500 },
  ];

  for (const bp of basePrices) {
    await prisma.labBasePrice.upsert({
      where: { labId_size: { labId: lab.id, size: bp.size } },
      update: { unitPrice: bp.unitPrice, currency: "ARS", isActive: true },
      create: { labId: lab.id, size: bp.size, unitPrice: bp.unitPrice, currency: "ARS", isActive: true },
    });
  }

  for (const rp of refPrices) {
    const basePrice = basePrices.find((x) => x.size === rp.size)!.unitPrice;
    const d50 = percentFrom(basePrice, rp.p50);
    const d100 = percentFrom(basePrice, rp.p100);

    for (const discount of [
      { minQty: 50, discountPercent: d50 },
      { minQty: 100, discountPercent: d100 },
    ]) {
      for (const priceType of ["PROFESSIONAL", "PUBLIC"] as const) {
        await prisma.labSizeDiscount.upsert({
          where: { labId_size_minQty_priceType: { labId: lab.id, size: rp.size, minQty: discount.minQty, priceType } },
          update: { discountPercent: discount.discountPercent, isActive: true },
          create: { labId: lab.id, size: rp.size, minQty: discount.minQty, discountPercent: discount.discountPercent, priceType, isActive: true },
        });
      }
    }
  }
  console.log(`   ✅ Precios base y descuentos creados\n`);

  // ============================================
  // 5. CREAR FOTÓGRAFO DE PRUEBA
  // ============================================
  console.log("📋 Paso 5: Creando fotógrafo de prueba...");
  const photographer = await prisma.user.upsert({
    where: { email: "fotografo@compramelafoto.com" },
    update: {
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "Juan Fotógrafo",
      phone: "+54 11 9876-5432",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      preferredLabId: lab.id,
      profitMarginPercent: 300,
      defaultDigitalPhotoPrice: 5000,
      digitalDiscountsEnabled: true,
      digitalDiscount5Plus: 5,
      digitalDiscount10Plus: 10,
      digitalDiscount20Plus: 15,
      website: "https://juanfoto.com",
      instagram: "@juanfoto",
      facebook: "juanfoto",
      whatsapp: "+5491198765432",
      companyAddress: "Av. Fotografía 456, Buenos Aires",
      isPublicPageEnabled: true,
      publicPageHandler: "juanfoto",
      enableAlbumsPage: true,
      enablePrintPage: true,
    },
    create: {
      email: "fotografo@compramelafoto.com",
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "Juan Fotógrafo",
      phone: "+54 11 9876-5432",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      preferredLabId: lab.id,
      profitMarginPercent: 300,
      defaultDigitalPhotoPrice: 5000,
      digitalDiscountsEnabled: true,
      digitalDiscount5Plus: 5,
      digitalDiscount10Plus: 10,
      digitalDiscount20Plus: 15,
      website: "https://juanfoto.com",
      instagram: "@juanfoto",
      facebook: "juanfoto",
      whatsapp: "+5491198765432",
      companyAddress: "Av. Fotografía 456, Buenos Aires",
      isPublicPageEnabled: true,
      publicPageHandler: "juanfoto",
      enableAlbumsPage: true,
      enablePrintPage: true,
    },
  });
  console.log(`   ✅ Fotógrafo: ${photographer.email} (Password: ${defaultPassword})\n`);

  // ============================================
  // 6. CREAR CLIENTE DE PRUEBA
  // ============================================
  console.log("📋 Paso 6: Creando cliente de prueba...");
  const customer = await prisma.user.upsert({
    where: { email: "cliente@compramelafoto.com" },
    update: {
      password: passwordHash,
      role: Role.CUSTOMER,
      name: "María Cliente",
      phone: "+54 11 5555-1234",
    },
    create: {
      email: "cliente@compramelafoto.com",
      password: passwordHash,
      role: Role.CUSTOMER,
      name: "María Cliente",
      phone: "+54 11 5555-1234",
    },
  });
  console.log(`   ✅ Cliente: ${customer.email} (Password: ${defaultPassword})\n`);

  // ============================================
  // 7. CREAR CLIENTES Y PEDIDOS PARA EL FOTÓGRAFO
  // ============================================
  console.log("📋 Paso 7: Creando clientes y pedidos históricos...");

  function calculatePriceWithDiscount(size: string, totalQtyForSize: number): number {
    const basePrice = basePrices.find((bp) => bp.size === size)?.unitPrice || 0;
    const applicableDiscounts = refPrices
      .filter((rp) => rp.size === size)
      .map((rp) => {
        const base = basePrices.find((x) => x.size === rp.size)!.unitPrice;
        if (totalQtyForSize >= 100) return { minQty: 100, discountPercent: percentFrom(base, rp.p100) };
        if (totalQtyForSize >= 50) return { minQty: 50, discountPercent: percentFrom(base, rp.p50) };
        return null;
      })
      .filter((d): d is { minQty: number; discountPercent: number } => d !== null)
      .sort((a, b) => b.minQty - a.minQty);
    
    const discountPercent = applicableDiscounts[0]?.discountPercent || 0;
    return Math.round(basePrice * (1 - discountPercent / 100));
  }

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
  ];

  let totalOrdersCreated = 0;
  let totalClientsCreated = 0;

  for (const clienteData of clientesData) {
    let hasOrders = false;
    
    for (const orderData of clienteData.orders) {
      const qtyBySize = new Map<string, number>();
      for (const item of orderData.items) {
        const currentQty = qtyBySize.get(item.size) || 0;
        qtyBySize.set(item.size, currentQty + item.quantity);
      }

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

      await prisma.printOrder.create({
        data: {
          labId: lab.id,
          photographerId: photographer.id,
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
    }
    
    if (hasOrders) {
      totalClientsCreated++;
    }
  }
  console.log(`   ✅ ${totalClientsCreated} clientes con ${totalOrdersCreated} pedidos creados\n`);

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log("✨ Seed completo finalizado exitosamente!\n");
  console.log("📋 RESUMEN DE USUARIOS CREADOS:");
  console.log("─".repeat(80));
  console.log(`   ADMIN:`);
  console.log(`   - Email: ${adminEmail}`);
  console.log(`   - Password: ${adminPassword}`);
  console.log(`\n   LABORATORIO:`);
  console.log(`   - Email: lab@compramelafoto.com`);
  console.log(`   - Password: ${defaultPassword}`);
  console.log(`\n   FOTÓGRAFO:`);
  console.log(`   - Email: fotografo@compramelafoto.com`);
  console.log(`   - Password: ${defaultPassword}`);
  console.log(`   - Handler público: juanfoto`);
  console.log(`   - URL pública: /f/juanfoto`);
  console.log(`\n   CLIENTE:`);
  console.log(`   - Email: cliente@compramelafoto.com`);
  console.log(`   - Password: ${defaultPassword}`);
  console.log(`\n📊 DATOS CREADOS:`);
  console.log(`   - Laboratorio: ${lab.name} (ID: ${lab.id})`);
  console.log(`   - Precios base: ${basePrices.length} tamaños`);
  console.log(`   - Descuentos: ${refPrices.length * 2} configuraciones`);
  console.log(`   - Clientes históricos: ${totalClientsCreated}`);
  console.log(`   - Pedidos históricos: ${totalOrdersCreated}`);
  console.log("\n💡 Todos los usuarios tienen la misma contraseña por defecto: 123456");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
