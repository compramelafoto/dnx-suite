import "server-only";
import type { SalesMode } from "@repo/muestras";
import { datosDeVenta } from "./consultas";
import { evaluarOferta } from "./evaluar";

/**
 * Los formatos de una obra para la página de compra (etapa 8, D11): cada uno con su precio
 * aprobado, cuántas copias quedan y si se puede comprar (o por qué no). Una consulta por tabla; el
 * consentimiento se lee de la última lectura guardada (`CulturalPayoutAccount`), sin llamar a
 * Mercado Pago (al pagar se vuelve a verificar).
 */
export type OfertaComprable = {
  id: string;
  format: string;
  editionKind: string;
  editionSize: number;
  proofCount: number;
  paper: string | null;
  widthCm: number | null;
  heightCm: number | null;
  /** El precio aprobado (al que se vende). */
  priceArs: number;
  quedan: number;
  comprable: { ok: true } | { ok: false; reasons: string[] };
};

export async function ofertasDeLaObra(
  activityId: string,
  activityWorkId: string,
  { modo, ambienteCuenta, ahora = new Date() }: { modo: SalesMode; ambienteCuenta: "SANDBOX" | "PRODUCTION"; ahora?: Date },
): Promise<OfertaComprable[]> {
  const d = await datosDeVenta(activityId, { ambienteCuenta }, ahora);
  if (!d) return [];
  const out: OfertaComprable[] = [];
  for (const o of d.ofertas) {
    if (o.activityWorkId !== activityWorkId || o.status === "WITHDRAWN" || o.status === "DRAFT") continue;
    const e = evaluarOferta(o, d.datos);
    if (e.precio == null) continue;
    const comprable = modo === "OFF" ? { ok: false as const, reasons: ["La venta está apagada en la plataforma"] } : e.comprable;
    out.push({
      id: o.id, format: o.format, editionKind: o.editionKind, editionSize: o.editionSize, proofCount: o.proofCount,
      paper: o.paper, widthCm: o.widthCm, heightCm: o.heightCm, priceArs: e.precio, quedan: e.quedan, comprable,
    });
  }
  return out;
}
