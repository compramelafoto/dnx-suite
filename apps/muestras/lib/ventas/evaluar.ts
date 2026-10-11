import {
  editionRemaining, offerPurchasable, offerSellingPrice, saleWindowOpen, type EditionRow,
} from "@repo/muestras";

/**
 * Junta lo leído de la base y aplica `offerPurchasable` (D11) a cada formato. Sin base ni red: lo
 * usan el panel de la organización, el del autor y la página de compra, para que las tres digan lo
 * mismo. Las copias tienen que venir ya filtradas por ambiente (`isTest`) y por tipo `COPY`.
 */
export type DatosDeEvaluacion = {
  actividad: { reviewStatus: string; isCancelled: boolean; endsAt: Date };
  setup: { status: string; splitVersion: number; organizerUserId: number } | null;
  /** Obras que se pueden vender (D8), por `activityWorkId`. */
  vendibles: ReadonlyMap<string, { authorUserId: number; authorName: string }>;
  /** Versión del reparto aceptada por cada autor. */
  terminos: ReadonlyMap<number, number>;
  /** Estado del consentimiento de reparto por persona, en el ambiente del modo. */
  consentimientos: ReadonlyMap<number, string>;
  /** Estado del original por `activityWorkId`. */
  originales: ReadonlyMap<string, string>;
  firmas: ReadonlySet<number>;
  copias: ReadonlyMap<string, readonly EditionRow[]>;
  /** Ambiente de la numeración que se cuenta (D4). */
  isTest: boolean;
  ahora: Date;
};

export type OfertaParaEvaluar = {
  id: string;
  activityWorkId: string;
  authorUserId: number;
  status: string;
  priceArs: number;
  approvedPriceArs: number | null;
  editionSize: number;
};

export type Evaluacion = {
  /** Precio al que se vende ahora (el aprobado), o null. */
  precio: number | null;
  quedan: number;
  vendidas: number;
  comprable: { ok: true } | { ok: false; reasons: string[] };
};

/** Prefijo de la nota con la que el autor pide sus pruebas de autor (sin tabla nueva). */
export const PEDIDO_PA = "Pedido de P/A:";

export const VENTA_CERRADA = "La venta de la muestra cerró (pasaron 30 días del cierre)";

export function evaluarOferta(o: OfertaParaEvaluar, d: DatosDeEvaluacion): Evaluacion {
  const filas = d.copias.get(o.id) ?? [];
  const quedan = editionRemaining(filas, o.editionSize, d.ahora, "COPY", d.isTest);
  const vendidas = filas.filter((f) => f.status === "ISSUED" && (f.isTest ?? false) === d.isTest && (f.kind ?? "COPY") === "COPY").length;
  const obra = d.vendibles.get(o.activityWorkId);
  const nombre = obra?.authorName ?? "El autor";
  const r = offerPurchasable({
    setupStatus: d.setup?.status ?? "DRAFT",
    activityPublished: d.actividad.reviewStatus === "APPROVED" && !d.actividad.isCancelled,
    offerStatus: o.status,
    approvedPriceArs: o.approvedPriceArs,
    authorAcceptedVersion: d.terminos.get(o.authorUserId) ?? null,
    splitVersion: d.setup?.splitVersion ?? -1,
    // La obra tiene que seguir siendo vendible y del mismo autor que propuso el formato.
    workSellable: obra != null && obra.authorUserId === o.authorUserId,
    organizerConsent: d.setup ? d.consentimientos.get(d.setup.organizerUserId) ?? null : null,
    authorConsent: d.consentimientos.get(o.authorUserId) ?? null,
    needsFile: true,
    fileReady: d.originales.get(o.activityWorkId) === "READY",
    signature: d.firmas.has(o.authorUserId),
    remaining: quedan,
    authorName: nombre,
  });
  const ventana = saleWindowOpen({ endsAt: d.actividad.endsAt, now: d.ahora });
  const comprable = ventana ? r : { ok: false as const, reasons: [...(r.ok ? [] : r.reasons), VENTA_CERRADA] };
  return { precio: offerSellingPrice(o), quedan, vendidas, comprable };
}
