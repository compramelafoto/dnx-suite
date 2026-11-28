import "server-only";
import { prisma } from "@/lib/prisma";
import { createDesignV2Project } from "@/lib/design-v2/projects";
import { loadDesignTemplateVersion } from "@/lib/design-v2/template";
import { notifyPhotographerDesignToReview } from "@/lib/design-v2/notify";
import { buildDesignValues } from "@/lib/design-v2/values";
import { valoresDelPackExterno } from "@/lib/canje-externo/disenos-del-canje-externo";
import { EXTERNAL_PREVENTA_KIND } from "@/lib/canje-externo/external-preventa";
import { colegioDelAlbum } from "./cursos-del-album";
import { nombreParaElPadron, readProductDesignsFromSnapshot, type AlumnoDelLibrito } from "./compra-directa";

/** Espacio propio del candado de Postgres, para no chocar con otros `pg_advisory_xact_lock`. */
const CANDADO = 72_110_000;

/**
 * Textos del librito de una compra directa: alumno, curso, colegio y el listado del curso.
 * Es la misma cuenta que el canje de los packs cobrados por fuera (padrón del álbum, y si no hay,
 * los packs del Excel), con el alumno y el curso que escribió la familia.
 */
export async function valoresDelLibritoComprado(input: {
  albumId: number;
  alumno: AlumnoDelLibrito | null;
  buyerName: string | null;
  schoolName: string | null | undefined;
  schoolLogoUrl: string | null | undefined;
  photographerName: string | null | undefined;
}): Promise<Record<string, string>> {
  if (!input.alumno) {
    return buildDesignValues({
      buyerName: input.buyerName,
      schoolName: input.schoolName,
      schoolLogoUrl: input.schoolLogoUrl,
      photographerName: input.photographerName,
    });
  }
  return valoresDelPackExterno({
    albumId: input.albumId,
    externo: {
      kind: EXTERNAL_PREVENTA_KIND,
      studentName: nombreParaElPadron(input.alumno),
      parentName: input.buyerName,
      courseName: input.alumno.curso || null,
      schoolName: null,
      label: null,
    },
    schoolName: input.schoolName,
    schoolLogoUrl: input.schoolLogoUrl,
    buyerName: input.buyerName,
    photographerName: input.photographerName,
  });
}

/**
 * Compra directa con librito: cuando el pedido queda pagado, se arma un diseño por cada librito
 * con las fotos de sus lugares (tapa, contratapa) y los encuadres que dejó la familia. Queda
 * para que el fotógrafo lo revise y, aprobado, se imprime como diseño (`loadOrderDesigns`).
 *
 * Idempotente: el webhook y el regreso de Mercado Pago pueden confirmar el mismo pago a la vez.
 * Un candado por pedido hace que la segunda confirmación vea los diseños de la primera.
 */
export async function ensureProductDesignsForPaidOrder(orderId: number): Promise<number[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      albumId: true,
      buyerName: true,
      pricingSnapshot: true,
      album: {
        select: {
          userId: true,
          school: { select: { name: true, logoUrl: true } },
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!order || order.status !== "PAID" || !order.albumId || !order.album) return [];
  const pedidos = readProductDesignsFromSnapshot(order.pricingSnapshot);
  if (pedidos.length === 0) return [];

  // Los textos se arman fuera del candado: leen el padrón y no cambian entre confirmaciones.
  const colegio = await colegioDelAlbum(order.albumId, order.album.school);
  const valoresPorAlumno = new Map<string, Record<string, string>>();
  for (const p of pedidos) {
    const clave = JSON.stringify(p.alumno ?? null);
    if (valoresPorAlumno.has(clave)) continue;
    valoresPorAlumno.set(
      clave,
      await valoresDelLibritoComprado({
        albumId: order.albumId,
        alumno: p.alumno,
        buyerName: order.buyerName,
        schoolName: colegio.name,
        schoolLogoUrl: colegio.logoUrl,
        photographerName: order.album.user?.name,
      })
    );
  }
  const plantillas = new Map<string, Awaited<ReturnType<typeof loadDesignTemplateVersion>>>();
  for (const p of pedidos) {
    if (!plantillas.has(p.templateId)) {
      plantillas.set(p.templateId, await loadDesignTemplateVersion({ templateId: p.templateId }).catch(() => null));
    }
  }

  const album = order.album;
  const albumId = order.albumId;
  const creados = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO}::int, ${orderId}::int)`;
      const yaHay = await tx.designProject.count({ where: { albumOrderId: orderId, albumPackDraftId: null } });
      if (yaHay > 0) return [] as number[];
      const ids: number[] = [];
      for (const p of pedidos) {
        const template = plantillas.get(p.templateId);
        if (!template || template.slots.length === 0) {
          console.warn("[compra-directa] librito sin plantilla utilizable", { orderId, templateId: p.templateId });
          continue;
        }
        const cropsByPhotoId = new Map<number, { zoom: number; x: number; y: number }>();
        p.photoIds.forEach((id, i) => {
          const c = p.crops[i];
          if (c) cropsByPhotoId.set(id, c);
        });
        const r = await createDesignV2Project(tx as never, {
          template,
          photoIds: p.photoIds,
          values: valoresPorAlumno.get(JSON.stringify(p.alumno ?? null)) ?? {},
          photographerUserId: album.userId,
          albumId,
          albumOrderId: orderId,
          cropsByPhotoId,
        });
        if (r.created) ids.push(r.id);
      }
      return ids;
    },
    { timeout: 30_000 }
  );

  for (const id of creados) {
    await notifyPhotographerDesignToReview(id).catch((err) =>
      console.error("[compra-directa] aviso al fotógrafo", { orderId, designId: id, err })
    );
  }
  return creados;
}
