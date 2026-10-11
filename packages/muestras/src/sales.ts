/**
 * Venta de obras (etapa 8, spec D1–D30). Reglas puras: modos de la venta, reparto en tres, montos
 * en centavos, receptores de Mercado Pago, referencia externa, ofertas (formatos), cuándo se puede
 * comprar, estados del pedido y circuito de las impresas. Sin dependencias: la app pone la base,
 * Mercado Pago y las fechas reales.
 *
 * Plata: el precio y el envío se cargan en pesos enteros; todo cálculo va en centavos enteros.
 */

/** Fee de la plataforma: 15 % del precio de la obra (no se cobra sobre el envío). */
export const PLATFORM_FEE_BPS = 1500;
export const SPLIT_TOTAL_BPS = 10_000;
/** Lo que se reparten organización y fotógrafo/a: el 85 % restante. */
export const AUTHORS_SHARE_BPS = SPLIT_TOTAL_BPS - PLATFORM_FEE_BPS;
/**
 * La comisión de procesamiento de Mercado Pago sale de la parte de la plataforma (decisión de Daniel
 * del 2026-10-11): organización y fotógrafo/a reciben exactamente su porcentaje acordado.
 */
export const MP_FEE_PAID_BY = "PLATFORM" as const;
export const PRICE_MIN_ARS = 1_000;
/** Tope propio de la venta: los montos repartidos se guardan en centavos en columnas INT (~21 millones de pesos). */
export const SALE_PRICE_MAX_ARS = 20_000_000;
export const SHIPPING_MAX_ARS = 1_000_000;
export const PAPER_MAX = 120;
export const SIZE_MIN_CM = 5;
export const SIZE_MAX_CM = 300;
/** Ediciones limitadas: de 2 a 999 copias. */
export const LIMITED_EDITION_MIN = 2;
export const LIMITED_EDITION_MAX = 999;
/** Pruebas de autor por edición (decisión de Daniel del 2026-10-11). */
export const MAX_PROOFS = 5;
/** La venta cierra 30 días después del cierre de la muestra (decisión de Daniel del 2026-10-11). */
export const SALE_CLOSE_DAYS_AFTER_END = 30;
export const SALE_STATEMENT_DESCRIPTOR = "MUESTRAS FOTO";
export const REVIEW_NOTE_MAX = 500;

export const SALE_UNAVAILABLE_TEXT = "La venta de esta obra todavía no está disponible.";
export const SALE_ASK_TEXT = "Si te interesa, consultá a la organización en la sala.";

const pct = (bps: number) => `${(bps / 100).toLocaleString("es-AR")} %`;

/**
 * El reparto que acepta cada autor. Cambiar la redacción obliga a cambiar la versión: la aceptación
 * guarda la versión del texto (`textVersion`).
 */
export const SALE_SPLIT_TEXT_VERSION = "2026-10-11";
export function SALE_SPLIT_TEXT(p: { activityTitle: string; platformFeeBps: number; organizerBps: number; photographerBps: number }): string {
  return `De cada venta de tus obras en ${p.activityTitle}: plataforma ${pct(p.platformFeeBps)}, organización ${pct(p.organizerBps)}, vos ${pct(p.photographerBps)}.`;
}

/** Términos que acepta quien compra. A revisar por un abogado antes de vender en vivo (D28). */
export const SALE_TERMS_TEXT_VERSION = "2026-10-11";
export const SALE_TERMS_TEXT = [
  "Vende la obra la organización de la muestra junto con su autor/a; Muestras Fotográficas es la plataforma que intermedia el cobro y emite el certificado.",
  "Cada copia lleva un número y un certificado registrado que se puede verificar con su código QR. En una edición limitada nunca se emiten más copias que las indicadas.",
  "La copia digital es un archivo firmado para uso personal: su valor está en el certificado registrado, no en el archivo. No incluye derechos para reproducirla ni publicarla con fines comerciales.",
  "La copia impresa es una impresión Fine Art / premium en el papel y la medida indicados. Se retira en la sede o se envía, según lo que elijas y lo que ofrezca la organización.",
  "Tenés 10 días corridos para arrepentirte de la compra desde que la recibís (Ley 24.240). Si hay una devolución, el certificado queda anulado y el número no se vuelve a usar.",
].join("\n\n");

