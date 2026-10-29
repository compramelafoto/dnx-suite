/**
 * Sube los logos inventados de la demo escolar (colegio y estudio) a R2 y los deja puestos.
 * Los dibujos están en docs/compramelafoto/demo-escolar/logos/; si se cambian, se vuelve a correr.
 *
 *   ../../packages/payments/node_modules/.bin/tsx --env-file=.env.local --conditions=react-server \
 *     --tsconfig ./tsconfig.json scripts/demos/escolar/subir-logos.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";
import { DEMO_ESCOLAR } from "@/lib/demos/escolar/datos";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";

const CARPETA = join(process.cwd(), "../../docs/compramelafoto/demo-escolar/logos");

async function main() {
  for (const [nombre, key] of Object.entries(DEMO_ESCOLAR.logos)) {
    await uploadToR2(readFileSync(join(CARPETA, `logo-${nombre}.png`)), key, "image/png");
    console.log(`${nombre}: ${getR2PublicUrl(key)}`);
  }
  const ctx = await getContextoDemoEscolar();
  if (!ctx) {
    console.log("Logos subidos. La demo no está preparada en esta base: «Preparar» los pone.");
    return;
  }
  await prisma.school.update({ where: { id: ctx.schoolId }, data: { logoUrl: getR2PublicUrl(DEMO_ESCOLAR.logos.colegio) } });
  await prisma.user.update({ where: { id: ctx.fotografoId }, data: { logoUrl: getR2PublicUrl(DEMO_ESCOLAR.logos.estudio) } });
  console.log("Listo: logos puestos en la escuela y en DNX Estudio.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
