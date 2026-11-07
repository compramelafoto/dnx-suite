/**
 * Conexión FOTOFFICE ↔ CLF (etapa 2): la venta tal como la ve FOTOFFICE. Puro, sin Prisma.
 *
 * Lista blanca: `ventaParaFotoffice` arma el objeto campo por campo. Nunca cruzan datos del comprador
 * (nombre, correo, teléfono, usuario), de alumnos, selfies, fotos, direcciones ni tokens de Mercado Pago.
 *
 * Montos en pesos: `Order.totalCents`, `platformCommissionCents` y `referralFeeDiscountCents` ya son pesos
 * enteros (el sufijo «Cents» es histórico).
 */

export type VentaFotoffice = {
  orderId: number;
  mpPaymentId: string | null;
  estado: "PAID" | "REFUNDED" | "FAILED";
  motivo: "reintegro" | "contracargo" | "rechazo" | null;
  pagadoEl: string;
  actualizadoEl: string;
  album: { id: number; titulo: string };
  detalle: string;
  pagoFamilia: number;
  comisionPlataforma: number;
  descuentoReferidos: number;
  comisionOrganizador: number;
  retenidoEsperadoMp: number;
  netoFotografo: number;
  cobrador: "PHOTOGRAPHER" | "ORGANIZER";
  cobradorMpUserId: string | null;
};

export const CAMPOS_VENTA_FOTOFFICE = [
  "orderId",
  "mpPaymentId",
  "estado",
  "motivo",
  "pagadoEl",
  "actualizadoEl",
  "album",
  "detalle",
  "pagoFamilia",
  "comisionPlataforma",
  "descuentoReferidos",
  "comisionOrganizador",
  "retenidoEsperadoMp",
  "netoFotografo",
  "cobrador",
  "cobradorMpUserId",
] as const satisfies readonly (keyof VentaFotoffice)[];

export type ItemDeVenta = { productType: "DIGITAL" | "PRINT" | "FRAME" | string; size: string | null; quantity: number };

export type EntradaVenta = {
  order: {
    id: number;
    mpPaymentId: string | null;
    status: "PAID" | "REFUNDED" | "FAILED";
    updatedAt: Date;
    totalCents: number;
    platformCommissionCents: number | null;
    referralFeeDiscountCents: number | null;
  };
  album: { id: number; title: string };
  /** Logs `OrderAuditLog` del pedido (`ALBUM_ORDER`), en cualquier orden. Debe haber al menos un PAYMENT_APPROVED. */
  logs: { eventType: string; createdAt: Date }[];
  /** `packName` del `preventaPackSnapshotJson`, si el pedido es de un pack. */
  packName: string | null;
  items: ItemDeVenta[];
  videos: number;
  /** `EventOrganizerCommission` del pedido (montos Decimal ya pasados a number), si hay evento. */
  organizador: {
    photographerNetAmount: number | null;
    organizerCommissionAmount: number;
    payoutMode: string;
    organizadorMpUserId: string | null;
  } | null;
  /** `User.mpUserId` del dueño del álbum. */
  duenoMpUserId: string | null;
};

const pesos = (n: number | null | undefined): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
};

function ultimo(logs: EntradaVenta["logs"], tipos: readonly string[]) {
  let res: EntradaVenta["logs"][number] | null = null;
  for (const l of logs) {
    if (!tipos.includes(l.eventType)) continue;
    if (!res || l.createdAt.getTime() >= res.createdAt.getTime()) res = l;
  }
  return res;
}

