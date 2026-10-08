/**
 * Opciones de pago del presupuesto (etapa 3, Entrega A, spec §2 A.1). Módulo PURO: lo usan el
 * servidor (ajustes, borrador, envío, aceptación, enlace público) y los editores del navegador.
 *
 * Qué se guarda y dónde:
 * - `FotofficePresupuestoAjustes.paymentOptions`: las de la organización, como entrada de
 *   ¿Cuánto Cobro? (`CuantoCobroPaymentOptionsInput`). null (nunca se guardaron) o sin contado ni
 *   planes: se ofrece la de omisión.
 * - `FotofficePresupuestoVersion.paymentOptions` de un BORRADOR: la entrada editada en ese
 *   presupuesto. null = nunca se tocó: al enviar se usan las de la organización.
 * - La misma columna de una versión ENVIADA: la instantánea calculada sobre el total de la versión
 *   (`opcionesParaPresupuesto`), que ya no cambia. Se distingue por `schemaVersion`.
 *
 * Las cuentas y la normalización son las de `lib/pedidos/opciones-pago.ts` (portadas de ¿Cuánto
 * Cobro?); acá van la validación de lo que llega del formulario y lo que ve el cliente.
 */
import {
  normalizePaymentOptions,
  opcionesDeInstantanea,
  parsePaymentOptionsSnapshot,
  type CuantoCobroInstallmentPlanInput,
  type CuantoCobroPaymentOptionsInput,
  type CuantoCobroPaymentOptionsSnapshot,
  type OpcionPago,
} from "@/lib/pedidos/opciones-pago";
import { ID_OPCION_OMISION } from "@/lib/pedidos/constantes";
import type { ResultadoValidacion } from "./constantes";

export const MAX_PLANES = 12;
export const MAX_CUOTAS_PLAN = 60;
export const MAX_INTERES_PORCENTAJE = 500;
export const MAX_NOTA_OPCION = 300;

export const MENSAJES_OPCIONES_PAGO = {
  invalidas: "Las opciones de pago no son válidas.",
  planes: `Podés cargar hasta ${MAX_PLANES} planes de cuotas.`,
  cuotas: `Cada plan necesita una cantidad de cuotas entera, de 1 a ${MAX_CUOTAS_PLAN}.`,
  interes: `El interés tiene que ser un porcentaje de 0 a ${MAX_INTERES_PORCENTAJE}.`,
  descuento: "El descuento de contado tiene que ser un porcentaje de 0 a 100.",
  nota: `Cada nota comercial puede tener hasta ${MAX_NOTA_OPCION} caracteres.`,
  elegida: "La forma de pago elegida no es válida. Recargá la página y elegí una de las opciones.",
} as const;

/** Sin contado ni planes: el presupuesto ofrece la opción por omisión. */
export function opcionesVacias(): CuantoCobroPaymentOptionsInput {
  return { cashEnabled: false, cashDiscountPercent: "", cashCommercialNote: "", installmentPlans: [] };
}

/** Porcentaje escrito por una persona ("10", "12,5"); null si no es un número. Vacío = 0. */
function porcentaje(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (t === "") return 0;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Valida y limpia las opciones que llegan de un formulario (Configuración o el editor). Usa
 * `normalizePaymentOptions` y además exige cuotas de 1 a 60, porcentajes razonables y notas cortas.
 *
 * `index_suggested` (interés sugerido por índice) no se puede elegir en FOTOFFICE porque el índice
 * consulta la red: sólo queda si ese mismo plan ya venía guardado así en `anteriores`, y entonces
 * la información del índice sale de lo guardado, no de lo que llegó. Si no, pasa a manual con la
 * tasa escrita.
 */
export function validarOpcionesPago(
  raw: unknown,
  anteriores: CuantoCobroPaymentOptionsInput | null = null,
): ResultadoValidacion<CuantoCobroPaymentOptionsInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: MENSAJES_OPCIONES_PAGO.invalidas };
  const crudo = raw as Record<string, unknown>;
  if (crudo.installmentPlans !== undefined && !Array.isArray(crudo.installmentPlans)) {
    return { ok: false, error: MENSAJES_OPCIONES_PAGO.invalidas };
  }
  const n = normalizePaymentOptions(raw as Partial<CuantoCobroPaymentOptionsInput>);
  if (n.installmentPlans.length > MAX_PLANES) return { ok: false, error: MENSAJES_OPCIONES_PAGO.planes };

  const descuento = porcentaje(n.cashDiscountPercent);
  if (descuento === null || descuento > 100) return { ok: false, error: MENSAJES_OPCIONES_PAGO.descuento };
  const notaContado = n.cashCommercialNote.trim();
  if (notaContado.length > MAX_NOTA_OPCION) return { ok: false, error: MENSAJES_OPCIONES_PAGO.nota };

  const guardados = new Map((anteriores?.installmentPlans ?? []).map((p) => [p.id, p]));
  const planes: CuantoCobroInstallmentPlanInput[] = [];
  for (const p of n.installmentPlans) {
    const cuotas = p.numberOfInstallments.trim();
    if (!/^\d+$/.test(cuotas) || Number(cuotas) < 1 || Number(cuotas) > MAX_CUOTAS_PLAN) {
      return { ok: false, error: MENSAJES_OPCIONES_PAGO.cuotas };
    }
    const nota = p.commercialNote.trim();
    if (nota.length > MAX_NOTA_OPCION) return { ok: false, error: MENSAJES_OPCIONES_PAGO.nota };

    const previo = guardados.get(p.id);
    const conIndice = p.interestMode === "index_suggested" && previo?.interestMode === "index_suggested";
    const modo = p.interestMode === "index_suggested" && !conIndice ? "manual" : p.interestMode;
    let interes = "";
    if (modo !== "none") {
      const tasa = porcentaje(p.interestPercent);
      if (tasa === null || tasa > MAX_INTERES_PORCENTAJE) return { ok: false, error: MENSAJES_OPCIONES_PAGO.interes };
      interes = p.interestPercent.trim() === "" ? "" : String(tasa);
    }
    planes.push({
      id: p.id,
      numberOfInstallments: String(Number(cuotas)),
      interestMode: modo,
      interestPercent: interes,
      commercialNote: nota,
      appliedIndexMetadata: conIndice ? (previo?.appliedIndexMetadata ?? null) : null,
    });
  }

  return {
    ok: true,
    valor: {
      cashEnabled: n.cashEnabled,
      cashDiscountPercent: n.cashDiscountPercent.trim() === "" ? "" : String(descuento),
      cashCommercialNote: notaContado,
      installmentPlans: planes,
    },
  };
}

