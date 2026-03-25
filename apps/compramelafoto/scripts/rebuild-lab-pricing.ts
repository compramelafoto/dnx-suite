import { prisma } from "../lib/prisma";

/**
 * Script para reconstruir los precios base y descuentos de todos los laboratorios
 * Ejecutar con: npx tsx scripts/rebuild-lab-pricing.ts
 */

// Tamaños comunes de fotos en Argentina
const COMMON_SIZES = [
  "10x15",
  "13x18",
  "15x20",
  "20x25",
  "20x30",
  "30x40",
];

// Precios base por defecto (en ARS)
const DEFAULT_BASE_PRICES: Record<string, number> = {
  "10x15": 1300,
  "13x18": 1900,
  "15x20": 2200,
  "20x25": 3500,
  "20x30": 4500,
  "30x40": 8000,
};

// Descuentos por cantidad (porcentaje)
const DEFAULT_DISCOUNTS = {
  50: 15,  // 15% de descuento por 50+ unidades
  100: 25, // 25% de descuento por 100+ unidades
};

function percentFrom(base: number, discounted: number): number {
  return ((base - discounted) / base) * 100;
}

async function rebuildLabPricing(labId: number) {
  console.log(`\n📦 Procesando laboratorio ID: ${labId}`);

  // Verificar que el laboratorio existe
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: { id: true, name: true, isActive: true },
  });

  if (!lab) {
    console.error(`❌ Laboratorio ID ${labId} no encontrado`);
    return;
  }

  console.log(`   Nombre: ${lab.name}`);
  console.log(`   Activo: ${lab.isActive ? "Sí" : "No"}`);

  // 1) Crear/actualizar precios base para todos los tamaños comunes
  console.log(`\n💰 Creando/actualizando precios base...`);
  let createdBasePrices = 0;
  let updatedBasePrices = 0;

  for (const size of COMMON_SIZES) {
    const unitPrice = DEFAULT_BASE_PRICES[size] || 2000; // Precio por defecto si no está definido

    try {
      const existing = await prisma.labBasePrice.findUnique({
        where: { labId_size: { labId, size } },
      });

      if (existing) {
        // Actualizar si el precio es diferente
        if (existing.unitPrice !== unitPrice) {
          await prisma.labBasePrice.update({
            where: { labId_size: { labId, size } },
            data: { unitPrice, isActive: true },
          });
          updatedBasePrices++;
          console.log(`   ✓ ${size}: $${unitPrice} (actualizado)`);
        } else {
          // Asegurar que esté activo
          if (!existing.isActive) {
            await prisma.labBasePrice.update({
              where: { labId_size: { labId, size } },
              data: { isActive: true },
            });
            console.log(`   ✓ ${size}: $${unitPrice} (reactivado)`);
          } else {
            console.log(`   ✓ ${size}: $${unitPrice} (ya existe)`);
          }
        }
      } else {
        // Crear nuevo precio base
        await prisma.labBasePrice.create({
          data: {
            labId,
            size,
            unitPrice,
            currency: "ARS",
            isActive: true,
          },
        });
        createdBasePrices++;
        console.log(`   ✓ ${size}: $${unitPrice} (creado)`);
      }
    } catch (error: any) {
      console.error(`   ✗ Error con ${size}:`, error.message);
    }
  }

  // 2) Crear/actualizar descuentos por cantidad
  console.log(`\n🎁 Creando/actualizando descuentos por cantidad...`);
  let createdDiscounts = 0;
  let updatedDiscounts = 0;

  const priceTypes = ["PROFESSIONAL", "PUBLIC"] as const;
  for (const priceType of priceTypes) {
    for (const size of COMMON_SIZES) {
      const basePrice = DEFAULT_BASE_PRICES[size] || 2000;

      for (const [minQty, discountPercent] of Object.entries(DEFAULT_DISCOUNTS)) {
        const minQtyNum = Number(minQty);

        try {
          const existing = await prisma.labSizeDiscount.findUnique({
            where: {
              labId_size_minQty_priceType: {
                labId,
                size,
                minQty: minQtyNum,
                priceType,
              },
            },
          });

          if (existing) {
            // Actualizar si el descuento es diferente
            if (Math.abs(existing.discountPercent - discountPercent) > 0.01) {
              await prisma.labSizeDiscount.update({
                where: {
                  labId_size_minQty_priceType: {
                    labId,
                    size,
                    minQty: minQtyNum,
                    priceType,
                  },
                },
                data: { discountPercent, isActive: true },
              });
              updatedDiscounts++;
              console.log(`   ✓ ${size} (${minQty}+) [${priceType}]: ${discountPercent}% OFF (actualizado)`);
            } else {
              // Asegurar que esté activo
              if (!existing.isActive) {
                await prisma.labSizeDiscount.update({
                  where: {
                    labId_size_minQty_priceType: {
                      labId,
                      size,
                      minQty: minQtyNum,
                      priceType,
                    },
                  },
                  data: { isActive: true },
                });
                console.log(`   ✓ ${size} (${minQty}+) [${priceType}]: ${discountPercent}% OFF (reactivado)`);
              } else {
                console.log(`   ✓ ${size} (${minQty}+) [${priceType}]: ${discountPercent}% OFF (ya existe)`);
              }
            }
          } else {
            // Crear nuevo descuento
            await prisma.labSizeDiscount.create({
              data: {
                labId,
                size,
                minQty: minQtyNum,
                discountPercent,
                priceType,
                isActive: true,
              },
            });
            createdDiscounts++;
            console.log(`   ✓ ${size} (${minQty}+) [${priceType}]: ${discountPercent}% OFF (creado)`);
          }
        } catch (error: any) {
          console.error(`   ✗ Error con ${size} (${minQty}+) [${priceType}]:`, error.message);
        }
      }
    }
  }

  console.log(`\n✅ Laboratorio ${lab.name} procesado:`);
  console.log(`   - Precios base: ${createdBasePrices} creados, ${updatedBasePrices} actualizados`);
  console.log(`   - Descuentos: ${createdDiscounts} creados, ${updatedDiscounts} actualizados`);
}

async function main() {
  console.log("🚀 Iniciando reconstrucción de precios de laboratorios...\n");

  // Obtener todos los laboratorios activos
  const labs = await prisma.lab.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (labs.length === 0) {
    console.log("⚠️  No se encontraron laboratorios activos");
    return;
  }

  console.log(`📊 Se encontraron ${labs.length} laboratorio(s) activo(s)\n`);

  // Procesar cada laboratorio
  for (const lab of labs) {
    await rebuildLabPricing(lab.id);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Reconstrucción completada exitosamente!");
  console.log(`📊 Total de laboratorios procesados: ${labs.length}`);
  console.log("=".repeat(60));
}

main()
  .catch((e) => {
    console.error("\n❌ Error durante la reconstrucción:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
