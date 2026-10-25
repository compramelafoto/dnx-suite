/**
 * Ensayo de la búsqueda por selfie de la demo escolar, sin pasar por el navegador: publica las
 * fotos de la toma, las analiza, busca la cara de una foto (la «selfie») y vuelve a esconderlas
 * para que la demo arranque como recién preparada.
 *
 *   ../../packages/payments/node_modules/.bin/tsx --env-file=.env.local --conditions=react-server \
 *     --tsconfig ./tsconfig.json scripts/demos/escolar/probar-selfie.ts /ruta/selfie.jpg
 */

import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { ocultarFotosDeLaToma, publicarFotosDeLaToma } from "@/lib/demos/escolar/fotos-toma";
import { runAnalysisPipeline } from "@/lib/analysis/analysis-runner";
import { searchFacesByImage } from "@/lib/faces/rekognition";

async function main() {
  const selfie = process.argv[2];
  if (!selfie) throw new Error("Falta la foto que hace de selfie.");
  const ctx = await getContextoDemoEscolar();
  if (!ctx) throw new Error("La demo no está preparada.");

  const pub = await publicarFotosDeLaToma(ctx.albumId);
  console.log("Publicadas:", pub.publicadas, "· analizadas en la primera corrida:", pub.analizadas);
  for (let i = 0; i < 6; i += 1) {
    const pendientes = await prisma.photo.count({
      where: { albumId: ctx.albumId, isRemoved: false, analysisStatus: { not: "DONE" } },
    });
    if (pendientes === 0) break;
    console.log("Fotos sin analizar:", pendientes, "→ otra corrida");
    await runAnalysisPipeline({ ocrRequested: false, debug: false, source: "admin", albumId: ctx.albumId, maxRunMs: 120_000 });
  }

  const matches = await searchFacesByImage(new Uint8Array(readFileSync(selfie)));
  const caras = await prisma.faceDetection.findMany({
    where: { rekognitionFaceId: { in: matches.map((m) => m.rekognitionFaceId) }, photo: { albumId: ctx.albumId } },
    select: { rekognitionFaceId: true, photo: { select: { originalFilename: true } } },
  });
  const porCara = new Map(matches.map((m) => [m.rekognitionFaceId, m.similarity]));
  console.log(`Coincidencias en el álbum demo: ${caras.length}`);
  for (const c of caras) {
    console.log(`  ${c.photo.originalFilename ?? "(sin nombre)"} · ${Math.round(porCara.get(c.rekognitionFaceId) ?? 0)} %`);
  }

  console.log("Vueltas a ocultar:", await ocultarFotosDeLaToma(ctx.albumId));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
