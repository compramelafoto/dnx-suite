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
  withoutOneTimeAdjustments,
  type CuantoCobroCalculationResult,
  type CuantoCobroJobAdjustments,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
  type CuantoCobroAssignmentActivity,
  type CuantoCobroQuoteAssignment,
  type CuantoCobroQuoteItem,
  type CuantoCobroQuoteItemType,
  type StudioPerson,
} from "@repo/cuanto-cobro-core";
import { itemDesdeCalculo, presupuestoParaElMotor, type EntradaMotor, type ResultadoItemCalculado } from "./calculo-cuanto-cobro";
import { normalizarPerfil, perfilesIguales } from "@/lib/precios/perfil-datos";
import type { Descuento } from "./constantes";
import { diaEnBuenosAires } from "./estados";

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
  /**
   * Máximo de disparos que se planean para este trabajo (sólo servicio propio): con la cámara del
   * perfil (valor de reposición / vida útil del obturador) el motor calcula su desgaste.
   */
  disparosEstimados: string;
  costoDirecto: string;
  costoProveedor: string;
  horasDiseno: string;
  costoEnvio: string;
  /** Embalaje del producto físico (por unidad, como el costo del proveedor). */
  costoEmbalaje: string;
  costoTercerizado: string;
  horasGestion: string;
  costoGasto: string;
  /** Ganancia deseada (%), para producto, tercerizado y gasto. */
  margenDeseado: string;
  /** Horas con el cliente (ventas, reuniones, coordinación), del trabajo entero. */
  horasCliente: string;
  /** Precio elegido a mano en el motor (vacío: el recomendado). */
  precioManual: string;
  /** Mi estudio: quién hace cada parte (horas-persona por actividad). */
  asignaciones?: AsignacionPanel[];
  /** Cámara de los disparos ("" o ausente: la principal). Servicio propio y producto. */
  camara?: string;
  /** "job": los disparos son del trabajo entero; si no, por unidad (lo de siempre). */
  disparosPor?: "unit" | "job";
  /** Mi estudio: la línea del estudio del trabajo (informativo). */
  linea?: string;
  /** Mi estudio: la persona «por trabajo» que hace este tercerizado (para recordar la elección). */
  tercerizadoPor?: string;
};

/** Una parte del trabajo asignada a una persona del estudio. */
export type AsignacionPanel = { persona: string; actividad: CuantoCobroAssignmentActivity; horas: string };

/** El campo de horas del panel de cada actividad asignable. */
export const CAMPO_DE_ACTIVIDAD: Record<CuantoCobroAssignmentActivity, keyof TrabajoPanel> = {
  coverage: "horasCobertura",
  editing: "horasEdicion",
  delivery: "horasEntrega",
  travel: "horasViaje",
  production: "horasDiseno",
  management: "horasGestion",
};

/** Las actividades que se asignan según el tipo de concepto. */
export const ACTIVIDADES_DEL_TIPO: Record<CuantoCobroQuoteItemType, CuantoCobroAssignmentActivity[]> = {
  "own-service": ["coverage", "editing", "delivery", "travel"],
  "physical-product": ["production"],
  outsourced: ["management"],
  expense: [],
};

