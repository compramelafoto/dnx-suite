import { prisma } from "@repo/db";
import { getPublicListingsByIds, type PublicListing } from "@/lib/catalogo/buscar";
import { EquipoError, KIND_LABELS } from "@/lib/inventario/equipos";
import type { GearItemKind } from "@/lib/inventario/tipos";
import {
  CONDITION_LABELS,
  PROVINCIAS,
  type GearListingCondition,
} from "@/lib/publicaciones/catalogos";
import { notifyRequestBuyers } from "./cruce";
import {
  CANCEL_LIMIT,
  MAX_ACTIVE_REQUESTS,
  NOTICES_PER_WEEK,
  REQUEST_DAYS,
  makeVariants,
  modelKey,
} from "./modelo";

/**
 * Pedidos «Busco»: el comprador dice qué equipo busca y el cron diario (`cruce.ts`) avisa en
 * privado a los dueños que lo tienen en su inventario. PRIVACIDAD: nada de lo que este módulo
 * devuelve al comprador dice quién tiene el equipo ni cuántos dueños recibieron el aviso; las
 * únicas coincidencias que ve son publicaciones que ya están en el catálogo público.
 */

export { CANCEL_LIMIT, MAX_ACTIVE_REQUESTS, NOTICES_PER_WEEK, REQUEST_DAYS };

const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_INT4 = 2_147_483_647;
const MAX_MARCA = 60;
const MAX_MODELO = 120;
/** Publicaciones que se muestran al crear el pedido. */
const MAX_COINCIDENCIAS = 12;

export const MENSAJE_MAXIMO_PEDIDOS = `Llegaste al máximo de ${MAX_ACTIVE_REQUESTS} pedidos activos.`;
export const MENSAJE_MUCHOS_CANCELADOS =
  "Cancelaste muchos pedidos en poco tiempo. Vas a poder crear otro en unos días.";
export const MENSAJE_PEDIDO_NO_RENOVABLE = "Este pedido ya no se puede renovar.";
export const MENSAJE_PEDIDO_NO_ACTIVO = "Este pedido ya no está activo.";
export const MENSAJE_AVISO_RESPONDIDO = "Ya respondiste este aviso.";
export const MENSAJE_PEDIDO_SIN_IDENTIDAD =
  "Para crear un pedido necesitás tener tu identidad verificada.";

export type PurchaseRequestInput = {
  kind: GearItemKind;
  make: string;
  model: string;
  maxPriceArs?: number;
  minCondition?: GearListingCondition;
  province?: string;
};

export type PurchaseRequestStatus = "ACTIVE" | "FULFILLED" | "CANCELLED" | "EXPIRED";

export type MyPurchaseRequest = {
  id: number;
  kind: GearItemKind;
  make: string;
  model: string;
  maxPriceArs: number | null;
  minCondition: GearListingCondition | null;
  province: string | null;
  status: PurchaseRequestStatus;
  expiresAt: Date;
  createdAt: Date;
  cancelledAt: Date | null;
};

function invalido(mensaje: string): EquipoError {
  return new EquipoError("DATO_INVALIDO", mensaje);
}

function esClave<T extends object>(obj: T, k: unknown): k is keyof T {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(obj, k);
}

function validar(input: PurchaseRequestInput) {
  if (!esClave(KIND_LABELS, input.kind)) throw invalido("Elegí el tipo de equipo.");
  const make = (input.make ?? "").trim().replace(/\s+/g, " ");
  const model = (input.model ?? "").trim().replace(/\s+/g, " ");
  if (!make) throw invalido("La marca no puede quedar vacía.");
  if (!model) throw invalido("El modelo no puede quedar vacío.");
  if (make.length > MAX_MARCA || model.length > MAX_MODELO) {
    throw invalido("La marca o el modelo son demasiado largos.");
  }
  const max = input.maxPriceArs;
  if (max !== undefined && (!Number.isInteger(max) || max <= 0 || max > MAX_INT4)) {
    throw invalido("El precio máximo tiene que ser un número entero de pesos, mayor a cero.");
  }
  if (input.minCondition !== undefined && !esClave(CONDITION_LABELS, input.minCondition)) {
    throw invalido("Elegí el estado del equipo.");
  }
  if (input.province !== undefined && !PROVINCIAS.includes(input.province)) {
    throw invalido("Elegí una provincia de la lista.");
  }
  return {
    kind: input.kind,
    make,
    model,
    maxPriceArs: max ?? null,
    minCondition: input.minCondition ?? null,
    province: input.province ?? null,
  };
}

async function activosVigentes(buyerId: number, now: Date): Promise<number> {
  return prisma.purchaseRequest.count({
    where: { buyerId, status: "ACTIVE", expiresAt: { gt: now } },
  });
}

/**
 * Crea un pedido y devuelve las publicaciones del catálogo que ya coinciden con ese modelo (sin
 * las del propio comprador). Nunca mira inventarios: eso lo hace el cron, en privado.
 */
