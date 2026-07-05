import { prisma } from "../lib/prisma";

function percentFrom(base: number, discounted: number) {
  return ((base - discounted) / base) * 100;
}

async function main() {
  console.log("🚀 Iniciando seed de precios del laboratorio...");

  // 0) Crear/actualizar el laboratorio si no existe
  console.log("📦 Creando/actualizando laboratorio...");
  const lab = await prisma.lab.upsert({
    where: { id: 1 },
    update: {
      name: "DNX Estudio",
      email: "contacto@dnxestudio.com",
      phone: "+54 11 1234-5678",
      isActive: true,
    },
    create: {
      id: 1,
      name: "DNX Estudio",
      email: "contacto@dnxestudio.com",
      phone: "+54 11 1234-5678",
      country: "Argentina",
      isActive: true,
    },
  });

  console.log("✅ Laboratorio creado/actualizado:", { id: lab.id, name: lab.name });

  const LAB_ID = lab.id;

  // precios base
  const base = [
    { size: "10x15", unitPrice: 1300 },
    { size: "13x18", unitPrice: 1900 },
    { size: "15x20", unitPrice: 2200 },
  ];

  // precios “referencia” para generar % (como tu cartel)
  const ref = [
    { size: "10x15", p50: 1000, p100: 900 },
    { size: "13x18", p50: 1600, p100: 1300 },
    { size: "15x20", p50: 1900, p100: 1500 },
  ];

  // 1) Base prices
  console.log("💰 Cargando precios base...");
  for (const b of base) {
    const created = await prisma.labBasePrice.upsert({
      where: { labId_size: { labId: LAB_ID, size: b.size } },
      update: { unitPrice: b.unitPrice, currency: "ARS", isActive: true },
      create: { labId: LAB_ID, size: b.size, unitPrice: b.unitPrice, currency: "ARS", isActive: true },
    });
    console.log(`  ✓ ${b.size}: $${b.unitPrice}`);
  }

  // 2) Discounts por tamaño (50 y 100)
  console.log("🎁 Cargando descuentos por cantidad...");
  for (const r of ref) {
    const basePrice = base.find((x) => x.size === r.size)!.unitPrice;

    const d50 = percentFrom(basePrice, r.p50);
    const d100 = percentFrom(basePrice, r.p100);

    for (const row of [
      { minQty: 50, discountPercent: d50 },
      { minQty: 100, discountPercent: d100 },
    ]) {
      for (const priceType of ["PROFESSIONAL", "PUBLIC"] as const) {
        await prisma.labSizeDiscount.upsert({
          where: { labId_size_minQty_priceType: { labId: LAB_ID, size: r.size, minQty: row.minQty, priceType } },
          update: { discountPercent: row.discountPercent, isActive: true },
          create: { labId: LAB_ID, size: r.size, minQty: row.minQty, discountPercent: row.discountPercent, priceType, isActive: true },
        });
      }
      console.log(`  ✓ ${r.size} (${row.minQty}+): ${row.discountPercent.toFixed(2)}% OFF`);
    }
  }

  console.log("\n✅ Seed completado exitosamente!");
  console.log(`📊 Resumen:`);
  console.log(`   - Laboratorio: ${lab.name} (ID: ${lab.id})`);
  console.log(`   - Precios base: ${base.length} tamaños`);
  console.log(`   - Descuentos: ${ref.length * 2} configuraciones`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