const horasNum = (v: string): number => {
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Cambia las asignaciones y deja las horas de cada actividad asignada = la suma de lo asignado
 * (horas-persona: dos fotógrafos 6 h = 12 h de cobertura). Las actividades sin asignar no se tocan.
 */
export function conAsignaciones(t: TrabajoPanel, asignaciones: AsignacionPanel[]): TrabajoPanel {
  const out: TrabajoPanel = { ...t, asignaciones };
  const suma = new Map<CuantoCobroAssignmentActivity, number>();
  for (const a of asignaciones) suma.set(a.actividad, (suma.get(a.actividad) ?? 0) + horasNum(a.horas));
  for (const [actividad, total] of suma) {
    const campo = CAMPO_DE_ACTIVIDAD[actividad];
    (out as Record<string, unknown>)[campo] = total > 0 ? String(Math.round(total * 100) / 100).replace(".", ",") : "";
  }
  return out;
}

/** Un tercerizado hecho por una persona «por trabajo» del estudio: su tarifa (por trabajo, o por hora × horas). */
export function tercerizadoDePersona(t: TrabajoPanel, persona: StudioPerson, horas = ""): TrabajoPanel {
  const tarifa = parseCuantoCobroAmount(persona.perJobRate) ?? 0;
  const costo = persona.perJobUnit === "hour" ? Math.round(tarifa * horasNum(horas)) : tarifa;
  return {
    ...t,
    tipo: "outsourced",
    nombre: t.nombre.trim() || persona.name.trim(),
    tercerizadoPor: persona.id,
    costoTercerizado: costo > 0 ? String(costo) : "",
  };
}

export function trabajoVacio(nombre = ""): TrabajoPanel {
  return {
    nombre,
    tipo: "own-service",
    cantidad: "1",
    horasCobertura: "",
    horasEdicion: "",
    horasEntrega: "",
    horasViaje: "",
    disparosEstimados: "",
    costoDirecto: "",
    costoProveedor: "",
    horasDiseno: "",
    costoEnvio: "",
    costoEmbalaje: "",
    costoTercerizado: "",
    horasGestion: "",
    costoGasto: "",
    margenDeseado: "",
    horasCliente: "",
    precioManual: "",
  };
}

// --- Ajustes del trabajo (precio completo, etapa A) ---------------------------------------------

/**
 * Lo del trabajo entero que cambia el precio: fecha del evento (fin de semana, feriado, inflación),
 * entrega exprés, viáticos (km o zona), seguro que pide el lugar y fotos a retocar. Los recargos y
 * porcentajes salen del perfil (Configuración → Precios).
 */
export type AjustesTrabajo = {
  /** "AAAA-MM-DD". */
  fechaEvento: string;
  expres: boolean;
  /** Distancia de ida en km. */
  distanciaKm: string;
  /** Zona de viáticos (modo por zonas). */
  zonaId: string;
  seguroEvento: string;
  fotosRetoque: string;
  /** Este trabajo no suma la comisión del medio de pago. */
  sinComision: boolean;
};

export function ajustesVacios(): AjustesTrabajo {
  return { fechaEvento: "", expres: false, distanciaKm: "", zonaId: "", seguroEvento: "", fotosRetoque: "", sinComision: false };
}

/** Los ajustes como los recibe el motor; undefined si no hay ninguno (el trabajo queda como antes). */
export function ajustesAlMotor(a: AjustesTrabajo | undefined, ahora: Date): CuantoCobroJobAdjustments | undefined {
  if (!a) return undefined;
  const out: CuantoCobroJobAdjustments = {};
  if (a.fechaEvento.trim()) out.eventDate = a.fechaEvento.trim();
  if (a.expres) out.express = true;
  if (a.sinComision) out.includeCommission = false;
  if (a.distanciaKm.trim()) out.distanceKm = a.distanciaKm.trim();
  if (a.zonaId.trim()) out.travelZoneId = a.zonaId.trim();
  if (a.seguroEvento.trim()) out.eventInsuranceCost = a.seguroEvento.trim();
  if (a.fotosRetoque.trim()) out.retouchPhotos = a.fotosRetoque.trim();
  if (Object.keys(out).length === 0) return undefined;
  // El motor no lee el reloj: la fecha del cálculo (para la inflación) va en la entrada.
  return { ...(out.eventDate ? { eventDate: out.eventDate } : {}), quoteDate: diaEnBuenosAires(ahora), ...out };
}

export function ajustesDesdeMotor(j: unknown): AjustesTrabajo {
  const a = ajustesVacios();
  if (!j || typeof j !== "object" || Array.isArray(j)) return a;
  const x = j as CuantoCobroJobAdjustments;
  const t = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    fechaEvento: t(x.eventDate),
    expres: x.express === true,
    distanciaKm: t(x.distanceKm),
    zonaId: t(x.travelZoneId),
    seguroEvento: t(x.eventInsuranceCost),
    fotosRetoque: t(x.retouchPhotos),
    sinComision: x.includeCommission === false,
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
    estimatedShots: t.disparosEstimados.trim(),
    supplierCost: t.costoProveedor.trim(),
    productionHours: t.horasDiseno.trim(),
    reviewHours: "",
    correctionHours: "",
    packagingCost: t.costoEmbalaje.trim(),
    shippingCost: t.costoEnvio.trim(),
    outsourcedLaborCost: t.costoTercerizado.trim(),
    managementHours: t.horasGestion.trim(),
    desiredMarginPercent: t.margenDeseado.trim(),
    expenseCost: t.costoGasto.trim(),
    ...(t.camara?.trim() ? { cameraId: t.camara.trim() } : {}),
    ...(t.disparosPor === "job" ? { shotsPer: "job" as const } : {}),
    ...(asignacionesAlMotor(t)),
  };
}

function asignacionesAlMotor(t: TrabajoPanel): { assignments?: CuantoCobroQuoteAssignment[] } {
  const validas = ACTIVIDADES_DEL_TIPO[t.tipo];
  const assignments = (t.asignaciones ?? [])
    .filter((a) => a.persona && validas.includes(a.actividad) && horasNum(a.horas) > 0)
    .map((a) => ({ personId: a.persona, activity: a.actividad, hours: a.horas.trim() }));
  return assignments.length > 0 ? { assignments } : {};
}

export function trabajoAlMotor(
  t: TrabajoPanel,
  tipoDeTrabajo: string,
  jobAdjustments?: CuantoCobroJobAdjustments,
): CuantoCobroQuoteInput {
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
    // La cámara se cobra por trabajo (los disparos de este trabajo); ver `presupuestoParaElMotor`.
    cameraWearModel: "per-job",
    ...(jobAdjustments ? { jobAdjustments } : {}),
    ...(t.linea?.trim() ? { businessLineId: t.linea.trim() } : {}),
  };
}