export async function createPurchaseRequest(
  buyerId: number,
  input: PurchaseRequestInput,
): Promise<{ requestId: number; matches: PublicListing[] }> {
  const data = validar(input);
  const now = new Date();

  // El dueño recibe «un comprador con identidad verificada»: se exige acá y otra vez en el cron.
  const identidad = await prisma.identityVerification.findUnique({
    where: { userId: buyerId },
    select: { status: true },
  });
  if (identidad?.status !== "APPROVED") throw invalido(MENSAJE_PEDIDO_SIN_IDENTIDAD);

  if ((await activosVigentes(buyerId, now)) >= MAX_ACTIVE_REQUESTS) {
    throw invalido(MENSAJE_MAXIMO_PEDIDOS);
  }
  const cancelados = await prisma.purchaseRequest.count({
    where: {
      buyerId,
      status: "CANCELLED",
      cancelledAt: { gte: new Date(now.getTime() - REQUEST_DAYS * DIA_MS) },
    },
  });
  if (cancelados >= CANCEL_LIMIT) throw invalido(MENSAJE_MUCHOS_CANCELADOS);

  const key = modelKey(data.make, data.model);
  const created = await prisma.purchaseRequest.create({
    data: {
      buyerId,
      ...data,
      modelKey: key,
      status: "ACTIVE",
      expiresAt: new Date(now.getTime() + REQUEST_DAYS * DIA_MS),
    },
    select: { id: true },
  });

  const candidatas = await prisma.gearListing.findMany({
    where: {
      status: "PUBLISHED",
      kind: data.kind,
      sellerId: { not: buyerId },
      OR: makeVariants(data.make).map((v) => ({
        make: { startsWith: v, mode: "insensitive" as const },
      })),
    },
    select: { id: true, make: true, model: true },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  const ids = candidatas
    .filter((l) => modelKey(l.make, l.model) === key)
    .slice(0, MAX_COINCIDENCIAS)
    .map((l) => l.id);
  // El armado público del catálogo (vendedor verificado, nombre de pila, una foto).
  const matches = await getPublicListingsByIds(ids);
  return { requestId: created.id, matches };
}

async function pedidoPropio(buyerId: number, requestId: number) {
  const valido = Number.isInteger(requestId) && requestId > 0;
  const pedido = valido
    ? await prisma.purchaseRequest.findFirst({
        where: { id: requestId, buyerId },
        select: { id: true, status: true },
      })
    : null;
  if (!pedido) throw new EquipoError("NO_ENCONTRADO", "No encontramos ese pedido.");
  return pedido;
}

/** Suma 30 días desde hoy a un pedido activo o vencido (el vencido vuelve a activo). */
export async function renewRequest(buyerId: number, requestId: number): Promise<void> {
  const pedido = await pedidoPropio(buyerId, requestId);
  if (pedido.status !== "ACTIVE" && pedido.status !== "EXPIRED") {
    throw invalido(MENSAJE_PEDIDO_NO_RENOVABLE);
  }
  const now = new Date();
  if (pedido.status === "EXPIRED" && (await activosVigentes(buyerId, now)) >= MAX_ACTIVE_REQUESTS) {
    throw invalido(MENSAJE_MAXIMO_PEDIDOS);
  }
  const r = await prisma.purchaseRequest.updateMany({
    where: { id: requestId, buyerId, status: { in: ["ACTIVE", "EXPIRED"] } },
    data: { status: "ACTIVE", expiresAt: new Date(now.getTime() + REQUEST_DAYS * DIA_MS) },
  });
  if (r.count === 0) throw invalido(MENSAJE_PEDIDO_NO_RENOVABLE);
}

export async function cancelRequest(buyerId: number, requestId: number): Promise<void> {
  const valido = Number.isInteger(requestId) && requestId > 0;
  const r = valido
    ? await prisma.purchaseRequest.updateMany({
        where: { id: requestId, buyerId, status: "ACTIVE" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      })
    : { count: 0 };
  if (r.count === 0) {
    await pedidoPropio(buyerId, requestId);
    throw invalido(MENSAJE_PEDIDO_NO_ACTIVO);
  }
}

/** Los pedidos del comprador, los más nuevos primero. Sin nada sobre los avisos enviados. */
export async function listMyRequests(buyerId: number): Promise<MyPurchaseRequest[]> {
  const rows = (await prisma.purchaseRequest.findMany({
    where: { buyerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      kind: true,
      make: true,
      model: true,
      maxPriceArs: true,
      minCondition: true,
      province: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      cancelledAt: true,
    },
  })) as MyPurchaseRequest[];
  const now = new Date();
  // Hasta que corra el cron, un activo pasado de fecha ya está vencido.
  return rows.map((r) =>
    r.status === "ACTIVE" && r.expiresAt <= now ? { ...r, status: "EXPIRED" } : r,
  );
}

/**
 * El dueño responde el aviso de un pedido, una sola vez. Un aviso de otro dueño no existe
 * (NO_ENCONTRADO). Si dice que le interesa y ese equipo ya está publicado, el comprador recibe
 * el enlace enseguida.
 */
export async function respondNotice(
  ownerId: number,
  noticeId: number,
  response: "INTERESTED" | "DECLINED",
): Promise<{ gearItemId: number }> {
  if (response !== "INTERESTED" && response !== "DECLINED") {
    throw invalido("Elegí una respuesta.");
  }
  const valido = Number.isInteger(noticeId) && noticeId > 0;
  const notice = valido
    ? await prisma.purchaseRequestNotice.findFirst({
        where: { id: noticeId, ownerId },
        select: { gearItemId: true, response: true },
      })
    : null;
  if (!notice) throw new EquipoError("NO_ENCONTRADO", "No encontramos ese aviso.");
  if (notice.response !== null) throw invalido(MENSAJE_AVISO_RESPONDIDO);

  const r = await prisma.purchaseRequestNotice.updateMany({
    where: { id: noticeId, ownerId, response: null },
    data: { response, respondedAt: new Date() },
  });
  if (r.count === 0) throw invalido(MENSAJE_AVISO_RESPONDIDO);

  if (response === "INTERESTED") {
    const publicada = await prisma.gearListing.findFirst({
      where: { gearItemId: notice.gearItemId, sellerId: ownerId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (publicada) await notifyRequestBuyers(publicada.id);
  }
  return { gearItemId: notice.gearItemId };
}
