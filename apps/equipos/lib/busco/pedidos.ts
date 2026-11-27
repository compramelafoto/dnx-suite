import { prisma } from "@repo/db";
import { getPublicListingsByIds, sellerFirstName, type PublicListing } from "@/lib/catalogo/buscar";
import { EquipoError, KIND_LABELS } from "@/lib/inventario/equipos";
import type { GearItemKind } from "@/lib/inventario/tipos";
import {
  CONDITION_LABELS,
  PROVINCIAS,
  type GearListingCondition,
} from "@/lib/publicaciones/catalogos";
import { getUserRating, type UserRating } from "@/lib/ventas/calificaciones";
import { MENSAJE_CUENTA_SUSPENDIDA, isBlocked } from "@/lib/usuarios/bloqueo";
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
export const MENSAJE_EQUIPO_FUERA_DE_INVENTARIO = "Este equipo ya no está en tu inventario.";

/** Estados del equipo con los que el dueño todavía puede responder un aviso. */
const EQUIPO_RESPONDIBLE: string[] = ["IN_USE", "RECOVERED", "FOR_SALE"];

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
  /** Sólo en un pedido cumplido: la publicación que lo cumplió, para mandar al comprador. */
  listingId: number | null;
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
  // En vivo, además del guard de la página (que redirige a /cuenta/bloqueada).
  if (await isBlocked(buyerId)) throw invalido(MENSAJE_CUENTA_SUSPENDIDA);

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

  return { requestId: created.id, matches: await coincidencias(buyerId, data.kind, data.make, key) };
}

/** Publicaciones del catálogo con ese modelo, sin las del propio comprador. */
async function coincidencias(
  buyerId: number,
  kind: GearItemKind,
  make: string,
  key: string,
): Promise<PublicListing[]> {
  const candidatas = await prisma.gearListing.findMany({
    where: {
      status: "PUBLISHED",
      kind,
      sellerId: { not: buyerId },
      OR: makeVariants(make).map((v) => ({
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
  return getPublicListingsByIds(ids);
}

/**
 * Las publicaciones que hoy coinciden con un pedido propio (para mostrarlas después de crearlo).
 * Un pedido de otra persona no existe: `null`.
 */
export async function getRequestMatches(
  buyerId: number,
  requestId: number,
): Promise<{ make: string; model: string; matches: PublicListing[] } | null> {
  if (!Number.isInteger(requestId) || requestId <= 0) return null;
  const p = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, buyerId },
    select: { kind: true, make: true, model: true, modelKey: true },
  });
  if (!p) return null;
  const matches = await coincidencias(buyerId, p.kind as GearItemKind, p.make, p.modelKey);
  return { make: p.make, model: p.model, matches };
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

/**
 * Los pedidos del comprador, los más nuevos primero. De los avisos sólo sale, en un pedido
 * cumplido, la publicación que lo cumplió (ya es pública): nunca quién ni cuántos recibieron aviso.
 */
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
  })) as Omit<MyPurchaseRequest, "listingId">[];

  const cumplidos = rows.filter((r) => r.status === "FULFILLED").map((r) => r.id);
  const publicacion = new Map<number, number>();
  if (cumplidos.length > 0) {
    const avisos = await prisma.purchaseRequestNotice.findMany({
      where: { requestId: { in: cumplidos }, listingId: { not: null } },
      orderBy: { id: "asc" },
      select: { requestId: true, listingId: true },
    });
    for (const a of avisos) {
      if (a.listingId != null && !publicacion.has(a.requestId)) publicacion.set(a.requestId, a.listingId);
    }
  }

  const now = new Date();
  // Hasta que corra el cron, un activo pasado de fecha ya está vencido.
  return rows.map((r) => ({
    ...r,
    status: r.status === "ACTIVE" && r.expiresAt <= now ? "EXPIRED" : r.status,
    listingId: r.status === "FULFILLED" ? (publicacion.get(r.id) ?? null) : null,
  }));
}

export type NoticeForOwner = {
  id: number;
  gearItemId: number;
  gearItem: { make: string; model: string };
  sentAt: Date;
  response: "INTERESTED" | "DECLINED" | null;
  respondedAt: Date | null;
  /** El comprador ya recibió el enlace a la publicación de este equipo. */
  publicado: boolean;
  request: {
    kind: GearItemKind;
    make: string;
    model: string;
    maxPriceArs: number | null;
    minCondition: GearListingCondition | null;
    province: string | null;
    /** El pedido sigue abierto (activo y sin vencer). */
    abierto: boolean;
  };
  /**
   * Sólo si el dueño respondió «Me interesa vender» (spec §16.4): el nombre del DNI si la
   * identidad está aprobada; si no, el nombre de pila. Antes de eso (o si dijo «No, gracias»),
   * `null`: el nombre ni siquiera sale de este módulo.
   */
  buyerName: string | null;
  /** Identidad aprobada hoy (para el sello «Comprador con identidad verificada»). */
  buyerVerified: boolean;
  buyerRating: UserRating;
};

/**
 * El aviso de un pedido, sólo para su dueño (de otro dueño: `null`). Antes de responder ve la
 * identidad verificada y la calificación del comprador; el nombre, recién si responde que le
 * interesa vender.
 */
