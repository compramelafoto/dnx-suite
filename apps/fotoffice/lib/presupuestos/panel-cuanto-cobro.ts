/**
 * Panel de ¿Cuánto Cobro? del editor de presupuestos. Módulo PURO: corre en el navegador (el motor
 * `@repo/cuanto-cobro-core` no tiene dependencias ni importa nada del servidor; lo garantiza su
 * propia prueba de pureza) y en las pruebas.
 *
 * El motor pide un perfil completo del fotógrafo (gastos por rubro, distribución del tiempo,
 * equipo…) y un trabajo con conceptos. El perfil sale de Configuración → Precios
 * (`FotofficePerfilPrecios`); el panel sólo pide el trabajo (`TrabajoPanel`), arma la entrada del
 * motor y guarda ESA entrada en el ítem (`calculo.entrada = { perfil, presupuesto }`): el servidor
 * la vuelve a correr al guardar (R2).
 *
 * El perfil de ¿Cuánto Cobro? tiene los gastos personales del fotógrafo: sólo lo ven quienes
 * tienen `configurar` (R4). Este módulo corre en el navegador: sólo importa `lib/precios/perfil-datos`
 * (puro), nunca `lib/precios/perfil` (servidor).
 */
import {
  calculateCuantoCobro,
  INITIAL_CUANTO_COBRO_CLIENT,
  INITIAL_CUANTO_COBRO_CLIENT_HOURS,
  INITIAL_CUANTO_COBRO_PROFILE,
  INITIAL_CUANTO_COBRO_QUOTE,
  parseCuantoCobroAmount,
  type CuantoCobroCalculationResult,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
  type CuantoCobroQuoteItem,
  type CuantoCobroQuoteItemType,
} from "@repo/cuanto-cobro-core";
import { itemDesdeCalculo, type EntradaMotor, type ResultadoItemCalculado } from "./calculo-cuanto-cobro";
import { normalizarPerfil, perfilesIguales } from "@/lib/precios/perfil-datos";
import type { Descuento } from "./constantes";

// --- Formulario del trabajo ----------------------------------------------------------------------

export const TIPOS_TRABAJO: readonly { valor: CuantoCobroQuoteItemType; etiqueta: string }[] = [
  { valor: "own-service", etiqueta: "Servicio propio (horas mías)" },
  { valor: "physical-product", etiqueta: "Producto físico (álbum, impresiones)" },
  { valor: "outsourced", etiqueta: "Trabajo tercerizado" },
  { valor: "expense", etiqueta: "Gasto o viático" },
];

/** Un concepto del trabajo, en corto. Montos como texto (como el motor). */
export type TrabajoPanel = {
  nombre: string;
  tipo: CuantoCobroQuoteItemType;
  /** Unidades que cubre (informativo: el ítem queda con cantidad 1 y el precio del renglón). */
  cantidad: string;
  horasCobertura: string;
  horasEdicion: string;
  horasEntrega: string;
  horasViaje: string;
  costoDirecto: string;
  costoProveedor: string;
  horasDiseno: string;
  costoEnvio: string;
  costoTercerizado: string;
  horasGestion: string;
  costoGasto: string;
  /** Ganancia deseada (%), para producto, tercerizado y gasto. */
  margenDeseado: string;
  /** Horas con el cliente (ventas, reuniones, coordinación), del trabajo entero. */
  horasCliente: string;
  /** Precio elegido a mano en el motor (vacío: el recomendado). */
  precioManual: string;
};

export function trabajoVacio(nombre = ""): TrabajoPanel {
  return {
    nombre,
    tipo: "own-service",
    cantidad: "1",
    horasCobertura: "",
    horasEdicion: "",
    horasEntrega: "",
    horasViaje: "",
    costoDirecto: "",
    costoProveedor: "",
    horasDiseno: "",
    costoEnvio: "",
    costoTercerizado: "",
    horasGestion: "",
    costoGasto: "",
    margenDeseado: "",
    horasCliente: "",
    precioManual: "",
  };
}

// --- Del formulario al motor -------------------------------------------------------------------

const numero = (v: string): number => parseCuantoCobroAmount(v) ?? 0;

