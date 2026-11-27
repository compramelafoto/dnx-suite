import { prisma } from "@repo/db";
import { sendPortalEmail } from "@/lib/correo";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { EquipoError } from "../inventario/equipos";
import { findActiveReportForSerial, notifyAdmin } from "./publicar";

/**
 * Moderación de publicaciones: reportes de otras personas, decisión del administrador y retención
 * diaria de lo que tiene una denuncia activa. El motivo interno (`reviewNote`) nunca sale en un
 * correo al vendedor.
 */

const MOTIVO_MIN = 10;
const MOTIVO_MAX = 500;
const HELD_FROM = ["PUBLISHED", "PAUSED"] as const;

const noEnRevision = () =>
  new EquipoError("DATO_INVALIDO", "Esta publicación ya no está en revisión.");

/** Un reporte por persona y publicación: el segundo no falla, no duplica y no vuelve a avisar. */
export async function flagListing(
  reporterId: number,
  listingId: number,
  reason: string,
): Promise<void> {
  const motivo = typeof reason === "string" ? reason.trim() : "";
  if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX) {
    throw new EquipoError(
      "DATO_INVALIDO",
      `Contanos el motivo en ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres.`,
    );
  }
  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId, status: { in: ["PUBLISHED", "PAUSED"] } },
    select: { id: true, sellerId: true },
  });
  if (!listing) throw new EquipoError("NO_ENCONTRADO");
  if (listing.sellerId === reporterId) {
    throw new EquipoError("DATO_INVALIDO", "No podés reportar tu propia publicación.");
  }
  const { count } = await prisma.gearListingFlag.createMany({
    data: [{ listingId, reporterId, reason: motivo }],
    skipDuplicates: true,
  });
  if (count === 0) return;
  await notifyAdmin("reporte_publicacion_admin", `Reporte sobre la publicación #${listingId}.`);
}

async function loadInReview(listingId: number) {
  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId },
    select: {
      id: true,
      gearItemId: true,
      status: true,
      reviewNote: true,
      make: true,
      model: true,
      seller: { select: { email: true, name: true } },
    },
  });
  if (!listing) throw new EquipoError("NO_ENCONTRADO");
  return listing;
}

async function avisarAlVendedor(
  seller: { email: string | null; name: string | null },
  template: "publicacion_aprobada" | "publicacion_rechazada",
  listingId: number,
): Promise<void> {
  if (!seller.email) return;
  try {
    await sendPortalEmail(seller.email, template, {
      nombre: seller.name ?? "",
      url: `${urlBaseDeLaApp()}/equipos/${listingId}`,
    });
  } catch (err) {
    console.error(`[moderacion] No se pudo avisar "${template}":`, err);
  }
}

export async function approveListing(adminId: number, listingId: number): Promise<void> {
  const listing = await loadInReview(listingId);
  await prisma.$transaction(async (tx) => {
    const r = await tx.gearListing.updateMany({
      where: { id: listingId, status: "IN_REVIEW" },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    if (r.count === 0) throw noEnRevision();
    await tx.gearListingFlag.updateMany({
      where: { listingId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: listing.gearItemId,
        type: "STATUS_CHANGED",
        detail: { listingId, accion: "aprobado", adminId },
      },
    });
  });
  await avisarAlVendedor(listing.seller, "publicacion_aprobada", listingId);
}

export async function rejectListing(
  adminId: number,
  listingId: number,
  note: string,
): Promise<void> {
  const nota = note.trim();
  if (!nota) throw new EquipoError("DATO_INVALIDO", "Indicá el motivo del rechazo.");
  const listing = await loadInReview(listingId);
  const reviewNote = listing.reviewNote ? `${listing.reviewNote}\n${nota}` : nota;
  await prisma.$transaction(async (tx) => {
    const r = await tx.gearListing.updateMany({
      where: { id: listingId, status: "IN_REVIEW" },
      data: { status: "CLOSED", closedAt: new Date(), reviewNote },
    });
    if (r.count === 0) throw noEnRevision();
    // El equipo vuelve a «en uso» sólo si seguía a la venta.
    await tx.gearItem.updateMany({
      where: { id: listing.gearItemId, status: "FOR_SALE" },
      data: { status: "IN_USE" },
    });
    await tx.gearListingFlag.updateMany({
      where: { listingId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: listing.gearItemId,
        type: "STATUS_CHANGED",
        detail: { listingId, accion: "rechazado", adminId },
      },
    });
  });
  await avisarAlVendedor(listing.seller, "publicacion_rechazada", listingId);
}

/**
 * Pasa a revisión lo publicado o pausado cuya serie tiene una denuncia activa de otra persona.
 * La consulta sólo mira PUBLISHED/PAUSED y el cambio es condicional: una publicación ya en revisión
 * no vuelve a avisar, aunque el cron corra varios días.
 */
export async function holdListingsWithActiveReports(): Promise<{ held: number }> {
  const candidates = await prisma.gearListing.findMany({
    where: { status: { in: [...HELD_FROM] } },
    select: {
      id: true,
      sellerId: true,
      gearItemId: true,
      gearItem: { select: { serialNormalized: true } },
    },
  });
  let held = 0;
  for (const c of candidates) {
    const serial = c.gearItem.serialNormalized;
    if (!serial) continue;
    const report = await findActiveReportForSerial(serial, c.sellerId);
    if (!report) continue;
    const moved = await prisma.$transaction(async (tx) => {
      const r = await tx.gearListing.updateMany({
        where: { id: c.id, status: { in: [...HELD_FROM] } },
        data: { status: "IN_REVIEW", reviewNote: `Denuncia activa #${report.id}` },
      });
      if (r.count === 0) return false;
      // Una pausada tenía el equipo en uso; en revisión queda a la venta, como al reanudar.
      await tx.gearItem.updateMany({
        where: { id: c.gearItemId, status: "IN_USE" },
        data: { status: "FOR_SALE" },
      });
      await tx.gearItemEvent.create({
        data: {
          gearItemId: c.gearItemId,
          type: "STATUS_CHANGED",
          detail: { listingId: c.id, accion: "retenido", reportId: report.id },
        },
      });
      return true;
    });
    if (!moved) continue;
    held += 1;
    await notifyAdmin(
      "publicacion_en_revision_admin",
      `Publicación #${c.id} del equipo #${c.gearItemId} pasó a revisión por una denuncia activa.`,
    );
  }
  return { held };
}