export const SALE_EDITION_DECLARATION =
  "Declaro que esta edición no se vende por otros medios y que no voy a emitir más copias de las indicadas.";

export type SalesMode = "OFF" | "TEST" | "LIVE";
export const SETUP_STATUSES = ["DRAFT", "OPEN", "PAUSED", "CLOSED"] as const;
export type SetupStatus = (typeof SETUP_STATUSES)[number];
export const OFFER_FORMATS = ["DIGITAL", "PRINT"] as const;
export type OfferFormat = (typeof OFFER_FORMATS)[number];
export const EDITION_KINDS = ["UNIQUE", "LIMITED"] as const;
export type EditionKind = (typeof EDITION_KINDS)[number];
export const OFFER_STATUSES = ["DRAFT", "PROPOSED", "CHANGES_REQUESTED", "APPROVED", "PAUSED", "WITHDRAWN"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "REJECTED", "EXPIRED", "REFUNDED", "CHARGED_BACK", "PAID_NO_COPY"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const FULFILLMENTS = ["NONE", "PENDING", "IN_PRODUCTION", "READY", "SHIPPED", "DELIVERED"] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];
export const DELIVERIES = ["DIGITAL", "PICKUP", "SHIPPING"] as const;
export type Delivery = (typeof DELIVERIES)[number];
export const CONSENT_STATUSES = ["NONE", "PENDING", "ACTIVE", "REJECTED", "CANCELED", "EXPIRED"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

const enLista = <T extends string>(lista: readonly T[]) => (v: unknown): v is T => typeof v === "string" && (lista as readonly string[]).includes(v);
export const isOfferFormat = enLista(OFFER_FORMATS);
export const isEditionKind = enLista(EDITION_KINDS);
export const isOfferStatus = enLista(OFFER_STATUSES);
export const isOrderStatus = enLista(ORDER_STATUSES);
export const isFulfillment = enLista(FULFILLMENTS);
export const isDelivery = enLista(DELIVERIES);

export const OFFER_FORMAT_LABELS: Record<OfferFormat, string> = { DIGITAL: "Copia digital firmada", PRINT: "Copia impresa Fine Art / premium" };
export const EDITION_KIND_LABELS: Record<EditionKind, string> = { UNIQUE: "Copia única", LIMITED: "Edición limitada" };
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Borrador",
  PROPOSED: "Esperando aprobación",
  CHANGES_REQUESTED: "Con cambios pedidos",
  APPROVED: "Aprobado",
  PAUSED: "Pausado",
  WITHDRAWN: "Retirado",
};
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Esperando el pago",
  PAID: "Pagado",
  REJECTED: "Pago rechazado",
  EXPIRED: "Vencido sin pagar",
  REFUNDED: "Devuelto",
  CHARGED_BACK: "Contracargo",
  PAID_NO_COPY: "Cobrado sin copia disponible",
};
export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  NONE: "Digital",
  PENDING: "Por imprimir",
  IN_PRODUCTION: "En producción",
  READY: "Lista para retirar",
  SHIPPED: "Enviada",
  DELIVERED: "Entregada",
};
export const DELIVERY_LABELS: Record<Delivery, string> = { DIGITAL: "Descarga digital", PICKUP: "Retiro en la sede", SHIPPING: "Envío" };

// ---------------------------------------------------------------------------------------------
// Modos (D1–D3)

export type SalesModeInput = {
  ventasEnVivo: boolean;
  ordersProduccion: boolean;
  mpEnv: "sandbox" | "production" | null;
  /** `null` si no hay token. */
  tokenEsDePrueba: boolean | null;
  /** Nombres de las variables obligatorias que faltan (nunca sus valores). */
  faltan: readonly string[];
};