function conceptoAlMotor(t: TrabajoPanel, id: string): CuantoCobroQuoteItem {
  return {
    id,
    name: t.nombre.trim(),
    description: "",
    quantity: t.cantidad.trim() || "1",
    itemType: t.tipo,
    coverageHours: t.horasCobertura.trim(),
    editingHours: t.horasEdicion.trim(),
    selectionHours: "",
    deliveryHours: t.horasEntrega.trim(),
    travelHours: t.horasViaje.trim(),
    administrationHours: "",
    salesHours: "",
    directCost: t.costoDirecto.trim(),
    estimatedShots: "",
    supplierCost: t.costoProveedor.trim(),
    productionHours: t.horasDiseno.trim(),
    reviewHours: "",
    correctionHours: "",
    packagingCost: "",
    shippingCost: t.costoEnvio.trim(),
    outsourcedLaborCost: t.costoTercerizado.trim(),
    managementHours: t.horasGestion.trim(),
    desiredMarginPercent: t.margenDeseado.trim(),
    expenseCost: t.costoGasto.trim(),
  };
}

export function trabajoAlMotor(t: TrabajoPanel, tipoDeTrabajo: string): CuantoCobroQuoteInput {
  return {
    ...INITIAL_CUANTO_COBRO_QUOTE,
    client: {
      ...INITIAL_CUANTO_COBRO_CLIENT,
      jobType: tipoDeTrabajo.trim() || t.nombre.trim() || "Trabajo",
      hours: { ...INITIAL_CUANTO_COBRO_CLIENT_HOURS, salesHours: t.horasCliente.trim() },
    },
    concepts: [conceptoAlMotor(t, "concepto-1")],
    chosenPrice: t.precioManual.trim(),
    paymentOptions: { ...INITIAL_CUANTO_COBRO_QUOTE.paymentOptions, installmentPlans: [] },
  };
}

export function entradaDelPanel(perfil: CuantoCobroProfileInput, trabajo: TrabajoPanel, tipoDeTrabajo = ""): EntradaMotor {
  return { perfil, presupuesto: trabajoAlMotor(trabajo, tipoDeTrabajo) };
}

// --- Del motor al formulario (para reabrir el panel) ---------------------------------------------

export type PerfilParaPanel = {
  perfil: CuantoCobroProfileInput | null;
  origen: "item" | "workspace" | "ninguno";
  /** Sólo con origen "item": el perfil del workspace cambió desde que se calculó el ítem. */
  desactualizado: boolean;
};

/**
 * El perfil con el que se abre el panel de un ítem: el que quedó guardado en SU cálculo (así se
 * reabre con los mismos números con los que se calculó, y se avisa si el del workspace cambió);
 * si no tiene, el del workspace, y si tampoco, ninguno.
 */
export function perfilParaPanel(
  item: { calculo: { entrada: unknown } | null } | null,
  perfilDelWorkspace: CuantoCobroProfileInput | null,
): PerfilParaPanel {
  const guardado = item?.calculo ? normalizarPerfil((item.calculo.entrada as { perfil?: unknown } | null)?.perfil) : null;
  if (guardado) {
    return { perfil: guardado, origen: "item", desactualizado: perfilDelWorkspace !== null && !perfilesIguales(guardado, perfilDelWorkspace) };
  }
  if (perfilDelWorkspace) return { perfil: perfilDelWorkspace, origen: "workspace", desactualizado: false };
  return { perfil: null, origen: "ninguno", desactualizado: false };
}

/** El primer concepto del trabajo guardado, en corto. */
export function trabajoDesdeMotor(raw: unknown): { trabajo: TrabajoPanel; tipoDeTrabajo: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Partial<CuantoCobroQuoteInput>;
  const c = Array.isArray(q.concepts) ? q.concepts[0] : undefined;
  if (!c) return null;
  return {
    tipoDeTrabajo: q.client?.jobType ?? "",
    trabajo: {
      nombre: c.name ?? "",
      tipo: c.itemType ?? "own-service",
      cantidad: c.quantity || "1",
      horasCobertura: c.coverageHours ?? "",
      horasEdicion: c.editingHours ?? "",
      horasEntrega: c.deliveryHours ?? "",
      horasViaje: c.travelHours ?? "",
      costoDirecto: c.directCost ?? "",
      costoProveedor: c.supplierCost ?? "",
      horasDiseno: c.productionHours ?? "",
      costoEnvio: c.shippingCost ?? "",
      costoTercerizado: c.outsourcedLaborCost ?? "",
      horasGestion: c.managementHours ?? "",
      costoGasto: c.expenseCost ?? "",
      margenDeseado: c.desiredMarginPercent ?? "",
      horasCliente: q.client?.hours?.salesHours ?? "",
      precioManual: q.chosenPrice ?? "",
    },
  };
}

