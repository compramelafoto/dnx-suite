import { prisma } from "@repo/db";
import { avisarAlAdmin } from "@/lib/aviso-admin";
import { EquipoError } from "@/lib/inventario/equipos";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { validarMotivo } from "./bloqueo";

/**
 * Reportes de una persona sobre otra («Reportar a esta persona»). Sólo entre quienes tuvieron una
 * consulta o una venta entre ellos (en cualquier sentido). Uno por par: repetir uno sin resolver
 * no duplica ni vuelve a avisar al admin; si el anterior ya se resolvió, se reabre con el motivo
 * nuevo. El motivo lo ve sólo el admin.
 */

export const MENSAJE_REPORTE_PROPIO = "No podés reportarte a vos mismo.";
export const MENSAJE_REPORTE_SIN_RELACION =
  "Sólo podés reportar a alguien con quien tuviste una consulta o una venta.";
export const MENSAJE_REPORTE_SIN_RESOLUCION = "Indicá cómo se resolvió el reporte.";
export const MENSAJE_REPORTE_RESUELTO = "Este reporte ya está resuelto.";

const MAX_CONTEXTO = 100;
const MAX_RESOLUCION = 500;

async function tuvieronRelacion(a: number, b: number): Promise<boolean> {
  const consulta = await prisma.gearListingContact.findFirst({
    where: {
      OR: [
        { buyerId: a, listing: { sellerId: b } },
        { buyerId: b, listing: { sellerId: a } },
      ],
    },
    select: { id: true },
  });
  if (consulta) return true;
  const venta = await prisma.gearSale.findFirst({
    where: {
      OR: [
        { buyerId: a, sellerId: b },
        { buyerId: b, sellerId: a },
      ],
    },
    select: { id: true },
  });
  return venta != null;
}

async function avisar(reportId: number, context: string | null): Promise<void> {
  // El asunto es fijo y sin datos personales; el cuerpo lleva sólo el número y el contexto.
  await avisarAlAdmin("reportes", "reporte_usuario_admin", {
    detalle: context ? `Reporte #${reportId} · ${context}` : `Reporte #${reportId}`,
    url: `${urlBaseDeLaApp()}/admin/usuarios`,
  });
}

export async function reportUser(
  reporterId: number,
  reportedId: number,
  reason: string,
  context?: string,
): Promise<{ created: boolean }> {
  if (reporterId === reportedId) throw new EquipoError("DATO_INVALIDO", MENSAJE_REPORTE_PROPIO);
  const motivo = validarMotivo(reason);
  const contexto = context?.trim().slice(0, MAX_CONTEXTO) || null;

  if (!(await tuvieronRelacion(reporterId, reportedId))) {
    throw new EquipoError("DATO_INVALIDO", MENSAJE_REPORTE_SIN_RELACION);
  }

  const previo = await prisma.portalUserReport.findUnique({
    where: { reporterId_reportedId: { reporterId, reportedId } },
    select: { id: true, resolvedAt: true },
  });
  if (previo && previo.resolvedAt == null) return { created: false };

  let id: number;
  if (previo) {
    id = (
      await prisma.portalUserReport.update({
        where: { id: previo.id },
        data: {
          reason: motivo,
          context: contexto,
          createdAt: new Date(),
          resolvedAt: null,
          resolution: null,
        },
        select: { id: true },
      })
    ).id;
  } else {
    try {
      id = (
        await prisma.portalUserReport.create({
          data: { reporterId, reportedId, reason: motivo, context: contexto },
          select: { id: true },
        })
      ).id;
    } catch (err) {
      // Doble envío: el otro ya lo guardó y ya avisó.
      if ((err as { code?: string })?.code === "P2002") return { created: false };
      throw err;
    }
  }
  await avisar(id, contexto);
  return { created: true };
}

export type OrigenReporte = "venta" | "interesado" | "publicacion";

/**
 * A quién se reporta desde cada pantalla, resuelto en el servidor (el formulario sólo manda el
 * origen y el número): la otra parte de una venta propia, una persona que consultó una
 * publicación propia, o el vendedor de una publicación ajena. `null` si no corresponde.
 */
export async function reportTarget(
  userId: number,
  origen: string,
  ref: number,
  persona?: number,
): Promise<{ reportedId: number; context: string; volver: string } | null> {
  if (!Number.isInteger(ref) || ref <= 0) return null;
  if (origen === "venta") {
    const venta = await prisma.gearSale.findFirst({
      where: { id: ref, OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { buyerId: true, sellerId: true },
    });
    if (!venta) return null;
    const esComprador = venta.buyerId === userId;
    return {
      reportedId: esComprador ? venta.sellerId : venta.buyerId,
      context: `Venta #${ref}`,
      volver: esComprador ? `/compras/${ref}` : `/ventas/${ref}`,
    };
  }
  if (origen === "interesado") {
    if (!persona || !Number.isInteger(persona) || persona <= 0) return null;
    const propia = await prisma.gearListing.findFirst({
      where: { id: ref, sellerId: userId },
      select: { id: true },
    });
    if (!propia) return null;
    return { reportedId: persona, context: `Publicación #${ref}`, volver: `/mis-publicaciones/${ref}` };
  }
  if (origen === "publicacion") {
    const listing = await prisma.gearListing.findFirst({ where: { id: ref }, select: { sellerId: true } });
    if (!listing || listing.sellerId === userId) return null;
    return { reportedId: listing.sellerId, context: `Publicación #${ref}`, volver: `/equipos/${ref}` };
  }
  return null;
}

/** Cierra un reporte con la resolución del admin (texto interno). */
export async function resolveUserReport(
  adminId: number,
  reportId: number,
  resolution: string,
): Promise<void> {
  const texto = (resolution ?? "").trim();
  if (!texto || texto.length > MAX_RESOLUCION) {
    throw new EquipoError("DATO_INVALIDO", MENSAJE_REPORTE_SIN_RESOLUCION);
  }
  const r = await prisma.portalUserReport.updateMany({
    where: { id: reportId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolution: texto },
  });
  if (r.count === 0) {
    const existe = await prisma.portalUserReport.findUnique({ where: { id: reportId }, select: { id: true } });
    if (!existe) throw new EquipoError("NO_ENCONTRADO", "No encontramos ese reporte.");
    throw new EquipoError("DATO_INVALIDO", MENSAJE_REPORTE_RESUELTO);
  }
  console.info(`[reportes] Admin ${adminId} resolvió el reporte ${reportId}.`);
}

export type ReporteAbierto = {
  id: number;
  reason: string;
  context: string | null;
  createdAt: Date;
  reporter: { id: number; name: string | null; email: string };
  reported: { id: number; name: string | null; email: string; blocked: boolean };
};

/** Reportes sin resolver, los más viejos primero (sólo para el panel del admin). */
export async function listOpenUserReports(): Promise<ReporteAbierto[]> {
  const rows = await prisma.portalUserReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reason: true,
      context: true,
      createdAt: true,
      reporter: { select: { id: true, name: true, email: true } },
      reported: {
        select: { id: true, name: true, email: true, portalAccountBlock: { select: { liftedAt: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    context: r.context,
    createdAt: r.createdAt,
    reporter: r.reporter,
    reported: {
      id: r.reported.id,
      name: r.reported.name,
      email: r.reported.email,
      blocked: r.reported.portalAccountBlock != null && r.reported.portalAccountBlock.liftedAt == null,
    },
  }));
}
