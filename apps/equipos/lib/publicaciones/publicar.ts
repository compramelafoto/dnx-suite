import { prisma } from "@repo/db";
import { uploadPrivateFile, validateFile } from "@/lib/archivos";
import { avisarAlAdmin } from "@/lib/aviso-admin";
import { notifyRequestBuyers } from "@/lib/busco/cruce";
import type { PortalEmailTemplate } from "@/lib/correo";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { MENSAJE_CUENTA_SUSPENDIDA, isBlocked } from "@/lib/usuarios/bloqueo";
import { EquipoError } from "../inventario/equipos";
import type { GearListing } from "./catalogos";
import { findActiveReportForSerial } from "./denuncia-activa";
import { fotosOpcionales } from "./fotos-opcionales";
import { listingBlocker, validateListingInput, type ListingInput } from "./reglas";
import { computeUsageSeal, proofPhotoMatches } from "./sellos";

/**
 * Publicaciones de venta: crear, pausar, reanudar, cerrar y editar. Todo filtra por vendedor
 * (una publicación ajena es una publicación que no existe). El motivo interno de una revisión
 * (`reviewNote`) nunca vuelve al vendedor.
 */

type Tx = Pick<typeof prisma, "gearListing" | "gearItem" | "gearItemEvent">;

type ListingStatusValue = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "PAUSED" | "CLOSED";

const OPEN_STATUSES: ListingStatusValue[] = ["DRAFT", "IN_REVIEW", "PUBLISHED", "PAUSED"];
const NO_MODIFICABLE = "Esta publicación ya no se puede modificar.";

const FOR_SALE_TO_IN_USE = { from: "FOR_SALE", to: "IN_USE" } as const;
const IN_USE_TO_FOR_SALE = { from: "IN_USE", to: "FOR_SALE" } as const;

const noModificable = () => new EquipoError("DATO_INVALIDO", NO_MODIFICABLE);

// Se re-exporta para no cambiar los imports existentes.
export { findActiveReportForSerial, findActiveReportsForSerial } from "./denuncia-activa";

/** Aviso al admin: se manda después de la transacción y nunca rompe la operación. */
export async function notifyAdmin(template: PortalEmailTemplate, detalle: string): Promise<void> {
  await avisarAlAdmin("publicaciones", template, {
    detalle,
    url: `${urlBaseDeLaApp()}/admin/publicaciones`,
  });
}

/**
 * Publicación abierta o venta pendiente de confirmación (su publicación ya está «vendida»): en
 * los dos casos el equipo no se puede volver a publicar. Mismo criterio que `updateItem`.
 */
async function hasActiveListingOrSale(
  db: Pick<typeof prisma, "gearListing" | "gearSale">,
  gearItemId: number,
): Promise<boolean> {
  const open = await db.gearListing.findFirst({
    where: { gearItemId, status: { in: OPEN_STATUSES } },
    select: { id: true },
  });
  if (open) return true;
  const pendingSale = await db.gearSale.findFirst({
    where: { gearItemId, status: "PENDING_BUYER" },
    select: { id: true },
  });
  return pendingSale !== null;
}

async function findOwnListing(sellerId: number, listingId: number) {
  const listing = await prisma.gearListing.findFirst({ where: { id: listingId, sellerId } });
  if (!listing) throw new EquipoError("NO_ENCONTRADO");
  return listing;
}