function motivoDe(estado: VentaFotoffice["estado"], logs: EntradaVenta["logs"]): VentaFotoffice["motivo"] {
  if (estado === "PAID") return null;
  const reverso = ultimo(logs, ["PAYMENT_REFUNDED", "PAYMENT_CHARGED_BACK"]);
  if (reverso?.eventType === "PAYMENT_CHARGED_BACK") return "contracargo";
  if (reverso?.eventType === "PAYMENT_REFUNDED") return "reintegro";
  return estado === "REFUNDED" ? "reintegro" : "rechazo";
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const medida = (size: string | null) => (size ? size.trim().replace(/\s*[xX]\s*/g, "×") : "");

/** «Pack: <nombre>» o un resumen por tipo: «3 digitales · 2 impresas 15×21». Sin datos personales. */
export function detalleDeVenta(e: Pick<EntradaVenta, "packName" | "items" | "videos">): string {
  const pack = e.packName?.trim();
  if (pack) return `Pack: ${pack}`.slice(0, 300);

  let digitales = 0;
  const impresas = new Map<string, number>();
  const cuadros = new Map<string, number>();
  for (const it of e.items) {
    const q = Math.max(0, Math.round(Number(it.quantity) || 0));
    if (q === 0) continue;
    if (it.productType === "DIGITAL") digitales += q;
    else {
      const m = it.productType === "FRAME" ? cuadros : impresas;
      const k = medida(it.size);
      m.set(k, (m.get(k) ?? 0) + q);
    }
  }
  const partes: string[] = [];
  if (digitales > 0) partes.push(plural(digitales, "digital", "digitales"));
  for (const [k, n] of impresas) partes.push(`${plural(n, "impresa", "impresas")}${k ? ` ${k}` : ""}`);
  for (const [k, n] of cuadros) partes.push(`${plural(n, "cuadro", "cuadros")}${k ? ` ${k}` : ""}`);
  if (e.videos > 0) partes.push(plural(e.videos, "video", "videos"));
  return partes.length > 0 ? partes.join(" · ").slice(0, 300) : "Sin detalle";
}

export function ventaParaFotoffice(e: EntradaVenta): VentaFotoffice {
  const o = e.order;
  const estado: VentaFotoffice["estado"] = o.status === "REFUNDED" ? "REFUNDED" : o.status === "FAILED" ? "FAILED" : "PAID";
  const aprobado = ultimo(e.logs, ["PAYMENT_APPROVED"]);

  const pagoFamilia = pesos(o.totalCents);
  const comisionPlataforma = pesos(o.platformCommissionCents);
  const descuentoReferidos = pesos(o.referralFeeDiscountCents);
  const org = e.organizador;
  const cobrador: VentaFotoffice["cobrador"] = org?.payoutMode === "ORGANIZER_AS_COLLECTOR" ? "ORGANIZER" : "PHOTOGRAPHER";
  const comisionOrganizador = pesos(org?.organizerCommissionAmount);
  // Lo que CLF mandó como marketplace_fee: plataforma − referidos (+ organizador si cobra el fotógrafo).
  const retenidoEsperadoMp = pesos(
    Math.max(0, comisionPlataforma - descuentoReferidos) + (cobrador === "ORGANIZER" ? 0 : comisionOrganizador),
  );
  const netoFotografo =
    org && org.photographerNetAmount != null ? pesos(org.photographerNetAmount) : pesos(pagoFamilia - retenidoEsperadoMp);

  return {
    orderId: o.id,
    mpPaymentId: o.mpPaymentId ? String(o.mpPaymentId) : null,
    estado,
    motivo: motivoDe(estado, e.logs),
    pagadoEl: (aprobado?.createdAt ?? o.updatedAt).toISOString(),
    actualizadoEl: o.updatedAt.toISOString(),
    album: { id: e.album.id, titulo: String(e.album.title ?? "").slice(0, 300) },
    detalle: detalleDeVenta(e),
    pagoFamilia,
    comisionPlataforma,
    descuentoReferidos,
    comisionOrganizador,
    retenidoEsperadoMp,
    netoFotografo,
    cobrador,
    cobradorMpUserId: (cobrador === "ORGANIZER" ? org?.organizadorMpUserId : e.duenoMpUserId) ?? null,
  };
}

/* ───────────── Cursor y página ───────────── */

export type Cursor = { updatedAt: Date; id: number };

/** `base64url("<updatedAt ISO>|<id>")`. */
export function codificarCursor(c: Cursor): string {
  return Buffer.from(`${c.updatedAt.toISOString()}|${c.id}`, "utf8").toString("base64url");
}

export function decodificarCursor(s: string | null | undefined): Cursor | null {
  if (typeof s !== "string" || !s || s.length > 200 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const texto = Buffer.from(s, "base64url").toString("utf8");
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)\|([1-9]\d{0,9})$/.exec(texto);
  if (!m) return null;
  const updatedAt = new Date(m[1]!);
  const id = Number(m[2]);
  if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== normalizarIso(m[1]!) || !Number.isSafeInteger(id)) return null;
  return { updatedAt, id };
}

function normalizarIso(iso: string): string {
  // «...:00Z» o «...:00.5Z» → «...:00.000Z» / «...:00.500Z», para rechazar fechas imposibles (mes 13, día 45).
  const [base, resto] = iso.slice(0, -1).split(".");
  return `${base}.${(resto ?? "").padEnd(3, "0")}Z`;
}

/**
 * Arma la respuesta de una página a partir de `limite + 1` filas ordenadas por (updatedAt, id).
 * - `hayMas`: había más filas después de la página.
 * - `siguiente`: cursor de la última fila revisada de la página (si se descartó alguna al final, igual se avanza
 *   sobre ella para no releerla). Sin filas, el mismo cursor recibido (o null).
 */
export function armarPagina<F extends Cursor, V>(
  filas: F[],
  limite: number,
  cursorRecibido: string | null,
  aVenta: (f: F) => V | null,
): { ventas: V[]; siguiente: string | null; hayMas: boolean } {
  const hayMas = filas.length > limite;
  const pagina = filas.slice(0, limite);
  const ventas = pagina.map(aVenta).filter((v): v is V => v !== null);
  const ultima = pagina[pagina.length - 1];
  return { ventas, siguiente: ultima ? codificarCursor(ultima) : cursorRecibido, hayMas };
}
