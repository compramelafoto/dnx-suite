/**
 * Reemplaza fotos del álbum de la demo escolar por las de una carpeta, por nombre de archivo
 * (`S5-01.jpg`, `6A-GRUPO.jpg`, `6A-PROFE.jpg`, ver docs/compramelafoto/demo-escolar/PROMPTS-FOTOS.md).
 * Las anteriores con el mismo nombre se esconden (no se borran); las nuevas quedan sin publicar
 * hasta el paso «Subís las fotos», igual que las sembradas.
 *
 *   ../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.json \
 *     scripts/demos/escolar/reemplazar-fotos.ts /ruta/a/fotos-demo-escolar
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { subirFotoDemo } from "@/lib/demos/escolar/preparar";
import { esperarVariantesDelAlbum } from "@/lib/demos/escolar/esperar-variantes";

async function main() {
  const carpeta = process.argv[2];
  if (!carpeta) throw new Error("Falta la carpeta con las fotos.");
  const ctx = await getContextoDemoEscolar();
  if (!ctx) throw new Error("La demo no está preparada: corré «Preparar» primero.");

  const archivos = readdirSync(carpeta).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const original of archivos) {
    const archivo = original.replace(/\.(png|webp|jpeg)$/i, ".jpg");
    // JPG estándar, sin perfiles raros: el proceso de subida del álbum espera eso.
    const buffer = await sharp(readFileSync(join(carpeta, original))).rotate().jpeg({ quality: 92 }).toBuffer();
    const viejas = await prisma.photo.updateMany({
      where: { albumId: ctx.albumId, originalFilename: archivo },
      data: { isRemoved: true, removedAt: new Date(), removedReason: "DEMO_REEMPLAZADA", originalFilename: null },
    });
    const id = await subirFotoDemo(ctx.albumId, ctx.fotografoId, archivo, buffer);
    console.log(`${archivo}: subida (foto ${id})${viejas.count ? `, reemplaza ${viejas.count}` : ""}`);
  }
  console.log("Versiones con marca de agua pendientes:", await esperarVariantesDelAlbum(ctx.albumId));
  console.log("Listo. Las fotos quedan sin publicar hasta «Publicar las fotos de la toma».");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
