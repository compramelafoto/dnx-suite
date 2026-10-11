import "server-only";
import { after } from "next/server";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { avisarCompraPagada, avisarPagoNoAcreditado, avisarSegundoPago } from "./avisos-compra";
import { registrarCompraPagada } from "./compras";
import { registrarEventoSinFallar } from "./eventos";
import { compraDeReferencia, hechosDelPago, pagoAprobado } from "./venta-publica";

/**
 * Acreditar el pago de unas fotos extra (etapa 7, Entrega A2): lo que comparten el webhook y la vuelta del
 * comprador. Un pago `approved`, leído con el token de la organización dueña de la galería, cuya referencia
 * (`fo-galcompra:<id>`) nombra una compra de ESA organización, por un importe mayor o igual al total. La
 * escritura la hace `registrarCompraPagada` (única puerta a PAGADA, idempotente). Nunca lanza ni loguea datos
 * personales.
 */

/** Un pago leído en Mercado Pago (lo que devuelve `getPayment` del adaptador). */
export type PagoMp = {
  providerPaymentId: string;
  status: string;
  amountMinor: number;
  currency: string;
  externalReference: string | null;
  rawSanitized: Record<string, unknown>;
};

export type ResultadoAcreditarGaleria =
  | { resultado: "acreditado"; compraId: string }
  /** El aviso se repite: ese pago ya estaba acreditado. */
  | { resultado: "ya_acreditado"; compraId: string }
  | { resultado: "no_aprobado" }
  /** La referencia no es de una compra, o la compra no es de esta organización. */
  | { resultado: "no_es_de_esta_organizacion" }
  /** Aprobado pero NO acreditado (importe menor, otra moneda): quedó el evento y el aviso al estudio. */
  | { resultado: "sin_aplicar"; motivo: "IMPORTE_MENOR" | "MONEDA"; compraId: string }
  | { resultado: "fallo" };

export type DepsAcreditarGaleria = {
  /** Para las pruebas: ejecuta los correos (por omisión, `after()` de Next). */
  luego?: (tarea: () => Promise<unknown>) => void;
};

function programar(tarea: () => Promise<unknown>, deps: DepsAcreditarGaleria): void {
  const segura = () => tarea().catch(() => undefined);
  if (deps.luego) return deps.luego(segura);
  try {
    after(segura);
  } catch {
    void segura();
  }
}

/** Cuántas fotos de la compra ya están en una compra PAGADA del mismo cliente. */
async function fotosYaPagadas(workspaceId: string, compraId: string, galeriaClienteId: string): Promise<number> {
  const mias = await prisma.fotofficeGaleriaCompraFoto.findMany({ where: { compraId }, select: { fotoId: true } });
  if (mias.length === 0) return 0;
  const pagadas = await prisma.fotofficeGaleriaCompra.findMany({
    where: { workspaceId, galeriaClienteId, status: "PAGADA" },
    select: { id: true },
  });
  const otrasCompras = pagadas.filter((p) => p.id !== compraId);
  if (otrasCompras.length === 0) return 0;
  const ids = new Set(mias.map((f) => f.fotoId));
  const otras = await prisma.fotofficeGaleriaCompraFoto.findMany({ where: { compraId: { in: otrasCompras.map((p) => p.id) } }, select: { fotoId: true } });
  return otras.filter((f) => ids.has(f.fotoId)).length;
}

type CompraLeida = { id: string; galeriaId: string; galeriaClienteId: string; providerPaymentRef: string | null };

/**
 * La compra ya estaba PAGADA. Si es el mismo pago, es un aviso repetido. Si es OTRO pago aprobado (se abrió el
 * checkout dos veces, o el estudio la marcó paga a mano), el dinero llegó dos veces: NO se crea otro movimiento
 * de Caja, pero queda `PAGO_DUPLICADO` (una sola vez por pago) con id, importe y fecha, y un aviso al estudio.
 */
async function segundoPago(workspaceId: string, compra: CompraLeida, hechos: ReturnType<typeof hechosDelPago>, deps: DepsAcreditarGaleria): Promise<ResultadoAcreditarGaleria> {
  const compraId = compra.id;
  if (compra.providerPaymentRef === hechos.providerPaymentId) return { resultado: "ya_acreditado", compraId };
  // Un pago que ya está en OTRA compra es de ésa: no es un duplicado de ésta.
  const enOtra = await prisma.fotofficeGaleriaCompra.findFirst({ where: { providerPaymentRef: hechos.providerPaymentId }, select: { id: true } });
  if (enOtra) return { resultado: "ya_acreditado", compraId };
  const previos = await prisma.fotofficeGaleriaEvento.findMany({ where: { workspaceId, galeriaId: compra.galeriaId, type: "PAGO_DUPLICADO" }, select: { data: true } });
  if (previos.some((e) => (e.data as { pago?: unknown } | null)?.pago === hechos.providerPaymentId)) return { resultado: "ya_acreditado", compraId };
  const base = { workspaceId, galeriaId: compra.galeriaId, galeriaClienteId: compra.galeriaClienteId };
  await registrarEventoSinFallar({
    ...base, tipo: "PAGO_DUPLICADO",
    data: { compraId, motivo: "SEGUNDO_PAGO", pago: hechos.providerPaymentId, pagadoCents: hechos.amountMinor, fecha: (hechos.paidAt ?? new Date()).toISOString() },
  });
  programar(() => avisarSegundoPago({ ...base, compraId, pagadoCents: hechos.amountMinor }), deps);
  return { resultado: "ya_acreditado", compraId };
}

