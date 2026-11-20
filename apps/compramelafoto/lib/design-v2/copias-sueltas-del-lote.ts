import "server-only";
import path from "path";
import { prisma } from "@/lib/prisma";
import { loadAlbumOrderPrintPlan } from "@/lib/orders/print-export/album-order-print-plan";
import { carpetaDeImpresion } from "@/lib/orders/print-export/rutas-cortas";
import type { PrintExportFile } from "@/lib/orders/print-export/stream-print-export-zip";
import type { DesignActor } from "./projects";
import type { LibritoParaProducir } from "./produccion";
import type { PedidoDeCopias } from "./copias-en-produccion";
import { CARPETA_COPIAS_SUELTAS, nombreDeCopiaDelLote } from "./produccion-reglas";

/**
 * Copias impresas que las familias pidieron aparte del librito («librito + 1 copia impresa»).
 * Sin esto el lote traía sólo los libritos y esas copias había que ir a buscarlas pedido por pedido
 * (y el botón del pedido desaparecía al pasar a «En imprenta»).
 *
 * Usa el mismo armado que la descarga de un pedido (`loadAlbumOrderPrintPlan`): las fotos que forman
 * el librito no se repiten; sólo entran las copias de afuera.
 */
export async function copiasSueltasDelLote(
  actor: DesignActor,
  libros: LibritoParaProducir[],
  carpetaLote: string,
): Promise<PrintExportFile[]> {
  const pedidos = await prisma.designProject.findMany({
    where: { id: { in: libros.map((l) => l.id) }, albumOrderId: { not: null } },
    select: { id: true, albumOrderId: true },
  });
  const pedidoDe = new Map(pedidos.map((p) => [p.id, p.albumOrderId!]));

  // Un pedido con varios libritos aporta sus copias una sola vez, junto al primero.
  const vistos = new Set<number>();
  const trabajos: Array<{ posicion: number; libro: LibritoParaProducir; orderId: number }> = [];
  libros.forEach((libro, i) => {
    const orderId = pedidoDe.get(libro.id);
    if (!orderId || vistos.has(orderId)) return;
    vistos.add(orderId);
    trabajos.push({ posicion: i + 1, libro, orderId });
  });

  const files: PrintExportFile[] = [];
  const DE_A = 6;
  for (let i = 0; i < trabajos.length; i += DE_A) {
    const tanda = await Promise.all(
      trabajos.slice(i, i + DE_A).map(async (t) => ({
        t,
        plan: await loadAlbumOrderPrintPlan(t.orderId, { id: actor.id, role: actor.role }),
      })),
    );
    for (const { t, plan } of tanda) {
      if (!plan.ok) continue;
      for (const f of plan.plan.files) {
        if (!f.impresion) continue; // los PDF/JPG del diseño ya van en el lote
        const nombre = nombreDeCopiaDelLote(
          t.posicion,
          t.libro,
          libros.length,
          carpetaDeImpresion(f.impresion),
          path.posix.basename(f.zipPath),
        );
        files.push({
          zipPath: `${carpetaLote}/${CARPETA_COPIAS_SUELTAS}/${nombre}`,
          r2Key: f.r2Key,
          manifestLine: `OK      ${CARPETA_COPIAS_SUELTAS}/${nombre}`,
          missingLine: `FALTA   ${CARPETA_COPIAS_SUELTAS}/${nombre}`,
          impresion: f.impresion,
        });
      }
    }
  }
  return files;
}

/**
 * Copias de los pedidos que NO tienen librito. Van en la misma carpeta «Copias sueltas», numeradas
 * después de los libritos (el mismo número que en el resumen del lote).
 */
export async function copiasDePedidosSinLibrito(
  actor: DesignActor,
  pedidos: PedidoDeCopias[],
  primeraPosicion: number,
  total: number,
  carpetaLote: string,
): Promise<PrintExportFile[]> {
  const files: PrintExportFile[] = [];
  const DE_A = 6;
  for (let i = 0; i < pedidos.length; i += DE_A) {
    const tanda = await Promise.all(
      pedidos.slice(i, i + DE_A).map(async (p, j) => ({
        p,
        posicion: primeraPosicion + i + j,
        plan: await loadAlbumOrderPrintPlan(p.orderId, { id: actor.id, role: actor.role }),
      })),
    );
    for (const { p, posicion, plan } of tanda) {
      if (!plan.ok) continue;
      for (const f of plan.plan.files) {
        if (!f.impresion) continue;
        const nombre = nombreDeCopiaDelLote(posicion, p, total, carpetaDeImpresion(f.impresion), path.posix.basename(f.zipPath));
        files.push({
          zipPath: `${carpetaLote}/${CARPETA_COPIAS_SUELTAS}/${nombre}`,
          r2Key: f.r2Key,
          manifestLine: `OK      ${CARPETA_COPIAS_SUELTAS}/${nombre}`,
          missingLine: `FALTA   ${CARPETA_COPIAS_SUELTAS}/${nombre}`,
          impresion: f.impresion,
        });
      }
    }
  }
  return files;
}

/** Línea para el control y el LEEME: cuántas copias van aparte. */
export function lineaDeCopiasSueltas(files: PrintExportFile[]): string[] {
  if (files.length === 0) return [];
  const copias = files.reduce((n, f) => n + (f.impresion?.copias ?? 1), 0);
  return [
    `${copias} ${copias === 1 ? "copia impresa" : "copias impresas"} pedidas aparte del librito, en la carpeta «${CARPETA_COPIAS_SUELTAS}» (empiezan con el número del librito del mismo alumno).`,
    "",
  ];
}
