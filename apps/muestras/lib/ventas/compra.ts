import "server-only";
import { prisma } from "@repo/db";
import {
  DELIVERY_LABELS, OFFER_FORMAT_LABELS, SALE_TERMS_TEXT, SALE_TERMS_TEXT_VERSION, deliveryOptions, isOfferFormat, salePageState, type Delivery,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { obraALaVenta } from "./a-la-venta";
import { ofertasDeLaObra, type OfertaComprable } from "./comprable";
import { credencialesDeVentas, leerConfigDeVentas, puedeComprar } from "./config";
import { configVerificada } from "./modo";

/**
 * Lo que muestra "Adquirir obra" (etapa 8, D11, D33) en la sala y en la página pública. Los precios
 * se leen **sólo** cuando quien mira puede comprar y la venta está encendida: con la venta apagada,
 * o para un visitante en modo prueba, la página dice "La venta de esta obra todavía no está
 * disponible" y ni siquiera se consultan.
 */
export type FormatoALaVenta = {
  id: string;
  /** "Copia digital firmada". */
  titulo: string;
  /** "Hahnemühle Photo Rag 308 g · 40 × 60 cm · Edición de 10 · Quedan 7". */
  detalle: string;
  priceArs: number;
  digital: boolean;
  entregas: { valor: Delivery; texto: string; costoArs: number }[];
};

export type PaginaDeCompra =
  | { estado: "NOT_FOR_SALE" }
  | { estado: "UNAVAILABLE" }
  | { estado: "SOLD_OUT" }
  | {
      estado: "AVAILABLE";
      modoPrueba: boolean;
      publicKey: string;
      formatos: FormatoALaVenta[];
      terminos: string;
      terminosExtra: string | null;
      termsVersion: string;
    };

const cm = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** El detalle de un formato para la tarjeta (sin el precio, que va aparte). */
export function detalleDelFormato(o: Pick<OfertaComprable, "format" | "editionKind" | "editionSize" | "paper" | "widthCm" | "heightCm" | "quedan">): string {
  const partes: string[] = [];
  if (o.format === "PRINT") {
    if (o.paper?.trim()) partes.push(o.paper.trim());
    if (o.widthCm != null && o.heightCm != null) partes.push(`${cm(o.widthCm)} × ${cm(o.heightCm)} cm`);
  }
  if (o.editionKind === "UNIQUE") partes.push("Copia única");
  else partes.push(`Edición de ${o.editionSize}`, `Quedan ${o.quedan}`);
  return partes.join(" · ");
}

function entregasDe(
  format: string,
  setup: { shippingEnabled: boolean; shippingCostArs: number | null; pickupText: string | null; shippingText: string | null },
): FormatoALaVenta["entregas"] {
  return deliveryOptions(setup, format).map((d) => {
    if (d === "PICKUP") return { valor: d, texto: `Retiro en la sede${setup.pickupText?.trim() ? `: ${setup.pickupText.trim()}` : ""}`, costoArs: 0 };
    if (d === "SHIPPING") {
      const costo = setup.shippingCostArs ?? 0;
      return { valor: d, texto: `Envío: $${costo.toLocaleString("es-AR")}${setup.shippingText?.trim() ? ` — ${setup.shippingText.trim()}` : ""}`, costoArs: costo };
    }
    return { valor: d, texto: DELIVERY_LABELS[d], costoArs: 0 };
  });
}

export async function paginaDeCompra(activityId: string, activityWorkId: string, ahora: Date = new Date()): Promise<PaginaDeCompra> {
  const venta = await obraALaVenta(activityId, activityWorkId);
  const algo = venta.ofertaAprobada || venta.marcada;
  // Primero el modo por las variables (sin red) y si quien mira puede comprar.
  const usuario = await getUsuario();
  const leida = leerConfigDeVentas();
  const puede = algo && venta.ofertaAprobada && leida.modo !== "OFF" && puedeComprar(usuario, leida);
  const config = puede ? await configVerificada() : leida;
  const primero = salePageState({ mode: config.modo, viewerCanBuy: puede && puedeComprar(usuario, config), anyOfferForSale: algo, purchasableOffers: 1 });
  if (primero !== "AVAILABLE") return { estado: primero === "SOLD_OUT" ? "UNAVAILABLE" : primero };

  const [ofertas, setup] = await Promise.all([
    ofertasDeLaObra(activityId, activityWorkId, { modo: config.modo, ambienteCuenta: config.ambienteCuenta, ahora }),
    prisma.culturalSaleSetup.findUnique({ where: { activityId }, select: { shippingEnabled: true, shippingCostArs: true, pickupText: true, shippingText: true, extraTerms: true } }),
  ]);
  const comprables = ofertas.filter((o) => o.comprable.ok);
  const estado = salePageState({ mode: config.modo, viewerCanBuy: true, anyOfferForSale: true, purchasableOffers: comprables.length });
  const publicKey = credencialesDeVentas().publicKey;
  if (estado === "SOLD_OUT") {
    // "Se vendieron todas" sólo si de verdad no queda ninguna; si falta otra cosa, no está disponible.
    return ofertas.length > 0 && ofertas.every((o) => o.quedan === 0) ? { estado: "SOLD_OUT" } : { estado: "UNAVAILABLE" };
  }
  if (estado !== "AVAILABLE" || !setup || !publicKey) return { estado: "UNAVAILABLE" };
  return {
    estado: "AVAILABLE",
    modoPrueba: config.modo === "TEST",
    publicKey,
    formatos: comprables.map((o) => ({
      id: o.id,
      titulo: isOfferFormat(o.format) && o.format === "PRINT" ? "Copia impresa Fine Art" : OFFER_FORMAT_LABELS.DIGITAL,
      detalle: detalleDelFormato(o),
      priceArs: o.priceArs,
      digital: o.format === "DIGITAL",
      entregas: entregasDe(o.format, setup),
    })),
    terminos: SALE_TERMS_TEXT,
    terminosExtra: setup.extraTerms?.trim() || null,
    termsVersion: SALE_TERMS_TEXT_VERSION,
  };
}
