/**
 * Corre «Preparar» de la demo escolar desde la terminal (lo mismo que el botón de /admin/demos).
 * Sigue hasta que no falte ninguna foto.
 *
 *   DEMO_ORIGEN=https://www.compramelafoto.com \
 *     ../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.json scripts/demos/escolar/preparar.ts
 */

import { prepararDemoEscolar } from "@/lib/demos/escolar/preparar";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { esperarVariantesDelAlbum } from "@/lib/demos/escolar/esperar-variantes";

async function main() {
  const origen = process.env.DEMO_ORIGEN?.trim() || "https://www.compramelafoto.com";
  for (let vuelta = 1; vuelta <= 10; vuelta += 1) {
    const r = await prepararDemoEscolar({ origen, presupuestoFotosMs: 600_000 });
    console.log(`Vuelta ${vuelta}:`, JSON.stringify({ ...r, avisos: r.avisos }, null, 2));
    if (r.fotos.faltan === 0) break;
  }
  const ctx = await getContextoDemoEscolar();
  if (ctx) console.log("Versiones con marca de agua pendientes:", await esperarVariantesDelAlbum(ctx.albumId));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