export async function getNoticeForOwner(
  ownerId: number,
  noticeId: number,
): Promise<NoticeForOwner | null> {
  if (!Number.isInteger(noticeId) || noticeId <= 0) return null;
  const n = await prisma.purchaseRequestNotice.findFirst({
    where: { id: noticeId, ownerId },
    select: {
      id: true,
      gearItemId: true,
      sentAt: true,
      response: true,
      respondedAt: true,
      listingId: true,
      gearItem: { select: { make: true, model: true } },
      request: {
        select: {
          buyerId: true,
          kind: true,
          make: true,
          model: true,
          maxPriceArs: true,
          minCondition: true,
          province: true,
          status: true,
          expiresAt: true,
          buyer: {
            select: {
              name: true,
              identityVerification: { select: { status: true, legalName: true } },
            },
          },
        },
      },
    },
  });
  if (!n) return null;
  const r = n.request;
  const identidad = r.buyer.identityVerification;
  const aprobada = identidad?.status === "APPROVED";
  const legal = aprobada && identidad.legalName?.trim() ? identidad.legalName.trim() : null;
  const interesado = n.response === "INTERESTED";
  return {
    id: n.id,
    gearItemId: n.gearItemId,
    gearItem: n.gearItem,
    sentAt: n.sentAt,
    response: n.response,
    respondedAt: n.respondedAt,
    publicado: n.listingId != null,
    request: {
      kind: r.kind as GearItemKind,
      make: r.make,
      model: r.model,
      maxPriceArs: r.maxPriceArs,
      minCondition: r.minCondition as GearListingCondition | null,
      province: r.province,
      abierto: r.status === "ACTIVE" && r.expiresAt > new Date(),
    },
    buyerName: interesado ? (legal ?? sellerFirstName(r.buyer.name)) : null,
    buyerVerified: aprobada,
    buyerRating: await getUserRating(r.buyerId),
  };
}

/**
 * Si el aviso es de este dueño, apunta a este equipo y publicar todavía le manda el enlace al
 * comprador (para la leyenda de «Publicar»): respondió «Me interesa», el enlace no salió y el
 * pedido sigue abierto.
 */
export async function isNoticeForItem(
  ownerId: number,
  noticeId: number,
  gearItemId: number,
): Promise<boolean> {
  if (!Number.isInteger(noticeId) || noticeId <= 0) return false;
  const n = await prisma.purchaseRequestNotice.findFirst({
    where: {
      id: noticeId,
      ownerId,
      gearItemId,
      response: "INTERESTED",
      listingId: null,
      request: { status: "ACTIVE", expiresAt: { gt: new Date() } },
    },
    select: { id: true },
  });
  return n !== null;
}

/** `true` si la persona apagó los avisos de pedidos «Busco». */
export async function getPurchaseRequestOptOut(userId: number): Promise<boolean> {
  const s = await prisma.gearOwnerSettings.findUnique({
    where: { userId },
    select: { purchaseRequestOptOut: true },
  });
  return s?.purchaseRequestOptOut ?? false;
}

export async function setPurchaseRequestOptOut(userId: number, optOut: boolean): Promise<void> {
  await prisma.gearOwnerSettings.upsert({
    where: { userId },
    create: { userId, purchaseRequestOptOut: optOut },
    update: { purchaseRequestOptOut: optOut },
  });
}

/**
 * El dueño responde el aviso de un pedido, una sola vez. Un aviso de otro dueño no existe
 * (NO_ENCONTRADO). Si dice que le interesa y ese equipo ya está publicado, el comprador recibe
 * el enlace enseguida (`yaPublicado`, sólo si de verdad quedó atado a la publicación). Un pedido
 * que ya no está activo no se responde.
 */
export async function respondNotice(
  ownerId: number,
  noticeId: number,
  response: "INTERESTED" | "DECLINED",
): Promise<{ gearItemId: number; yaPublicado: boolean }> {
  if (response !== "INTERESTED" && response !== "DECLINED") {
    throw invalido("Elegí una respuesta.");
  }
  const valido = Number.isInteger(noticeId) && noticeId > 0;
  const notice = valido
    ? await prisma.purchaseRequestNotice.findFirst({
        where: { id: noticeId, ownerId },
        select: {
          gearItemId: true,
          response: true,
          request: { select: { status: true, expiresAt: true } },
          gearItem: { select: { ownerId: true, status: true } },
        },
      })
    : null;
  if (!notice) throw new EquipoError("NO_ENCONTRADO", "No encontramos ese aviso.");
  if (notice.response !== null) throw invalido(MENSAJE_AVISO_RESPONDIDO);
  // Un pedido cancelado, vencido o ya cumplido no se responde: nadie recibiría el enlace.
  if (notice.request.status !== "ACTIVE" || notice.request.expiresAt <= new Date()) {
    throw invalido(MENSAJE_PEDIDO_NO_ACTIVO);
  }
  // El equipo tiene que seguir siendo suyo y vendible: ni vendido, ni robado, ni perdido. A la
  // venta (FOR_SALE) vale: es el caso en que ya lo publicó y el comprador recibe el enlace.
  if (
    notice.gearItem.ownerId !== ownerId ||
    !EQUIPO_RESPONDIBLE.includes(notice.gearItem.status)
  ) {
    throw invalido(MENSAJE_EQUIPO_FUERA_DE_INVENTARIO);
  }

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
    if (publicada) {
      await notifyRequestBuyers(publicada.id);
      // Sólo si el aviso quedó atado a la publicación el comprador recibió el enlace (otro dueño
      // pudo cumplir el pedido mientras tanto).
      const despues = await prisma.purchaseRequestNotice.findUnique({
        where: { id: noticeId },
        select: { listingId: true },
      });
      return { gearItemId: notice.gearItemId, yaPublicado: despues?.listingId != null };
    }
  }
  return { gearItemId: notice.gearItemId, yaPublicado: false };
}
