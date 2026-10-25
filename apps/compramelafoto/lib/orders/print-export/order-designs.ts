/**
 * Diseños (carpeta escolar, librito…) de un pedido para la carpeta de impresión.
 *
 * Un producto con plantilla se imprime como el PDF del diseño aprobado, no como las fotos
 * sueltas que lo forman. Sin esto el ZIP traía cada foto de la carpeta como si fuera una
 * copia aparte, y el PDF había que ir a buscarlo a "Diseños".
 *
 * Sólo los diseños escolares (canje de preventa): los de packs de galería son un extra
 * digital para el cliente y sus fotos sí se imprimen sueltas.
 */

import { prisma } from "@/lib/prisma";

export type OrderDesign = {
  id: number;
  templateName: string | null;
  /** Fotos que forman el diseño: esas no van sueltas. */
  photoIds: number[];
  /** Listo para imprimir: aprobado y con los archivos generados. */
  ready: boolean;
  pdfUrl: string | null;
  jpgUrls: string[];
};

function readExport(dataJson: unknown): { photoIds: number[]; pdfUrl: string | null; jpgUrls: string[] } {
  const d = (dataJson && typeof dataJson === "object" ? dataJson : {}) as Record<string, unknown>;
  const photoIds = Array.isArray(d.photoIds)
    ? d.photoIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const exp = (d.export && typeof d.export === "object" ? d.export : null) as Record<string, unknown> | null;
  const pdfUrl = typeof exp?.pdfUrl === "string" && exp.pdfUrl ? exp.pdfUrl : null;
  const jpgUrls = Array.isArray(exp?.jpgUrls) ? exp!.jpgUrls.filter((u): u is string => typeof u === "string" && !!u) : [];
  return { photoIds, pdfUrl, jpgUrls };
}

export async function loadOrderDesigns(orderId: number): Promise<OrderDesign[]> {
  const projects = await prisma.designProject.findMany({
    where: { albumOrderId: orderId, albumPackDraftId: null },
    select: {
      id: true,
      status: true,
      templateV2Id: true,
      currentRevision: { select: { dataJson: true } },
    },
    orderBy: { id: "asc" },
  });
  if (projects.length === 0) return [];

  const templateIds = [...new Set(projects.map((p) => p.templateV2Id).filter((t): t is string => !!t))];
  const templates = templateIds.length
    ? await prisma.templateV2.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(templates.map((t) => [t.id, t.name] as const));

  return projects.map((p) => {
    const exp = readExport(p.currentRevision?.dataJson);
    return {
      id: p.id,
      templateName: p.templateV2Id ? nameById.get(p.templateV2Id) ?? null : null,
      photoIds: exp.photoIds,
      ready: p.status === "EXPORTED" && exp.pdfUrl != null,
      pdfUrl: exp.pdfUrl,
      jpgUrls: exp.jpgUrls,
    };
  });
}

/** Fotos que no van sueltas porque son parte de un diseño del pedido. */
export function photoIdsInDesigns(designs: OrderDesign[]): Set<number> {
  return new Set(designs.flatMap((d) => d.photoIds));
}