/** El modo de la venta. Se calcula en cada pedido y nunca se guarda. */
export function salesMode(input: SalesModeInput): { mode: SalesMode; motivo: string | null } {
  const off = (motivo: string) => ({ mode: "OFF" as const, motivo });
  if (input.faltan.length > 0) return off(`Falta configurar: ${input.faltan.join(", ")}.`);
  if (input.mpEnv == null) return off("Falta configurar: MUESTRAS_MP_ENV.");
  if (input.tokenEsDePrueba == null) return off("Falta configurar: MUESTRAS_MP_ACCESS_TOKEN.");
  const mismatch = "El token de Mercado Pago no corresponde al ambiente.";
  if (input.mpEnv === "sandbox") {
    // Con sandbox nunca se cobra dinero real: la llave de Muestras no lo vuelve público.
    return input.tokenEsDePrueba ? { mode: "TEST", motivo: null } : off(mismatch);
  }
  if (input.tokenEsDePrueba) return off(mismatch);
  if (!input.ordersProduccion) return off("Mercado Pago todavía no habilitó la producción del reparto.");
  if (!input.ventasEnVivo) return off("La venta en vivo de Muestras está apagada.");
  return { mode: "LIVE", motivo: null };
}

/** En vivo compran todos; en prueba, sólo el super admin y los probadores; apagado, nadie. */
export function canBuy(mode: SalesMode, who: { esSuperAdmin: boolean; esProbador: boolean }): boolean {
  if (mode === "LIVE") return true;
  if (mode === "TEST") return who.esSuperAdmin || who.esProbador;
  return false;
}

// ---------------------------------------------------------------------------------------------
// Ventana de venta (decisión del 2026-10-11)

const DIA_MS = 24 * 60 * 60 * 1000;

/** Hasta cuándo se vende: 30 días después del cierre de la muestra. */
export function saleClosesAt(endsAt: Date): Date {
  return new Date(endsAt.getTime() + SALE_CLOSE_DAYS_AFTER_END * DIA_MS);
}

export function saleWindowOpen(p: { endsAt: Date; now: Date }): boolean {
  return p.now.getTime() <= saleClosesAt(p.endsAt).getTime();
}

// ---------------------------------------------------------------------------------------------
// Reparto y montos (D6, D7)

export type SplitBps = { organizerBps: number; photographerBps: number };

/** Problemas del reparto que fija la organización: puntos enteros que suman 85. */
export function splitProblems(p: SplitBps): string[] {
  const out: string[] = [];
  const valido = (n: number) => Number.isInteger(n) && n >= 0 && n <= AUTHORS_SHARE_BPS;
  if (!valido(p.organizerBps) || !valido(p.photographerBps)) {
    out.push(`Cada porcentaje va de 0 a ${AUTHORS_SHARE_BPS / 100}.`);
    return out;
  }
  if (p.organizerBps % 100 !== 0 || p.photographerBps % 100 !== 0) out.push("Los porcentajes van en números enteros, sin decimales.");
  if (p.organizerBps + p.photographerBps !== AUTHORS_SHARE_BPS) {
    out.push(`La organización y el fotógrafo se reparten el ${AUTHORS_SHARE_BPS / 100} %: tienen que sumar ${AUTHORS_SHARE_BPS / 100}.`);
  }
  return out;
}

export type SaleAmounts = {
  priceCents: number;
  shippingCents: number;
  totalCents: number;
  platformCents: number;
  organizerCents: number;
  photographerCents: number;
};

function pesosEnteros(n: number, min: number, max: number, nombre: string): number {
  if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`${nombre} fuera de rango: ${n}`);
  return n * 100;
}

/**
 * Montos exactos en centavos (D7): plataforma y organización redondeadas, el fotógrafo se lleva el
 * resto (el redondeo cae en él, nunca más de un centavo). El envío no se reparte: va entero a la
 * organización en `receiverPlan`. Invariante: plataforma + organización + fotógrafo = precio.
 */
