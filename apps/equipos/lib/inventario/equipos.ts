import { prisma } from "@repo/db";
import type { GearItem, GearItemEvent, GearItemKind, GearItemStatus } from "./tipos";
import { normalizeGearSerial } from "@repo/gear/serial";
import { MAX_PHOTOS_PER_ITEM, uploadPrivateFile, validateFile } from "@/lib/archivos";
import { avisarAlAdmin } from "@/lib/aviso-admin";
import { urlBaseDeLaApp } from "@/lib/sesion";

/**
 * Inventario «Mi equipo». Toda consulta filtra por dueño: un equipo ajeno es, a todos los
 * efectos, un equipo que no existe (NO_ENCONTRADO). Cada cambio escribe su evento de historial
 * en la misma transacción.
 */

export type EquipoErrorCode =
  | "NO_ENCONTRADO"
  | "DATO_INVALIDO"
  | "LIMITE_FOTOS"
  | "ARCHIVO_INVALIDO"
  | "FALTA_COMPROBANTE"
  | "YA_DENUNCIADO"
  | "NO_DENUNCIABLE"
  | "EN_DENUNCIA"
  | "FALTA_VALOR"
  | "NO_ASEGURABLE"
  | "CON_PUBLICACION"
  | "CON_DENUNCIA";

export class EquipoError extends Error {
  constructor(
    public readonly code: EquipoErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "EquipoError";
  }
}

export const KIND_LABELS: Record<GearItemKind, string> = {
  BODY: "Cuerpo de cámara",
  LENS: "Lente",
  FLASH: "Flash",
  TRIPOD: "Trípode",
  BAG: "Bolso o mochila",
  FILTER: "Filtro",
  DRONE: "Drone",
  OTHER: "Otro",
};

export const STATUS_LABELS: Record<GearItemStatus, string> = {
  IN_USE: "En uso",
  FOR_SALE: "En venta",
  SOLD: "Vendido",
  STOLEN: "Robado",
  LOST: "Perdido",
  RECOVERED: "Recuperado",
};

/** Estados que la persona puede elegir a mano; los de denuncia salen de ese flujo. */
export const MANUAL_STATUSES: GearItemStatus[] = ["IN_USE", "FOR_SALE", "SOLD"];

export type ManualItemInput = {
  kind: GearItemKind;
  make: string;
  model: string;
  serialRaw?: string | null;
  purchaseDate?: Date | null;
  declaredValueArs?: number | null;
  declaredValueUsd?: number | null;
  notes?: string | null;
};

export type ItemPatch = Partial<ManualItemInput> & { status?: GearItemStatus };

function invalid(msg: string): never {
  throw new EquipoError("DATO_INVALIDO", msg);
}

function checkMoney(v: number | null | undefined, label: string): void {
  if (v == null) return;
  if (!Number.isInteger(v) || v < 0) invalid(`${label}: usá un número entero, sin decimales.`);
}

/** `fem` = el rótulo es femenino (por ejemplo "La marca"): el mensaje concuerda en género. */
function checkText(v: string | undefined, label: string, fem = false): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (!t) invalid(`${label} no puede quedar ${fem ? "vacía" : "vacío"}.`);
  return t;
}

function cleanSerial(raw: string | null | undefined): {
  serialRaw: string | null;
  serialNormalized: string | null;
} {
  const t = raw?.trim() ?? "";
  if (!t) return { serialRaw: null, serialNormalized: null };
  return { serialRaw: t, serialNormalized: normalizeGearSerial(t) };
}

/** Si la serie ya la tiene OTRA persona, se avisa al admin. Nunca frena ni rompe la operación. */
async function alertSerialConflict(
  ownerId: number,
  itemId: number,
  serialNormalized: string | null,
): Promise<void> {
  if (!serialNormalized) return;
  try {
    const other = await prisma.gearItem.findFirst({
      where: { serialNormalized, ownerId: { not: ownerId } },
      select: { id: true },
    });
    if (!other) return;
    const base = process.env.CLF_URL?.replace(/\/$/, "");
    await avisarAlAdmin("equipos", "conflicto_serie_admin", {
      detalle: `Serie ${serialNormalized}: equipo #${itemId} (usuario ${ownerId}) y equipo #${other.id} de otro usuario.`,
      url: base ? `${base}/admin/equipos-robados` : "",
    });
  } catch (err) {
    console.error("[equipos] No se pudo avisar el conflicto de serie:", err);
  }
}

export const MENSAJE_IDENTIDAD_CON_PUBLICACION =
  "Este equipo tiene una publicación abierta: cerrala antes de cambiar sus datos de identidad.";

/**
 * Cambiar la serie de un equipo que alguna vez tuvo una publicación retenida por una denuncia
 * (evento «retenido» o nota «Denuncia activa») es una señal para el admin: podría estar
 * «lavando» la serie para volver a publicar limpio. Nunca frena ni rompe la operación.
 */