export async function createListing(
  sellerId: number,
  gearItemId: number,
  input: ListingInput,
  files: { serialPhoto?: File; proofPhoto?: File },
): Promise<{ listingId: number; status: "IN_REVIEW" | "PUBLISHED" }> {
  // En vivo, además del guard de la página (que redirige a /cuenta/bloqueada).
  if (await isBlocked(sellerId)) throw new EquipoError("DATO_INVALIDO", MENSAJE_CUENTA_SUSPENDIDA);
  const item = await prisma.gearItem.findFirst({ where: { id: gearItemId, ownerId: sellerId } });
  if (!item) throw new EquipoError("NO_ENCONTRADO");

  const ownReportOpen =
    (await prisma.stolenGearReport.count({
      where: { gearItemId, reporterId: sellerId, status: { in: ["PENDING_REVIEW", "ACTIVE"] } },
    })) > 0;
  const activeListing = await hasActiveListingOrSale(prisma, gearItemId);

  let serialPhotoKey: string | null = null;
  if (files.serialPhoto && files.serialPhoto.size > 0) {
    const error = validateFile(files.serialPhoto, "photo");
    if (error) throw new EquipoError("ARCHIVO_INVALIDO", error);
    serialPhotoKey = (await uploadPrivateFile(files.serialPhoto, "photo")).key;
  }

  const blocker = listingBlocker(item, {
    ownReportOpen,
    activeListing,
    serialPhotoKey,
    fotosOpcionales: fotosOpcionales(),
  });
  if (blocker) throw new EquipoError("DATO_INVALIDO", blocker);
  const data = validateListingInput(input, item.kind);

  // Sello de uso: por avistajes de CLF; si no hay, una foto con la serie en sus metadatos.
  let seal: "NONE" | "USAGE_VERIFIED" | "PROOF_PHOTO" = "NONE";
  let usageSince: Date | null = null;
  let usagePhotosCount: number | null = null;
  let otherOwner = false;
  if (item.serialNormalized) {
    const sightings = await prisma.gearSerialSighting.findMany({
      where: { serialNormalized: item.serialNormalized },
      select: { photographerId: true, firstSeenAt: true, photosCount: true },
    });
    const result = computeUsageSeal(sightings, sellerId);
    otherOwner = result.otherOwner;
    if (result.seal === "USAGE_VERIFIED") {
      seal = "USAGE_VERIFIED";
      usageSince = result.since;
      usagePhotosCount = result.photos;
    } else if (files.proofPhoto && files.proofPhoto.size > 0) {
      // La foto de prueba se lee en memoria y nunca se guarda.
      const buffer = Buffer.from(await files.proofPhoto.arrayBuffer());
      if (await proofPhotoMatches(buffer, item.serialNormalized)) seal = "PROOF_PHOTO";
    }
  }

  const report = item.serialNormalized
    ? await findActiveReportForSerial(item.serialNormalized, sellerId)
    : null;
  const status: "IN_REVIEW" | "PUBLISHED" = report ? "IN_REVIEW" : "PUBLISHED";
  const now = new Date();

  let listing: { id: number };
  try {
    listing = await prisma.$transaction(async (tx) => {
      // Se bloquea la fila del equipo: dos envíos simultáneos (o una denuncia) se ponen en fila.
      await tx.$queryRaw`SELECT id FROM "GearItem" WHERE id = ${gearItemId} FOR UPDATE`;
      const fresh = await tx.gearItem.findFirst({ where: { id: gearItemId, ownerId: sellerId } });
      if (!fresh) throw new EquipoError("NO_ENCONTRADO");
      const ownOpen =
        (await tx.stolenGearReport.count({
          where: { gearItemId, reporterId: sellerId, status: { in: ["PENDING_REVIEW", "ACTIVE"] } },
        })) > 0;
      const openListing = await hasActiveListingOrSale(tx, gearItemId);
      const recheck = listingBlocker(fresh, {
        ownReportOpen: ownOpen,
        activeListing: openListing,
        serialPhotoKey,
        fotosOpcionales: fotosOpcionales(),
      });
      if (recheck) throw new EquipoError("DATO_INVALIDO", recheck);
      const created = await tx.gearListing.create({
        data: {
          sellerId,
          gearItemId,
          status,
          kind: item.kind,
          make: item.make,
          model: item.model,
          mount: data.mount ?? null,
          priceArs: data.priceArs,
          priceUsdRef: data.priceUsdRef ?? null,
          condition: data.condition,
          description: data.description || null,
          accessories: data.accessories || null,
          province: data.province,
          city: data.city,
          serialPhotoKey,
          declaredFirstOwner: data.declaredFirstOwner ?? false,
          includesCharger: data.includesCharger ?? false,
          batteriesCount: data.batteriesCount ?? null,
          includesManual: data.includesManual ?? false,
          includesBox: data.includesBox ?? false,
          usageSeal: seal,
          usageSince,
          usagePhotosCount,
          socialConsentAt: now,
          ...(report ? { reviewNote: `Denuncia activa #${report.id}` } : { publishedAt: now }),
        },
      });
      await tx.gearItem.update({ where: { id: gearItemId }, data: { status: "FOR_SALE" } });
      await tx.gearItemEvent.create({
        data: {
          gearItemId,
          type: "STATUS_CHANGED",
          detail: { listingId: created.id, accion: "publicado" },
        },
      });
      return created;
    });
  } catch (err) {
    if (serialPhotoKey) {
      console.error(`[publicaciones] Falló la transacción; archivo huérfano: ${serialPhotoKey}`);
    }
    throw err;
  }

  if (status === "IN_REVIEW") {
    await notifyAdmin(
      "publicacion_en_revision_admin",
      `Publicación #${listing.id} del equipo #${gearItemId} quedó en revisión.`,
    );
  }
  if (otherOwner) {
    await notifyAdmin(
      "serie_de_otro_usuario_admin",
      `Publicación #${listing.id} del equipo #${gearItemId}: la serie apareció en fotos de otro usuario.`,
    );
  }
  // Pedidos «Busco»: si el dueño respondió «Me interesa vender», el comprador recibe el enlace.
  if (status === "PUBLISHED") await notifyRequestBuyers(listing.id);
  return { listingId: listing.id, status };
}