export function saleAmounts(p: { priceArs: number; shippingArs: number; platformFeeBps: number; organizerBps: number }): SaleAmounts {
  const priceCents = pesosEnteros(p.priceArs, 1, SALE_PRICE_MAX_ARS, "Precio");
  const shippingCents = pesosEnteros(p.shippingArs, 0, SHIPPING_MAX_ARS, "Envío");
  const bpsOk = (n: number) => Number.isInteger(n) && n >= 0 && n <= SPLIT_TOTAL_BPS;
  if (!bpsOk(p.platformFeeBps) || !bpsOk(p.organizerBps) || p.platformFeeBps + p.organizerBps > SPLIT_TOTAL_BPS) {
    throw new RangeError("Reparto fuera de rango");
  }
  const platformCents = Math.round((priceCents * p.platformFeeBps) / SPLIT_TOTAL_BPS);
  const organizerCents = Math.round((priceCents * p.organizerBps) / SPLIT_TOTAL_BPS);
  const photographerCents = priceCents - platformCents - organizerCents;
  return { priceCents, shippingCents, totalCents: priceCents + shippingCents, platformCents, organizerCents, photographerCents };
}

/** El ejemplo del panel, en pesos: "De una venta de $100.000: plataforma $15.000, …". */
export function splitExample(priceArs: number, p: { platformFeeBps: number; organizerBps: number }): { plataforma: number; organizacion: number; fotografo: number } {
  const a = saleAmounts({ priceArs, shippingArs: 0, platformFeeBps: p.platformFeeBps, organizerBps: p.organizerBps });
  return { plataforma: a.platformCents / 100, organizacion: a.organizerCents / 100, fotografo: a.photographerCents / 100 };
}

export type ReceiverPartner = { recipientId: "organizer" | "photographer" | "both"; receiverId: string; cents: number };

/**
 * A quién le paga Mercado Pago: el `owner` (la plataforma) se queda con el fee; organización (más el
 * envío) y fotógrafo son `partners`. Si son la misma cuenta, un solo partner; los ceros no van.
 * La suma siempre da el total.
 */
export function receiverPlan(p: {
  amounts: SaleAmounts;
  organizer: { userId: number; receiverId: string };
  photographer: { userId: number; receiverId: string };
}): { ownerCents: number; partners: ReceiverPartner[] } {
  const org = p.amounts.organizerCents + p.amounts.shippingCents;
  const foto = p.amounts.photographerCents;
  const partners: ReceiverPartner[] =
    p.organizer.receiverId === p.photographer.receiverId
      ? [{ recipientId: "both", receiverId: p.organizer.receiverId, cents: org + foto }]
      : [
          { recipientId: "organizer", receiverId: p.organizer.receiverId, cents: org },
          { recipientId: "photographer", receiverId: p.photographer.receiverId, cents: foto },
        ];
  return { ownerCents: p.amounts.platformCents, partners: partners.filter((x) => x.cents > 0) };
}

// ---------------------------------------------------------------------------------------------
// Referencia externa (sin datos personales)

const SALE_REF_PREFIX = "muestras-venta-";
const PUBLIC_ID_RE = /^[a-z0-9]{16}$/;

export function isSalePublicId(s: unknown): s is string {
  return typeof s === "string" && PUBLIC_ID_RE.test(s);
}

export function saleExternalReference(publicId: string): string {
  if (!isSalePublicId(publicId)) throw new Error("Id de pedido inválido");
  return SALE_REF_PREFIX + publicId;
}

export function parseSaleExternalReference(ref: string): string | null {
  if (typeof ref !== "string" || !ref.startsWith(SALE_REF_PREFIX)) return null;
  const id = ref.slice(SALE_REF_PREFIX.length);
  return isSalePublicId(id) ? id : null;
}

// ---------------------------------------------------------------------------------------------
// Ofertas (D9, D10, D12)