async function alertSerialChangeAfterHold(
  ownerId: number,
  itemId: number,
  before: string | null,
  after: string | null,
): Promise<void> {
  try {
    const [evento, retenida] = await Promise.all([
      prisma.gearItemEvent.findFirst({
        where: { gearItemId: itemId, detail: { path: ["accion"], equals: "retenido" } },
        select: { id: true },
      }),
      prisma.gearListing.findFirst({
        where: { gearItemId: itemId, reviewNote: { contains: "Denuncia activa" } },
        select: { id: true },
      }),
    ]);
    if (!evento && !retenida) return;
    await avisarAlAdmin("equipos", "cambio_serie_admin", {
      detalle: `Equipo #${itemId} (usuario ${ownerId}): la serie pasó de ${before ?? "(sin serie)"} a ${after ?? "(sin serie)"}.`,
      url: `${urlBaseDeLaApp()}/admin/publicaciones`,
    });
  } catch (err) {
    console.error("[equipos] No se pudo revisar el cambio de serie:", err);
  }
}

export async function findOwnItem(userId: number, itemId: number) {
  const item = await prisma.gearItem.findFirst({ where: { id: itemId, ownerId: userId } });
  if (!item) throw new EquipoError("NO_ENCONTRADO");
  return item;
}

export async function listItems(userId: number): Promise<GearItem[]> {
  return prisma.gearItem.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" } });
}

export async function getItem(userId: number, itemId: number): Promise<GearItem> {
  return findOwnItem(userId, itemId);
}

export async function confirmSighting(userId: number, sightingId: number): Promise<GearItem> {
  const s = await prisma.gearSerialSighting.findFirst({
    where: { id: sightingId, photographerId: userId },
  });
  if (!s) throw new EquipoError("NO_ENCONTRADO");

  const existing = await prisma.gearItem.findUnique({ where: { sightingId } });
  if (existing) {
    if (existing.ownerId !== userId) throw new EquipoError("NO_ENCONTRADO");
    return existing;
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.gearItem.create({
      data: {
        ownerId: userId,
        kind: s.kind,
        make: s.make,
        model: s.model,
        serialRaw: s.serialRaw,
        serialNormalized: s.serialNormalized,
        source: "CLF_SIGHTING",
        sightingId: s.id,
      },
    });
    await tx.gearItemEvent.create({
      data: { gearItemId: created.id, type: "CONFIRMED_FROM_CLF", detail: { sightingId: s.id } },
    });
    return created;
  });
  await alertSerialConflict(userId, item.id, item.serialNormalized);
  return item;
}

export async function dismissSighting(userId: number, sightingId: number): Promise<void> {
  const s = await prisma.gearSerialSighting.findFirst({
    where: { id: sightingId, photographerId: userId },
    select: { id: true },
  });
  if (!s) throw new EquipoError("NO_ENCONTRADO");
  await prisma.gearSightingDismissal.upsert({
    where: { userId_sightingId: { userId, sightingId } },
    create: { userId, sightingId },
    update: {},
  });
}

export async function createManualItem(userId: number, input: ManualItemInput): Promise<GearItem> {
  const make = checkText(input.make, "La marca", true);
  const model = checkText(input.model, "El modelo");
  checkMoney(input.declaredValueArs, "Valor en pesos");
  checkMoney(input.declaredValueUsd, "Valor en dólares");
  const serial = cleanSerial(input.serialRaw);

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.gearItem.create({
      data: {
        ownerId: userId,
        kind: input.kind,
        make: make!,
        model: model!,
        ...serial,
        source: "MANUAL",
        purchaseDate: input.purchaseDate ?? null,
        declaredValueArs: input.declaredValueArs ?? null,
        declaredValueUsd: input.declaredValueUsd ?? null,
        notes: input.notes?.trim() || null,
      },
    });
    await tx.gearItemEvent.create({ data: { gearItemId: created.id, type: "CREATED" } });
    return created;
  });
  await alertSerialConflict(userId, item.id, item.serialNormalized);
  return item;
}