/** Las opciones guardadas como entrada (de los ajustes o de un borrador); null si no hay o no sirven. */
export function entradaGuardada(raw: unknown): CuantoCobroPaymentOptionsInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const instantanea = parsePaymentOptionsSnapshot(raw);
  if (instantanea) return entradaDesdeInstantanea(instantanea);
  return normalizePaymentOptions(raw as Partial<CuantoCobroPaymentOptionsInput>);
}

/**
 * La entrada que reproduce una instantánea congelada: la usa la versión siguiente de un
 * presupuesto enviado (V2 arranca con las opciones de la V1). La de omisión no se copia como plan:
 * se vuelve a calcular al enviar (con la fecha del evento de ese momento).
 */
export function entradaDesdeInstantanea(s: CuantoCobroPaymentOptionsSnapshot): CuantoCobroPaymentOptionsInput {
  return {
    cashEnabled: Boolean(s.cash?.enabled),
    cashDiscountPercent: s.cash && s.cash.discountPercent > 0 ? String(s.cash.discountPercent) : "",
    cashCommercialNote: s.cash?.commercialNote ?? "",
    installmentPlans: s.installmentPlans
      .filter((p) => p.id !== ID_OPCION_OMISION)
      .map((p) => ({
        id: p.id,
        numberOfInstallments: String(p.numberOfInstallments),
        interestMode: p.interestMode,
        interestPercent: p.interestMode === "none" ? "" : String(p.interestPercent),
        commercialNote: p.commercialNote,
        appliedIndexMetadata: p.rateMetadata ?? null,
      })),
  };
}

/** Lo que el editor del presupuesto necesita de las opciones de pago (sin costos). */
export type OpcionesPagoEditor = {
  valor: CuantoCobroPaymentOptionsInput;
  /** "aaaa-mm-dd" del evento de la consulta (Argentina), o null. */
  fechaEvento: string | null;
  /** "aaaa-mm-dd" de hoy en Argentina. */
  hoy: string;
};

// --- Lo que ve el cliente --------------------------------------------------------------------

/** Una opción en el enlace público: nombre, importe por cuota, total y nota. Nada más. */
export type OpcionPublica = {
  id: string;
  etiqueta: string;
  cuotas: number;
  importeCuota: number;
  total: number;
  nota: string | null;
};

/** Copia campo por campo lo que se puede mostrar de cada opción congelada. */
export function opcionesPublicas(raw: unknown): OpcionPublica[] {
  const s = parsePaymentOptionsSnapshot(raw);
  if (!s) return [];
  return opcionesDeInstantanea(s).map((o: OpcionPago) => ({
    id: o.id,
    etiqueta: o.etiqueta,
    cuotas: o.cuotas,
    importeCuota: o.importeCuota,
    total: o.total,
    nota: o.nota.trim() ? o.nota.trim() : null,
  }));
}

/**
 * La opción que se guarda al aceptar, validada contra la instantánea de la versión:
 * - sin instantánea (versión enviada antes de las opciones de pago): sólo vale no elegir (null);
 * - sin elección (undefined, null o ""): la primera;
 * - un id que no está en la instantánea, u otra cosa: error.
 */
export function opcionElegida(raw: unknown, elegida: unknown): ResultadoValidacion<string | null> {
  const opciones = opcionesPublicas(raw);
  const vacia = elegida === undefined || elegida === null || elegida === "";
  if (opciones.length === 0) return vacia ? { ok: true, valor: null } : { ok: false, error: MENSAJES_OPCIONES_PAGO.elegida };
  if (vacia) return { ok: true, valor: opciones[0]!.id };
  if (typeof elegida !== "string") return { ok: false, error: MENSAJES_OPCIONES_PAGO.elegida };
  return opciones.some((o) => o.id === elegida) ? { ok: true, valor: elegida } : { ok: false, error: MENSAJES_OPCIONES_PAGO.elegida };
}

const formatoEntero = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const formatoCentavos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Importe de una cuota: sin decimales si es entero; con centavos si no ("$ 33.333,33"). */
export function pesosCuota(n: number): string {
  const centavos = Math.round(n * 100);
  return centavos % 100 === 0 ? formatoEntero.format(centavos / 100) : formatoCentavos.format(centavos / 100);
}

const formatoTotal = formatoEntero;

/** "3 cuotas de $ 40.000 · total $ 120.000" (o sólo el total, si es una). */
export function importeDeOpcion(o: Pick<OpcionPublica, "cuotas" | "importeCuota" | "total">): string {
  const total = formatoTotal.format(Math.round(o.total));
  return o.cuotas > 1 ? `${o.cuotas} cuotas de ${pesosCuota(o.importeCuota)} · total ${total}` : total;
}