export type OfferData = {
  format: string;
  editionKind: string;
  editionSize: number;
  proofCount: number;
  priceArs: number;
  paper: string | null;
  widthCm: number | null;
  heightCm: number | null;
};

const medidaOk = (n: number | null) => typeof n === "number" && Number.isFinite(n) && n >= SIZE_MIN_CM && n <= SIZE_MAX_CM;
const vacio = (s: string | null | undefined) => s == null || s.trim() === "";

/**
 * Problemas de un formato. Con `hasFirstSale` y la versión anterior (`previous`), además frena los
 * cambios de formato, edición, papel y medida (quedan fijos después de la primera venta).
 */
export function offerProblems(offer: OfferData, ctx: { hasFirstSale: boolean; previous?: OfferData }): string[] {
  const out: string[] = [];
  if (!isOfferFormat(offer.format)) out.push("Elegí si es una copia digital o impresa.");
  if (!isEditionKind(offer.editionKind)) out.push("Elegí copia única o edición limitada.");
  const n = offer.editionSize;
  if (offer.editionKind === "UNIQUE" && n !== 1) out.push("Una copia única es una sola.");
  if (offer.editionKind === "LIMITED" && (!Number.isInteger(n) || n < LIMITED_EDITION_MIN || n > LIMITED_EDITION_MAX)) {
    out.push(`Una edición limitada tiene entre ${LIMITED_EDITION_MIN} y ${LIMITED_EDITION_MAX} copias.`);
  }
  if (!Number.isInteger(offer.proofCount) || offer.proofCount < 0 || offer.proofCount > MAX_PROOFS) {
    out.push(`Las pruebas de autor van de 0 a ${MAX_PROOFS}.`);
  } else if (Number.isInteger(n) && offer.proofCount > n) {
    out.push("No puede haber más pruebas de autor que copias.");
  }
  if (offer.format === "PRINT") {
    const papel = offer.paper?.trim() ?? "";
    if (!papel) out.push("Poné el papel de la impresión.");
    else if (papel.length > PAPER_MAX) out.push(`El papel puede tener hasta ${PAPER_MAX} caracteres.`);
    if (!medidaOk(offer.widthCm) || !medidaOk(offer.heightCm)) out.push(`La medida de la imagen va de ${SIZE_MIN_CM} a ${SIZE_MAX_CM} cm por lado.`);
  }
  if (offer.format === "DIGITAL" && (!vacio(offer.paper) || offer.widthCm != null || offer.heightCm != null)) {
    out.push("Una copia digital no lleva papel ni medida.");
  }
  if (!Number.isInteger(offer.priceArs) || offer.priceArs < PRICE_MIN_ARS || offer.priceArs > SALE_PRICE_MAX_ARS) {
    out.push(`El precio va de $${PRICE_MIN_ARS.toLocaleString("es-AR")} a $${SALE_PRICE_MAX_ARS.toLocaleString("es-AR")}, en pesos enteros.`);
  }
  const prev = ctx.previous;
  if (ctx.hasFirstSale && prev) {
    const fijos =
      prev.format !== offer.format ||
      prev.editionKind !== offer.editionKind ||
      (prev.paper ?? "").trim() !== (offer.paper ?? "").trim() ||
      prev.widthCm !== offer.widthCm ||
      prev.heightCm !== offer.heightCm;
    if (fijos) out.push("Después de la primera venta, el formato, la edición, el papel y la medida no se pueden cambiar.");
  }
  return out;
}

/** Mientras se revisa un cambio de precio, la oferta sigue vendiendo al último precio aprobado. */
export function offerSellingPrice(o: { status: string; priceArs: number; approvedPriceArs: number | null }): number | null {
  if (o.status === "APPROVED") return o.approvedPriceArs ?? o.priceArs;
  if ((o.status === "PROPOSED" || o.status === "CHANGES_REQUESTED") && o.approvedPriceArs != null) return o.approvedPriceArs;
  return null;
}