export function entradaDelPanel(
  perfil: CuantoCobroProfileInput,
  trabajo: TrabajoPanel,
  tipoDeTrabajo = "",
  ajustes?: AjustesTrabajo,
  ahora: Date = new Date(),
): EntradaMotor {
  return { perfil, presupuesto: trabajoAlMotor(trabajo, tipoDeTrabajo, ajustesAlMotor(ajustes, ahora)) };
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
export function trabajoDesdeMotor(raw: unknown): { trabajo: TrabajoPanel; tipoDeTrabajo: string; ajustes: AjustesTrabajo } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Partial<CuantoCobroQuoteInput>;
  const c = Array.isArray(q.concepts) ? q.concepts[0] : undefined;
  if (!c) return null;
  return {
    tipoDeTrabajo: q.client?.jobType ?? "",
    ajustes: ajustesDesdeMotor(q.jobAdjustments),
    trabajo: {
      nombre: c.name ?? "",
      tipo: c.itemType ?? "own-service",
      cantidad: c.quantity || "1",
      horasCobertura: c.coverageHours ?? "",
      horasEdicion: c.editingHours ?? "",
      horasEntrega: c.deliveryHours ?? "",
      horasViaje: c.travelHours ?? "",
      disparosEstimados: c.estimatedShots ?? "",
      costoDirecto: c.directCost ?? "",
      costoProveedor: c.supplierCost ?? "",
      horasDiseno: c.productionHours ?? "",
      costoEnvio: c.shippingCost ?? "",
      costoEmbalaje: c.packagingCost ?? "",
      costoTercerizado: c.outsourcedLaborCost ?? "",
      horasGestion: c.managementHours ?? "",
      costoGasto: c.expenseCost ?? "",
      margenDeseado: c.desiredMarginPercent ?? "",
      horasCliente: q.client?.hours?.salesHours ?? "",
      precioManual: q.chosenPrice ?? "",
      ...(Array.isArray(c.assignments) && c.assignments.length > 0
        ? {
            asignaciones: c.assignments
              .filter((a) => a && typeof a.personId === "string" && typeof a.hours === "string")
              .map((a) => ({ persona: a.personId, actividad: a.activity, horas: a.hours })),
          }
        : {}),
      ...(typeof c.cameraId === "string" && c.cameraId ? { camara: c.cameraId } : {}),
      ...(c.shotsPer === "job" ? { disparosPor: "job" as const } : {}),
      ...(typeof q.businessLineId === "string" && q.businessLineId ? { linea: q.businessLineId } : {}),
    },
  };
}

// --- Calcular ---------------------------------------------------------------------------------

export function correrMotor(entrada: EntradaMotor): CuantoCobroCalculationResult | null {
  try {
    return calculateCuantoCobro(
      { ...INITIAL_CUANTO_COBRO_PROFILE, ...entrada.perfil },
      presupuestoParaElMotor(entrada.presupuesto),
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
  ajustes?: AjustesTrabajo,
): ResultadoItemCalculado {
  return calcularDesdeEntrada(entradaDelPanel(perfil, trabajo, tipoDeTrabajo, ajustes, ahora), trabajo, datos, ahora);
}

function calcularDesdeEntrada(entrada: EntradaMotor, trabajo: TrabajoPanel, datos: DatosItemCalculado, ahora: Date): ResultadoItemCalculado {
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
  opciones: { seccion?: string | null; nuevaClave: () => string; ahora?: Date; ajustes?: AjustesTrabajo },
): { ok: true; items: Extract<ResultadoItemCalculado, { ok: true }>["item"][] } | { ok: false; error: string; faltan: string[] } {
  if (trabajos.length === 0) return { ok: false, error: "Agregá al menos un concepto.", faltan: [] };
  const items: Extract<ResultadoItemCalculado, { ok: true }>["item"][] = [];
  // Viáticos, seguro del evento y retoque son del trabajo entero: van sólo en el primer concepto
  // (como las horas con el cliente). La fecha, el exprés y la comisión valen para todos.
  const ahora = opciones.ahora ?? new Date();
  const primeros = ajustesAlMotor(opciones.ajustes, ahora);
  const siguientes = withoutOneTimeAdjustments(primeros);
  for (let i = 0; i < trabajos.length; i += 1) {
    const t = i === 0 ? trabajos[i]! : { ...trabajos[i]!, horasCliente: "" };
    const jobAdjustments = i === 0 ? primeros : siguientes;
    const entrada: EntradaMotor = { perfil, presupuesto: trabajoAlMotor(t, tipoDeTrabajo, jobAdjustments) };
    const r = calcularDesdeEntrada(entrada, t, { id: opciones.nuevaClave(), nombre: t.nombre, seccion: opciones.seccion ?? null }, ahora);
    if (!r.ok) return { ok: false, error: `${t.nombre.trim() || `Concepto ${i + 1}`}: ${r.error}`, faltan: r.faltan };
    items.push(r.item);
  }
  return { ok: true, items };
}