export async function updateItem(
  userId: number,
  itemId: number,
  patch: ItemPatch,
): Promise<GearItem> {
  const current = await findOwnItem(userId, itemId);

  const data: Record<string, unknown> = {};
  if (patch.kind !== undefined) data.kind = patch.kind;
  const make = checkText(patch.make, "La marca", true);
  if (make !== undefined) data.make = make;
  const model = checkText(patch.model, "El modelo");
  if (model !== undefined) data.model = model;
  if (patch.purchaseDate !== undefined) data.purchaseDate = patch.purchaseDate;
  if (patch.declaredValueArs !== undefined) {
    checkMoney(patch.declaredValueArs, "Valor en pesos");
    data.declaredValueArs = patch.declaredValueArs;
  }
  if (patch.declaredValueUsd !== undefined) {
    checkMoney(patch.declaredValueUsd, "Valor en dólares");
    data.declaredValueUsd = patch.declaredValueUsd;
  }
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.status !== undefined) {
    if (!MANUAL_STATUSES.includes(patch.status)) invalid("Ese estado no se puede elegir a mano.");
    data.status = patch.status;
  }
  let serialChanged = false;
  if (patch.serialRaw !== undefined) {
    const serial = cleanSerial(patch.serialRaw);
    Object.assign(data, serial);
    serialChanged = serial.serialNormalized !== current.serialNormalized;
  }

  const statusChanged = patch.status !== undefined && patch.status !== current.status;
  const identityChanged =
    (patch.kind !== undefined && patch.kind !== current.kind) ||
    (data.make !== undefined && data.make !== current.make) ||
    (data.model !== undefined && data.model !== current.model) ||
    serialChanged;

  // Con una denuncia en curso, la identidad del equipo y su estado no se tocan: la única salida
  // de STOLEN/LOST es «Lo recuperé» (markRecovered).
  if ((current.status === "STOLEN" || current.status === "LOST") && (statusChanged || identityChanged)) {
    throw new EquipoError(
      "EN_DENUNCIA",
      "Este equipo tiene una denuncia: no se pueden cambiar su estado, serie, tipo, marca ni modelo. Si lo recuperaste, usá «Lo recuperé».",
    );
  }

  // Con una publicación abierta, el estado lo maneja la publicación (publicar, pausar, cerrar) y
  // la identidad queda fija: el sello y la serie que ve el comprador salieron de esos datos.
  // Reenviar los mismos valores (el formulario siempre manda todo) no cuenta como cambio.
  if (statusChanged || identityChanged) {
    const open = await prisma.gearListing.findFirst({
      where: { gearItemId: itemId, status: { in: ["IN_REVIEW", "PUBLISHED", "PAUSED"] } },
      select: { id: true },
    });
    if (open && identityChanged) {
      throw new EquipoError("CON_PUBLICACION", MENSAJE_IDENTIDAD_CON_PUBLICACION);
    }
    if (open) {
      throw new EquipoError(
        "CON_PUBLICACION",
        "Este equipo tiene una publicación activa; pausala o cerrala primero.",
      );
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.gearItem.update({ where: { id: itemId }, data });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: itemId,
        type: statusChanged ? "STATUS_CHANGED" : "UPDATED",
        detail: statusChanged
          ? { from: current.status, to: patch.status }
          : { fields: Object.keys(data) },
      },
    });
    return updated;
  });
  if (serialChanged) {
    await alertSerialConflict(userId, itemId, item.serialNormalized);
    await alertSerialChangeAfterHold(userId, itemId, current.serialNormalized, item.serialNormalized);
  }
  return item;
}

async function uploadOrThrow(file: File, kind: "proof" | "photo") {
  const error = validateFile(file, kind);
  if (error) throw new EquipoError("ARCHIVO_INVALIDO", error);
  return uploadPrivateFile(file, kind);
}

export async function attachItemPhoto(
  userId: number,
  itemId: number,
  file: File,
): Promise<GearItem> {
  const current = await findOwnItem(userId, itemId);
  if (current.photoKeys.length >= MAX_PHOTOS_PER_ITEM) {
    throw new EquipoError("LIMITE_FOTOS", `Cada equipo admite hasta ${MAX_PHOTOS_PER_ITEM} fotos.`);
  }
  const { key } = await uploadOrThrow(file, "photo");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.gearItem.update({
      where: { id: itemId },
      data: { photoKeys: [...current.photoKeys, key] },
    });
    await tx.gearItemEvent.create({
      data: { gearItemId: itemId, type: "UPDATED", detail: { fields: ["photoKeys"] } },
    });
    return updated;
  });
}

export async function attachPurchaseProof(
  userId: number,
  itemId: number,
  file: File,
): Promise<GearItem> {
  await findOwnItem(userId, itemId);
  const { key, mime } = await uploadOrThrow(file, "proof");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.gearItem.update({
      where: { id: itemId },
      data: { purchaseProofKey: key, purchaseProofMime: mime },
    });
    await tx.gearItemEvent.create({ data: { gearItemId: itemId, type: "PROOF_ADDED" } });
    return updated;
  });
}

export async function listItemHistory(userId: number, itemId: number): Promise<GearItemEvent[]> {
  await findOwnItem(userId, itemId);
  const events = await prisma.gearItemEvent.findMany({
    where: { gearItemId: itemId },
    orderBy: { createdAt: "desc" },
  });
  // Los eventos de cruce con denuncias ajenas (`matchReportId`) son internos: quien tiene el
  // equipo nunca debe enterarse de que coincidió con una denuncia.
  return events.filter((e) => {
    const d = e.detail;
    return !(d && typeof d === "object" && !Array.isArray(d) && "matchReportId" in d);
  });
}