// --- Calcular ---------------------------------------------------------------------------------

export function correrMotor(entrada: EntradaMotor): CuantoCobroCalculationResult | null {
  try {
    return calculateCuantoCobro(
      { ...INITIAL_CUANTO_COBRO_PROFILE, ...entrada.perfil },
      { ...INITIAL_CUANTO_COBRO_QUOTE, ...entrada.presupuesto },
    );
  } catch {
    return null;
  }
}

export type DatosItemCalculado = {
  id: string;
  nombre: string;
  seccion?: string | null;
  opcional?: boolean;
  descuento?: Descuento | null;
  productId?: string | null;
  /** Precio del renglón ajustado a mano en el editor; null: el sugerido. */
  precioAjustado?: number | null;
};

/**
 * Corre el motor con lo cargado en el panel y arma el ítem CALCULO (cantidad 1, precio del
 * renglón). Es la misma cuenta que repite el servidor al guardar.
 */
export function calcularItemDelPanel(
  perfil: CuantoCobroProfileInput,
  trabajo: TrabajoPanel,
  tipoDeTrabajo: string,
  datos: DatosItemCalculado,
  ahora: Date = new Date(),
): ResultadoItemCalculado {
  const entrada = entradaDelPanel(perfil, trabajo, tipoDeTrabajo);
  const resultado = correrMotor(entrada);
  if (!resultado) return { ok: false, error: "Los datos del cálculo de ¿Cuánto Cobro? no son válidos.", faltan: [] };
  const unidades = numero(trabajo.cantidad);
  return itemDesdeCalculo(resultado, {
    id: datos.id,
    nombre: datos.nombre.trim() || trabajo.nombre.trim() || "Trabajo calculado",
    cantidad: unidades > 0 ? unidades : 1,
    precioAjustado: datos.precioAjustado ?? null,
    descuento: datos.descuento ?? null,
    seccion: datos.seccion ?? null,
    opcional: datos.opcional === true,
    productId: datos.productId ?? null,
    parametros: entrada,
    calculadoEn: ahora,
  });
}

/**
 * "Armar con ¿Cuánto Cobro?": un perfil y varios conceptos dan un ítem CALCULO por concepto. Las
 * horas con el cliente son del trabajo entero: van sólo en el primero, para no cobrarlas dos veces.
 */
export function armarItemsDelAsistente(
  perfil: CuantoCobroProfileInput,
  trabajos: readonly TrabajoPanel[],
  tipoDeTrabajo: string,
  opciones: { seccion?: string | null; nuevaClave: () => string; ahora?: Date },
): { ok: true; items: Extract<ResultadoItemCalculado, { ok: true }>["item"][] } | { ok: false; error: string; faltan: string[] } {
  if (trabajos.length === 0) return { ok: false, error: "Agregá al menos un concepto.", faltan: [] };
  const items: Extract<ResultadoItemCalculado, { ok: true }>["item"][] = [];
  for (let i = 0; i < trabajos.length; i += 1) {
    const t = i === 0 ? trabajos[i]! : { ...trabajos[i]!, horasCliente: "" };
    const r = calcularItemDelPanel(perfil, t, tipoDeTrabajo, { id: opciones.nuevaClave(), nombre: t.nombre, seccion: opciones.seccion ?? null }, opciones.ahora);
    if (!r.ok) return { ok: false, error: `${t.nombre.trim() || `Concepto ${i + 1}`}: ${r.error}`, faltan: r.faltan };
    items.push(r.item);
  }
  return { ok: true, items };
}
