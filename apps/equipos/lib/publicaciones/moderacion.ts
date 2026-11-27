import { prisma } from "@repo/db";
import { contactoEmail, contactoMailto } from "@/lib/contacto-publico";
import { sendPortalEmail } from "@/lib/correo";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { EquipoError } from "../inventario/equipos";
import { findActiveReportForSerial, findActiveReportsForSerial } from "./denuncia-activa";
import { notifyAdmin } from "./publicar";

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
      sellerId: true,
      status: true,
      reviewNote: true,
      publishedAt: true,
      make: true,
      model: true,
      seller: { select: { email: true, name: true } },
      gearItem: { select: { serialNormalized: true } },
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
      // El rechazo invita a escribirnos sólo si hay correo de contacto configurado.
      contacto: contactoEmail() ?? "",
      contactoUrl: contactoMailto(`Publicación #${listingId}`) ?? "",
    });
  } catch (err) {
    console.error(`[moderacion] No se pudo avisar "${template}":`, err);
  }
}

/** Acciones que pasan una publicación a revisión; la última es la que la dejó como está. */
const ENTRADAS_A_REVISION = ["publicado", "reanudado", "retenido", "revision_por_reporte"];

/**
 * Estado en el que estaba la publicación antes de pasar a revisión (`detail.previo`, lo guardan
 * la retención diaria y la revisión por reporte). Sin dato, se publica.
 */
async function estadoPrevio(gearItemId: number, listingId: number): Promise<"PUBLISHED" | "PAUSED"> {
  const evento = await prisma.gearItemEvent.findFirst({
    where: {
      gearItemId,
      AND: [
        { detail: { path: ["listingId"], equals: listingId } },
        {
          OR: ENTRADAS_A_REVISION.map((accion) => ({
            detail: { path: ["accion"], equals: accion },
          })),
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { detail: true },
  });
  const d = evento?.detail;
  const previo =
    d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>).previo : null;
  return previo === "PAUSED" ? "PAUSED" : "PUBLISHED";
}

export const MENSAJE_DENUNCIA_ACTIVA =
  "Hay una denuncia activa sobre esta serie: resolvela antes de aprobar.";

/**
 * Aprueba una publicación en revisión. Nunca con una denuncia activa de otra persona sobre la
 * serie: la ficha dice «Sin denuncias de robo ni pérdida» y tiene que ser verdad. Si la
 * publicación estaba pausada antes de la revisión, vuelve a pausada (y el equipo, a «en uso»).
 */
export async function approveListing(adminId: number, listingId: number): Promise<void> {
  const listing = await loadInReview(listingId);
  const serial = listing.gearItem.serialNormalized;
  if (serial && (await findActiveReportForSerial(serial, listing.sellerId))) {
    throw new EquipoError("CON_DENUNCIA", MENSAJE_DENUNCIA_ACTIVA);
  }
  const destino = await estadoPrevio(listing.gearItemId, listingId);
  await prisma.$transaction(async (tx) => {
    const r = await tx.gearListing.updateMany({
      where: { id: listingId, status: "IN_REVIEW" },
      data:
        destino === "PAUSED"
          ? { status: "PAUSED" }
          : { status: "PUBLISHED", publishedAt: listing.publishedAt ?? new Date() },
    });
    if (r.count === 0) throw noEnRevision();
    if (destino === "PAUSED") {
      await tx.gearItem.updateMany({
        where: { id: listing.gearItemId, status: "FOR_SALE" },
        data: { status: "IN_USE" },
      });
    }
    await tx.gearListingFlag.updateMany({
      where: { listingId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: listing.gearItemId,
        type: "STATUS_CHANGED",
        detail: { listingId, accion: "aprobado", adminId, destino },
      },
    });
  });
  // Una pausada no está «online»: el vendedor la reanuda cuando quiera, sin correo que diga otra cosa.
  if (destino === "PUBLISHED") {
    await avisarAlVendedor(listing.seller, "publicacion_aprobada", listingId);
  }
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
      status: true,
      gearItem: { select: { serialNormalized: true } },
    },
  });
  let held = 0;
  for (const c of candidates) {
    const serial = c.gearItem.serialNormalized;
    if (!serial) continue;
    // Con al menos una denuncia activa se retiene; la nota cita todas, la más vieja primero.
    const reports = await findActiveReportsForSerial(serial, c.sellerId);
    if (reports.length === 0) continue;
    const previo = c.status as (typeof HELD_FROM)[number];
    const moved = await prisma.$transaction(async (tx) => {
      // Condicionado al estado leído: así `previo` es exactamente lo que había.
      const r = await tx.gearListing.updateMany({
        where: { id: c.id, status: previo },
        data: {
          status: "IN_REVIEW",
          reviewNote: reports.map((x) => `Denuncia activa #${x.id}`).join("\n"),
        },
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
          detail: { listingId: c.id, accion: "retenido", reportId: reports[0].id, previo },
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

/**
 * Un reporte de otra persona sobre una publicación visible: la pasa a revisión (queda a la venta
 * y fuera del catálogo hasta que el admin la apruebe o la rechace). Sólo desde PUBLISHED/PAUSED.
 */
export async function reviewFlaggedListing(
  adminId: number,
  listingId: number,
  flagId?: number,
): Promise<void> {
  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId },
    select: { id: true, gearItemId: true, status: true, reviewNote: true },
  });
  if (!listing) throw new EquipoError("NO_ENCONTRADO");
  const noSePuede = () =>
    new EquipoError("DATO_INVALIDO", "Esta publicación no se puede pasar a revisión.");
  if (!(HELD_FROM as readonly string[]).includes(listing.status)) throw noSePuede();
  const previo = listing.status as (typeof HELD_FROM)[number];
  const linea = flagId ? `Reporte #${flagId}` : "Reporte de usuarios";
  const reviewNote = listing.reviewNote ? `${listing.reviewNote}\n${linea}` : linea;
  await prisma.$transaction(async (tx) => {
    const r = await tx.gearListing.updateMany({
      where: { id: listingId, status: previo },
      data: { status: "IN_REVIEW", reviewNote },
    });
    if (r.count === 0) throw noSePuede();
    await tx.gearItem.updateMany({
      where: { id: listing.gearItemId, status: "IN_USE" },
      data: { status: "FOR_SALE" },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: listing.gearItemId,
        type: "STATUS_CHANGED",
        detail: {
          listingId,
          accion: "revision_por_reporte",
          flagId: flagId ?? null,
          adminId,
          previo,
        },
      },
    });
  });
}

/** Descarta un reporte (sólo ése): queda resuelto y no vuelve al panel. */
export async function dismissFlag(listingId: number, flagId: number): Promise<void> {
  const r = await prisma.gearListingFlag.updateMany({
    where: { id: flagId, listingId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  if (r.count === 0) {
    throw new EquipoError("DATO_INVALIDO", "Este reporte ya está resuelto o no existe.");
  }
}