/**
 * Cambia la publicación sólo si sigue en uno de los estados de partida (si no, otro cambio —por
 * ejemplo una denuncia— ganó) y recién después toca el equipo, también condicionado.
 */
async function transition(
  listing: { id: number; gearItemId: number },
  sellerId: number,
  from: ListingStatusValue[],
  listingData: Record<string, unknown>,
  itemChange: { from: "FOR_SALE" | "IN_USE"; to: "FOR_SALE" | "IN_USE" } | null,
  accion: string,
  eventType: "STATUS_CHANGED" | "UPDATED" = "STATUS_CHANGED",
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const r = await tx.gearListing.updateMany({
      where: { id: listing.id, sellerId, status: { in: from } },
      data: listingData,
    });
    if (r.count === 0) throw noModificable();
    if (itemChange) {
      await tx.gearItem.updateMany({
        where: { id: listing.gearItemId, status: itemChange.from },
        data: { status: itemChange.to },
      });
    }
    await tx.gearItemEvent.create({
      data: {
        gearItemId: listing.gearItemId,
        type: eventType,
        detail: { listingId: listing.id, accion },
      },
    });
  });
}

export async function pauseListing(sellerId: number, listingId: number): Promise<void> {
  const listing = await findOwnListing(sellerId, listingId);
  if (listing.status !== "PUBLISHED") throw noModificable();
  await transition(listing, sellerId, ["PUBLISHED"], { status: "PAUSED" }, FOR_SALE_TO_IN_USE, "pausado");
}

export async function resumeListing(
  sellerId: number,
  listingId: number,
): Promise<{ status: "IN_REVIEW" | "PUBLISHED" }> {
  const listing = await findOwnListing(sellerId, listingId);
  if (listing.status !== "PAUSED") throw noModificable();
  const item = await prisma.gearItem.findFirst({
    where: { id: listing.gearItemId, ownerId: sellerId },
    select: { serialNormalized: true },
  });
  const report = item?.serialNormalized
    ? await findActiveReportForSerial(item.serialNormalized, sellerId)
    : null;
  if (report) {
    await transition(
      listing,
      sellerId,
      ["PAUSED"],
      { status: "IN_REVIEW", reviewNote: `Denuncia activa #${report.id}` },
      IN_USE_TO_FOR_SALE,
      "reanudado",
    );
    await notifyAdmin(
      "publicacion_en_revision_admin",
      `Publicación #${listing.id} del equipo #${listing.gearItemId} quedó en revisión al reanudarse.`,
    );
    return { status: "IN_REVIEW" };
  }
  await transition(listing, sellerId, ["PAUSED"], { status: "PUBLISHED", reviewNote: null }, IN_USE_TO_FOR_SALE, "reanudado");
  await notifyRequestBuyers(listing.id);
  return { status: "PUBLISHED" };
}

export async function closeListing(sellerId: number, listingId: number): Promise<void> {
  const listing = await findOwnListing(sellerId, listingId);
  if (!OPEN_STATUSES.includes(listing.status as ListingStatusValue)) throw noModificable();
  await transition(listing, sellerId, OPEN_STATUSES, { status: "CLOSED", closedAt: new Date() }, FOR_SALE_TO_IN_USE, "cerrado");
}

/** Edita los datos comerciales; el sello de uso no cambia. */
export async function updateListing(
  sellerId: number,
  listingId: number,
  input: ListingInput,
): Promise<void> {
  const listing = await findOwnListing(sellerId, listingId);
  if (listing.status !== "PUBLISHED" && listing.status !== "PAUSED") throw noModificable();
  const data = validateListingInput(input, listing.kind);
  await transition(
    listing,
    sellerId,
    ["PUBLISHED", "PAUSED"],
    {
      mount: data.mount ?? null,
      priceArs: data.priceArs,
      priceUsdRef: data.priceUsdRef ?? null,
      condition: data.condition,
      description: data.description || null,
      accessories: data.accessories || null,
      province: data.province,
      city: data.city,
      declaredFirstOwner: data.declaredFirstOwner ?? false,
      includesCharger: data.includesCharger ?? false,
      batteriesCount: data.batteriesCount ?? null,
      includesManual: data.includesManual ?? false,
      includesBox: data.includesBox ?? false,
    },
    null,
    "editado",
    "UPDATED",
  );
}

/**
 * Cierra las publicaciones abiertas del equipo; lo llaman `reportIncident` y `confirmPurchase`
 * (antes del traspaso) en su transacción.
 */
export async function closeListingsForItem(tx: Tx, gearItemId: number): Promise<void> {
  await tx.gearListing.updateMany({
    where: { gearItemId, status: { in: OPEN_STATUSES } },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

export async function listSellerListings(sellerId: number): Promise<GearListing[]> {
  const rows = await prisma.gearListing.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  });
  // El motivo interno de una revisión nunca llega al vendedor.
  return rows.map((r) => ({ ...r, reviewNote: null }));
}