export type OfferAction = "propose" | "withdraw" | "reopen" | "approve" | "requestChanges" | "pause" | "resume" | "changePrice" | "editEdition";
export type OfferActor = "AUTHOR" | "ORGANIZER";

export type OfferTransitionResult =
  | { ok: true; status: OfferStatus; priceArs?: number; approvedPriceArs?: number | null; editionSize?: number; reviewNote?: string | null }
  | { ok: false; error: string };

/**
 * Circuito de una oferta (D10). El autor propone, cambia el precio, retira y reabre; la organización
 * aprueba o pide cambios; cualquiera de los dos pausa y reanuda. Cambiar el precio de una aprobada
 * la manda a revisión y conserva el precio aprobado. Después de la primera venta, N no sube ni baja
 * de lo emitido + reservado.
 */
export function offerTransition(
  action: OfferAction,
  offer: { status: string; priceArs?: number; approvedPriceArs?: number | null; editionSize?: number; firstSoldAt?: Date | null },
  ctx: { actor: OfferActor; newPriceArs?: number; editionSize?: number; issuedOrReserved?: number; note?: string },
): OfferTransitionResult {
  const no = (error: string) => ({ ok: false as const, error });
  const st = offer.status;
  const autor = ctx.actor === "AUTHOR";
  const org = ctx.actor === "ORGANIZER";
  const vendio = offer.firstSoldAt != null;
  switch (action) {
    case "propose":
      if (!autor) return no("Sólo el autor propone sus formatos.");
      if (st !== "DRAFT" && st !== "CHANGES_REQUESTED") return no("Este formato ya fue enviado.");
      return { ok: true, status: "PROPOSED" };
    case "withdraw":
      if (!autor) return no("Sólo el autor retira sus formatos.");
      if (st === "WITHDRAWN") return no("Este formato ya está retirado.");
      return { ok: true, status: "WITHDRAWN" };
    case "reopen":
      if (!autor) return no("Sólo el autor reabre sus formatos.");
      if (st !== "WITHDRAWN") return no("Este formato no está retirado.");
      if (vendio) return no("Este formato ya vendió copias: la edición quedó cerrada.");
      return { ok: true, status: "DRAFT", approvedPriceArs: null };
    case "approve":
      if (!org) return no("Sólo la organización aprueba los formatos.");
      if (st !== "PROPOSED") return no("Este formato no está esperando aprobación.");
      if (offer.priceArs == null) return no("Falta el precio.");
      return { ok: true, status: "APPROVED", approvedPriceArs: offer.priceArs, reviewNote: null };
    case "requestChanges": {
      if (!org) return no("Sólo la organización pide cambios.");
      if (st !== "PROPOSED") return no("Este formato no está esperando aprobación.");
      const nota = ctx.note?.trim() ?? "";
      if (!nota) return no("Escribí qué hay que cambiar.");
      if (nota.length > REVIEW_NOTE_MAX) return no(`La nota puede tener hasta ${REVIEW_NOTE_MAX} caracteres.`);
      return { ok: true, status: "CHANGES_REQUESTED", reviewNote: nota };
    }
    case "pause":
      if (st !== "APPROVED") return no("Sólo se pausa un formato aprobado.");
      return { ok: true, status: "PAUSED" };
    case "resume":
      if (st !== "PAUSED") return no("Este formato no está pausado.");
      return { ok: true, status: offer.approvedPriceArs != null ? "APPROVED" : "PROPOSED" };
    case "changePrice": {
      if (!autor) return no("Sólo el autor cambia el precio.");
      const nuevo = ctx.newPriceArs;
      if (nuevo == null || !Number.isInteger(nuevo) || nuevo < PRICE_MIN_ARS || nuevo > SALE_PRICE_MAX_ARS) {
        return no(`El precio va de $${PRICE_MIN_ARS.toLocaleString("es-AR")} a $${SALE_PRICE_MAX_ARS.toLocaleString("es-AR")}, en pesos enteros.`);
      }
      if (st === "DRAFT" || st === "CHANGES_REQUESTED") return { ok: true, status: st, priceArs: nuevo };
      if (st === "APPROVED" || st === "PROPOSED") {
        const aprobado = offer.approvedPriceArs ?? null;
        if (aprobado != null && nuevo === aprobado) return { ok: true, status: "APPROVED", priceArs: nuevo, approvedPriceArs: aprobado };
        return { ok: true, status: "PROPOSED", priceArs: nuevo, approvedPriceArs: aprobado };
      }
      return no("Reanudá o reabrí el formato antes de cambiar el precio.");
    }
    case "editEdition": {
      if (!autor) return no("Sólo el autor cambia la edición.");
      if (st === "WITHDRAWN") return no("Este formato está retirado.");
      const next = ctx.editionSize;
      const actual = offer.editionSize;
      if (next == null || actual == null || !Number.isInteger(next) || next < 1 || next > LIMITED_EDITION_MAX) return no("Cantidad de copias inválida.");
      const ocupadas = ctx.issuedOrReserved ?? 0;
      if (next < ocupadas) return no(`Ya hay ${ocupadas} copias emitidas o reservadas: la edición no puede ser menor.`);
      if (vendio) {
        if (next > actual) return no("Después de la primera venta, la edición no puede crecer.");
        return { ok: true, status: st as OfferStatus, editionSize: next };
      }
      if (st === "APPROVED" || st === "PAUSED") return { ok: true, status: "PROPOSED", editionSize: next };
      return { ok: true, status: st as OfferStatus, editionSize: next };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// ¿Se puede comprar? (D11)

export type OfferPurchasableInput = {
  setupStatus: string;
  /** Muestra publicada (APPROVED) y no cancelada. */
  activityPublished: boolean;
  offerStatus: string;
  /** Precio aprobado vigente (una oferta con un cambio de precio en revisión sigue vendiendo a éste). */
  approvedPriceArs?: number | null;
  authorAcceptedVersion: number | null;
  splitVersion: number;
  /** D8: el expositor marcó "La quiero vender" o la obra de concurso tiene `saleConsent = ACCEPTED`. */
  workSellable: boolean;
  organizerConsent: string | null;
  authorConsent: string | null;
  needsFile: boolean;
  fileReady: boolean;
  signature: boolean;
  remaining: number;
  authorName: string;
};

export function offerPurchasable(i: OfferPurchasableInput): { ok: true } | { ok: false; reasons: string[] } {
  const r: string[] = [];
  if (i.setupStatus !== "OPEN") r.push("La venta de la muestra no está abierta");
  if (!i.activityPublished) r.push("La muestra no está publicada");
  const aprobada =
    i.offerStatus === "APPROVED" ||
    ((i.offerStatus === "PROPOSED" || i.offerStatus === "CHANGES_REQUESTED") && i.approvedPriceArs != null);
  if (!aprobada) r.push("La organización todavía no aprobó este formato");
  if (i.authorAcceptedVersion !== i.splitVersion) r.push(`${i.authorName} todavía no aceptó el reparto`);
  if (!i.workSellable) r.push("La obra no está marcada para la venta");
  if (i.authorConsent !== "ACTIVE") r.push(`${i.authorName} todavía no conectó su Mercado Pago`);
  if (i.organizerConsent !== "ACTIVE") r.push("La organización todavía no conectó su Mercado Pago");
  if (i.needsFile && !i.fileReady) r.push("Falta el archivo original");
  if (!i.signature) r.push("Falta la firma del autor");
  if (i.remaining <= 0) r.push("No quedan copias");
  return r.length === 0 ? { ok: true } : { ok: false, reasons: r };
}

// ---------------------------------------------------------------------------------------------
// Pedido (D30) y producción (D26)

const ORDER_NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "REJECTED", "EXPIRED"],
  // Un pago que llega tarde nunca se pierde: la conciliación busca otro número o pasa a PAID_NO_COPY.
  EXPIRED: ["PAID"],
  PAID: ["REFUNDED", "CHARGED_BACK"],
  PAID_NO_COPY: ["REFUNDED", "CHARGED_BACK"],
  REJECTED: [],
  REFUNDED: [],
  CHARGED_BACK: [],
};

const PAGO_OK = new Set(["accredited", "processed", "approved"]);
const PAGO_RECHAZADO = new Set(["rejected", "cancelled", "canceled", "failed"]);

/** Lo que dice Mercado Pago, traducido a un estado de pedido (o `null` si todavía no hay nada que hacer). */
function observedToStatus(o: { orderStatus: string; paymentStatus: string | null }): OrderStatus | null {
  const orden = o.orderStatus.toUpperCase();
  const pago = (o.paymentStatus ?? "").toLowerCase();
  if (orden === "PROCESSED_ACCREDITED") return "PAID";
  if (orden === "PROCESSED") return PAGO_OK.has(pago) ? "PAID" : null;
  if (orden === "REFUNDED") return "REFUNDED";
  if (orden === "CHARGED_BACK") return "CHARGED_BACK";
  if (orden === "FAILED" || orden === "CANCELED" || orden === "CANCELLED") return "REJECTED";
  if (orden === "OPEN" && PAGO_RECHAZADO.has(pago)) return "REJECTED";
  return null;
}

/**
 * Transición del pedido según Mercado Pago. Nunca hacia atrás; repetir el mismo estado no hace nada.
 * `EXPIRED` lo pone el barrido, no Mercado Pago.
 */
export function saleOrderTransition(current: OrderStatus, observed: { orderStatus: string; paymentStatus: string | null }): { next: OrderStatus | null } {
  const destino = observedToStatus(observed);
  if (destino == null || destino === current) return { next: null };
  return { next: ORDER_NEXT[current].includes(destino) ? destino : null };
}

const FULFILL_NEXT: Record<"PICKUP" | "SHIPPING", Partial<Record<Fulfillment, Fulfillment>>> = {
  PICKUP: { PENDING: "IN_PRODUCTION", IN_PRODUCTION: "READY", READY: "DELIVERED" },
  SHIPPING: { PENDING: "IN_PRODUCTION", IN_PRODUCTION: "SHIPPED", SHIPPED: "DELIVERED" },
};

/** Circuito de la impresa: retiro (→ lista para retirar) o envío (→ enviada). Lo digital no tiene circuito. */
export function fulfillmentTransition(current: string, next: string, delivery: string): boolean {
  if (delivery !== "PICKUP" && delivery !== "SHIPPING") return false;
  return FULFILL_NEXT[delivery][current as Fulfillment] === next;
}

export function deliveryOptions(setup: { shippingEnabled: boolean }, format: string): Delivery[] {
  if (format === "DIGITAL") return ["DIGITAL"];
  return setup.shippingEnabled ? ["PICKUP", "SHIPPING"] : ["PICKUP"];
}

// ---------------------------------------------------------------------------------------------
// Página de compra

export type SalePageState = "NOT_FOR_SALE" | "UNAVAILABLE" | "AVAILABLE" | "SOLD_OUT";

/**
 * Qué muestra "Adquirir obra". `anyOfferForSale`: la obra tiene algo a la venta (todo en regla salvo,
 * quizás, que se agotó); `purchasableOffers`: cuántos formatos se pueden comprar ahora.
 * Con el modo apagado, o si quien mira no puede comprar, dice "todavía no está disponible" y no
 * muestra precios.
 */
export function salePageState(p: { mode: SalesMode; viewerCanBuy: boolean; anyOfferForSale: boolean; purchasableOffers: number }): SalePageState {
  if (!p.anyOfferForSale) return "NOT_FOR_SALE";
  if (p.mode === "OFF" || !p.viewerCanBuy) return "UNAVAILABLE";
  return p.purchasableOffers > 0 ? "AVAILABLE" : "SOLD_OUT";
}