/**
 * Acredita un pago de Mercado Pago ya leído con el token de `workspaceId`. Una compra CANCELADA que igual se
 * pagó SE ACREDITA (el dinero llegó: Caja tiene que coincidir con la realidad) y queda constancia; si sus fotos
 * ya estaban pagas en otra compra, además se registra `PAGO_DUPLICADO` y se avisa al estudio.
 */
export async function acreditarPagoGaleria(workspaceId: string, pago: PagoMp, deps: DepsAcreditarGaleria = {}): Promise<ResultadoAcreditarGaleria> {
  try {
    const compraId = compraDeReferencia(pago.externalReference);
    if (!compraId) return { resultado: "no_es_de_esta_organizacion" };
    // El pago se leyó con el token de ESTA organización: la compra tiene que ser suya.
    const compra = await prisma.fotofficeGaleriaCompra.findFirst({
      where: { id: compraId, workspaceId },
      select: { id: true, galeriaId: true, galeriaClienteId: true, status: true, totalArs: true, providerPaymentRef: true },
    });
    if (!compra) {
      console.warn("[galerias] aviso de un pago cuya compra no es de la organización que lo cobró");
      return { resultado: "no_es_de_esta_organizacion" };
    }
    if (!pagoAprobado(pago)) return { resultado: "no_aprobado" };

    const hechos = hechosDelPago(pago);
    const totalCents = decimalArsToMinor(compra.totalArs);
    const base = { workspaceId, galeriaId: compra.galeriaId, galeriaClienteId: compra.galeriaClienteId };

    if (compra.status === "PAGADA") return segundoPago(workspaceId, compra, hechos, deps);

    const motivo = hechos.currency !== "ARS" ? "MONEDA" : hechos.amountMinor < totalCents ? "IMPORTE_MENOR" : null;
    if (motivo) {
      console.warn("[galerias] pago aprobado sin acreditar", { motivo });
      // El mismo aviso puede llegar varias veces: el evento y el correo salen una sola vez por pago.
      const previos = await prisma.fotofficeGaleriaEvento.findMany({
        where: { workspaceId, galeriaId: compra.galeriaId, type: "PAGO_NO_ACREDITADO" },
        select: { data: true },
      });
      const yaAvisado = previos.some((e) => (e.data as { pago?: unknown } | null)?.pago === hechos.providerPaymentId);
      if (!yaAvisado) {
        await registrarEventoSinFallar({
          ...base, tipo: "PAGO_NO_ACREDITADO",
          data: { compraId, motivo, pago: hechos.providerPaymentId, pagadoCents: hechos.amountMinor, totalCents },
        });
        programar(
          () => avisarPagoNoAcreditado({ ...base, compraId, motivo, pagadoCents: hechos.amountMinor, totalCents }),
          deps,
        );
      }
      return { resultado: "sin_aplicar", motivo, compraId };
    }

    const eraCancelada = compra.status === "CANCELADA";
    const repetidas = eraCancelada || compra.status === "PENDIENTE" ? await fotosYaPagadas(workspaceId, compraId, compra.galeriaClienteId) : 0;

    const r = await registrarCompraPagada({
      workspaceId,
      compraId,
      paidAt: hechos.paidAt ?? new Date(),
      medio: "MERCADO_PAGO",
      proveedor: {
        paymentRef: hechos.providerPaymentId,
        feeCents: hechos.feeMinor,
        netCents: hechos.feeMinor === null ? null : hechos.amountMinor - hechos.feeMinor,
      },
      actorUserId: null,
      aceptarCancelada: true,
    });
    if (!r.ok) {
      if (r.codigo === "PAGO_REPETIDO") return { resultado: "ya_acreditado", compraId };
      console.warn("[galerias] pago aprobado sin acreditar", { codigo: r.codigo });
      return { resultado: "fallo" };
    }
    if (r.yaEstabaPagada) {
      // Otra corrida la acreditó entre la lectura y la escritura: si fue con otro pago, éste es el segundo.
      const ahora = await prisma.fotofficeGaleriaCompra.findFirst({ where: { id: compraId, workspaceId }, select: { providerPaymentRef: true } });
      return segundoPago(workspaceId, { ...compra, providerPaymentRef: ahora?.providerPaymentRef ?? null }, hechos, deps);
    }

    if (eraCancelada) await registrarEventoSinFallar({ ...base, tipo: "COMPRA_CANCELADA_PAGADA", data: { compraId, pago: hechos.providerPaymentId } });
    if (repetidas > 0) await registrarEventoSinFallar({ ...base, tipo: "PAGO_DUPLICADO", data: { compraId, fotosRepetidas: repetidas, pago: hechos.providerPaymentId } });
    programar(() => avisarCompraPagada({ workspaceId, compraId, sinCaja: r.sinCaja, fotosRepetidas: repetidas > 0 }), deps);
    return { resultado: "acreditado", compraId };
  } catch (error) {
    console.error("[galerias] falló la acreditación de un pago", { detalle: sanitizeError(error) });
    return { resultado: "fallo" };
  }
}
