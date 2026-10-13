/**
 * Borra de Amazon las caras que ya no tienen dueño en la base.
 *
 * Para qué: hasta el 2026-10-09 la purga de álbumes borraba la fila de `FaceDetection`
 * aunque el borrado en Amazon hubiera fallado, y con ella el único identificador que
 * permitía reintentarlo. Esas caras quedaron en la colección, invisibles y facturándose
 * todos los meses. La purga ya no las genera; esto limpia las que quedaron.
 *
 * Uso:
 *   pnpm --filter compramelafoto tsx scripts/limpiar-caras-huerfanas.ts           # simula
 *   pnpm --filter compramelafoto tsx scripts/limpiar-caras-huerfanas.ts --borrar  # borra
 *
 * Sin `--borrar` no toca nada: lista cuántas hay y cuánto se ahorra. Y antes de borrar se
 * planta si lo que devolvió la base no es creíble, porque vaciar la colección por error
 * costaría unos USD 183 y varios días de reindexado.
 */
import { prisma } from "@/lib/prisma";
import { listAllFaceIds, deleteFacesInBatches } from "@/lib/faces/rekognition";
import { orphanFaceIds, guardOrphanScan, OrphanScanRefusal } from "@/lib/faces/orphan-faces";

/** Lo que cobra Amazon por tener mil caras guardadas, un mes. */
const USD_POR_MIL_CARAS_MES = 0.01;

async function faceIdsEnLaBase(): Promise<Set<string>> {
  const vivas = new Set<string>();

  /*
    Dos orígenes en la misma colección: las caras de las fotos del fotógrafo y las selfies
    con las que el cliente se busca. Si se mirara sólo el primero, el barrido borraría
    todas las selfies vigentes.
  */
  const deFotos = await prisma.faceDetection.findMany({
    select: { rekognitionFaceId: true },
  });
  for (const f of deFotos) if (f.rekognitionFaceId) vivas.add(f.rekognitionFaceId);

  const deSelfies = await prisma.albumInterest.findMany({
    where: { faceId: { not: null } },
    select: { faceId: true },
  });
  for (const s of deSelfies) if (s.faceId) vivas.add(s.faceId);

  return vivas;
}

async function main() {
  const borrar = process.argv.includes("--borrar");

  console.log("Leyendo la colección de Amazon…");
  const enAmazon = await listAllFaceIds((n) => {
    if (n % 10000 === 0) console.log(`  ${n} caras leídas…`);
  });
  console.log(`Caras en la colección: ${enAmazon.length}`);

  const enLaBase = await faceIdsEnLaBase();
  console.log(`Caras que la base reconoce: ${enLaBase.size}`);

  try {
    guardOrphanScan({ facesInDb: enLaBase.size, facesInCollection: enAmazon.length });
  } catch (err) {
    if (err instanceof OrphanScanRefusal) {
      console.error(`\nNo se borra nada: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const huerfanas = orphanFaceIds(enAmazon, enLaBase);
  const ahorroMensual = (huerfanas.length / 1000) * USD_POR_MIL_CARAS_MES;

  console.log(`\nHuérfanas: ${huerfanas.length}`);
  console.log(`Ahorro: USD ${ahorroMensual.toFixed(2)} por mes`);

  if (huerfanas.length === 0) {
    console.log("\nNada que limpiar.");
    return;
  }

  if (!borrar) {
    console.log("\nEsto fue una simulación. Agregá --borrar para borrarlas de verdad.");
    return;
  }

  console.log("\nBorrando…");
  const borradas = await deleteFacesInBatches(huerfanas, (n) => {
    console.log(`  ${n} de ${huerfanas.length}…`);
  });

  console.log(`\nListo: ${borradas.length} de ${huerfanas.length} borradas.`);
  if (borradas.length < huerfanas.length) {
    // Amazon no siempre borra todo lo pedido; lo que no confirmó sigue facturándose.
    console.log(
      `Quedaron ${huerfanas.length - borradas.length} sin confirmar. Volvé a correrlo.`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
