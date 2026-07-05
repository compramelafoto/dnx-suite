/**
 * Auditoría read-only del módulo Equipos Fotográficos (modelo v2).
 *
 * Uso:
 *   npx tsx scripts/audit-photographic-equipment-grouping.ts
 *   npx tsx scripts/audit-photographic-equipment-grouping.ts --photographerId 42
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildGearNormalizedKey,
  normalizeGearMake,
  normalizeGearModel,
} from "@/lib/photographic-equipment/gear-normalize";

function parseArgs(argv: string[]) {
  const photographerIdIdx = argv.indexOf("--photographerId");
  const photographerId =
    photographerIdIdx >= 0 && argv[photographerIdIdx + 1]
      ? Number.parseInt(argv[photographerIdIdx + 1], 10)
      : null;
  return { photographerId: Number.isFinite(photographerId) ? photographerId : null };
}

async function main() {
  const { photographerId } = parseArgs(process.argv.slice(2));
  const photographerFilter = photographerId
    ? Prisma.sql`AND "photographerId" = ${photographerId}`
    : Prisma.empty;

  console.log("=== Auditoría Equipos Fotográficos ===\n");
  if (photographerId) console.log(`Filtro fotógrafo: #${photographerId}\n`);

  const [bodies, lenses, combinations, observations, legacyDevices, skippedExpired] =
    await Promise.all([
      prisma.photographicCameraBody.count({
        where: photographerId ? { photographerId, status: "ACTIVE" } : { status: "ACTIVE" },
      }),
      prisma.photographicLens.count({
        where: photographerId ? { photographerId, status: "ACTIVE" } : { status: "ACTIVE" },
      }),
      prisma.photographicGearCombination.count({
        where: photographerId ? { photographerId } : undefined,
      }),
      prisma.photographicGearObservation.count({
        where: photographerId ? { photographerId } : undefined,
      }),
      prisma.photographerDevice.count({
        where: photographerId ? { photographerId } : undefined,
      }),
      prisma.photo.count({
        where: {
          exifMetadataStatus: "SKIPPED_EXPIRED",
          isRemoved: false,
          ...(photographerId
            ? { OR: [{ userId: photographerId }, { album: { userId: photographerId } }] }
            : {}),
        },
      }),
    ]);

  console.log("Conteos v2:");
  console.log(`  Bodies únicos:     ${bodies}`);
  console.log(`  Lentes únicos:     ${lenses}`);
  console.log(`  Combinaciones:     ${combinations}`);
  console.log(`  Observaciones:     ${observations}`);
  console.log(`  Equipos físicos:   ${bodies + lenses}`);
  console.log(`  Legacy devices:    ${legacyDevices}`);
  console.log(`  Fotos SKIPPED_EXP: ${skippedExpired}\n`);

  const multiLensBodies = await prisma.$queryRaw<
    Array<{ cameraBodyId: number; lensCount: bigint; makeRaw: string; modelRaw: string }>
  >`
    SELECT b.id AS "cameraBodyId",
           b."makeRaw",
           b."modelRaw",
           COUNT(DISTINCT o."lensId")::bigint AS "lensCount"
    FROM "PhotographicCameraBody" b
    INNER JOIN "PhotographicGearObservation" o ON o."cameraBodyId" = b.id
    WHERE b.status = 'ACTIVE'
    ${photographerFilter}
    GROUP BY b.id, b."makeRaw", b."modelRaw"
    HAVING COUNT(DISTINCT o."lensId") > 1
    ORDER BY COUNT(DISTINCT o."lensId") DESC
    LIMIT 20
  `;

  console.log(`Bodies con múltiples lentes (top 20): ${multiLensBodies.length}`);
  for (const row of multiLensBodies) {
    console.log(
      `  Body #${row.cameraBodyId} ${row.makeRaw} ${row.modelRaw} → ${row.lensCount} lentes distintos`
    );
  }
  console.log();

  const legacyBodyLensRows = await prisma.photographerDevice.findMany({
    where: photographerId ? { photographerId } : undefined,
    select: { id: true, brand: true, model: true, lensBrand: true, lensModel: true, photoCount: true },
    take: 50,
    orderBy: { photoCount: "desc" },
  });

  const legacyWithLens = legacyBodyLensRows.filter((d) => d.lensBrand || d.lensModel);
  console.log(
    `Legacy: ${legacyWithLens.length} dispositivos con lente embebido (body+lente como fila única)`
  );
  for (const d of legacyWithLens.slice(0, 10)) {
    console.log(
      `  #${d.id} ${d.brand} ${d.model} + ${d.lensBrand ?? ""} ${d.lensModel ?? ""} (${d.photoCount} fotos)`
    );
  }
  console.log();

  const exifMeta = await prisma.photoExifMetadata.findMany({
    where: {
      status: "ANALYZED",
      ...(photographerId ? { photographerId } : {}),
    },
    select: { make: true, model: true, lensMake: true, lensModel: true, serialNumber: true },
    take: 5000,
  });

  const bodyKeyGroups = new Map<string, Set<string>>();
  for (const row of exifMeta) {
    if (!row.make && !row.model) continue;
    const make = normalizeGearMake(row.make);
    const model = normalizeGearModel(make, row.model);
    const key = buildGearNormalizedKey(0, "body", make, model, row.serialNumber);
    const rawLabel = `${row.make ?? ""}|${row.model ?? ""}|${row.serialNumber ?? ""}`;
    const set = bodyKeyGroups.get(key) ?? new Set();
    set.add(rawLabel);
    bodyKeyGroups.set(key, set);
  }

  const bodyDuplicates = [...bodyKeyGroups.entries()].filter(([, variants]) => variants.size > 1);
  console.log(`Posibles duplicados de body por normalización: ${bodyDuplicates.length}`);
  for (const [key, variants] of bodyDuplicates.slice(0, 10)) {
    console.log(`  ${key}`);
    for (const v of variants) console.log(`    - ${v}`);
  }
  console.log();

  const shutterStats = await prisma.$queryRaw<
    Array<{ sourceField: string | null; count: bigint }>
  >`
    SELECT "shutterCountSourceField" AS "sourceField", COUNT(*)::bigint AS count
    FROM "PhotographicGearObservation"
    WHERE "shutterCount" IS NOT NULL
    ${photographerFilter}
    GROUP BY "shutterCountSourceField"
    ORDER BY COUNT(*) DESC
    LIMIT 15
  `;

  console.log("Shutter count por campo fuente:");
  if (shutterStats.length === 0) {
    console.log("  (ninguno aún en observaciones v2)");
  } else {
    for (const row of shutterStats) {
      console.log(`  ${row.sourceField ?? "?"}: ${row.count}`);
    }
  }

  const bodiesWithShutter = await prisma.photographicCameraBody.count({
    where: {
      maxShutterCount: { not: null },
      ...(photographerId ? { photographerId } : {}),
    },
  });
  console.log(`\nBodies con maxShutterCount: ${bodiesWithShutter}`);
  console.log("\n=== Fin auditoría (sin modificaciones) ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
