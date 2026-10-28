import { z } from "@repo/dnx-bot";
import {
  COMMERCIAL_POSITIONING_OPTIONS,
  formatCuantoCobroCurrency,
  parseCuantoCobroAmount,
  type CuantoCobroPricingExtras,
  type CuantoCobroProfileInput,
  type CuantoCobroStudioStructure,
  type StudioEmploymentType,
  type StudioPerson,
} from "@repo/cuanto-cobro-core";
import {
  desgloseDelEstudio,
  encenderMiEstudio,
  estudioEncendido,
  localSeparadoActivo,
  separarLocal,
  MAX_CAMARAS_ADICIONALES,
  MAX_PERSONAS_DEL_ESTUDIO,
  normalizarCamaras,
  nuevaCamara,
  nuevaPersonaDelEstudio,
} from "@/lib/precios/estudio";
import {
  CLAVES_DISTRIBUCION,
  distribucionDesdeHoras,
  extrasDelPerfil,
  horasPorTarea,
  porcentajePositivo,
  porcentajeValido,
  normalizarPerfil,
  validarPerfil,
  type ClaveDistribucion,
} from "@/lib/precios/perfil-datos";
import { resumirPerfil } from "@/lib/precios/resumen";

/**
 * Capa determinística de DNX Bot (spec §5), parte del perfil de precios. PURA: no lee la base ni
 * la sesión. No tiene fórmulas: compone `normalizarPerfil`, `validarPerfil` y `resumirPerfil`
 * (las mismas del formulario de Configuración → Precios). El modelo sólo arma el *parche* con lo
 * que dijo la persona; acá se aplica sobre el perfil guardado y todo número que vuelve al modelo
 * sale formateado por el servidor, para que copie en vez de calcular.
 */

// ── Entrada que puede llenar el modelo ─────────────────────────────────────────────────────────

const monto = z
  .string()
  .regex(/^\d{1,12}$/)
  .describe("Monto en pesos, sólo dígitos (sin $, puntos ni comas). '450 lucas' → '450000'. Tiene que haberlo dicho la persona.");
const entero = z.string().regex(/^\d{1,9}$/).describe("Número entero, sólo dígitos.");

// ── Montos por período ("80 mil cada 3 meses") ─────────────────────────────────────────────────

export const PERIODOS = ["mensual", "semanal", "bimestral", "trimestral", "cuatrimestral", "semestral", "anual", "unica_vez"] as const;
export type Periodo = (typeof PERIODOS)[number];

/** Cuántos meses hay en el período, como fracción exacta (semana = 12/52 de mes). unica_vez: los meses que dijo. */
const FRACCION: Record<Exclude<Periodo, "unica_vez">, { num: number; den: number }> = {
  mensual: { num: 1, den: 1 },
  semanal: { num: 52, den: 12 },
  bimestral: { num: 1, den: 2 },
  trimestral: { num: 1, den: 3 },
  cuatrimestral: { num: 1, den: 4 },
  semestral: { num: 1, den: 6 },
  anual: { num: 1, den: 12 },
};

const FRASE: Record<Exclude<Periodo, "unica_vez">, string> = {
  mensual: "por mes",
  semanal: "por semana",
  bimestral: "cada 2 meses",
  trimestral: "cada 3 meses",
  cuatrimestral: "cada 4 meses",
  semestral: "cada 6 meses",
  anual: "por año",
};

/**
 * Pasa un monto de cualquier período a mensual, en pesos enteros: monto × num ÷ den redondeado al
 * peso más cercano (el medio peso, para arriba). Sólo enteros: sin errores de coma flotante.
 * 80.000 trimestral → 26.667; 1.000.000 anual → 83.333; 10.000 semanal → 43.333 (52 semanas / 12).
 */
export function aMensual(monto: number, periodo: Periodo, meses?: number): { ok: true; mensual: number } | { ok: false; error: string } {
  let f: { num: number; den: number };
  if (periodo === "unica_vez") {
    if (!meses || !Number.isInteger(meses) || meses < 1 || meses > 120) {
      return { ok: false, error: "Para repartir un gasto de una sola vez necesito en cuántos meses (entre 1 y 120)." };
    }
    f = { num: 1, den: meses };
  } else f = FRACCION[periodo];
  return { ok: true, mensual: Math.floor((2 * monto * f.num + f.den) / (2 * f.den)) };
}

const montoPeriodico = z
  .object({
    monto: z.string().regex(/^\d{1,12}$/).describe("El monto tal como lo dijo, sólo dígitos."),
    periodo: z.enum(PERIODOS).describe("Cada cuánto lo paga: semanal, bimestral (cada 2 meses), trimestral (cada 3), cuatrimestral (cada 4), semestral, anual, o unica_vez (un gasto de una sola vez que se reparte en `meses`)."),
    meses: z.string().regex(/^\d{1,3}$/).optional().describe("Sólo con unica_vez: en cuántos meses se reparte."),
  })
  .describe("Monto que la persona dijo por otro período que no es el mes. El servidor lo pasa a mensual: nunca dividas vos ni le pidas a la persona que haga la cuenta.");

/** Un monto mensual ("450000") o un monto con su período ({ monto: "80000", periodo: "trimestral" }). */
const montoMes = z.union([monto, montoPeriodico]);
type MontoMes = z.infer<typeof montoMes>;

export type Conversion = { etiqueta: string; detalle: string };
const horasOPct = z.string().regex(/^\d{1,3}([.,]\d{1,2})?$/);

const POSICIONAMIENTOS = ["starting", "growing", "stable", "established", "high-demand"] as const;

const porcentaje = z.string().regex(/^\d{1,3}([.,]\d{1,2})?$/).describe("Porcentaje, sólo el número (\"3,5\", \"30\").");

/** Impuestos, cobros y recargos (precio completo, etapa A). Todo opcional. */
const esquemaCobros = z
  .object({
    monotributo: montoMes.optional().describe("Cuota mensual del monotributo (es un costo fijo: sube el valor hora)."),
    seguroEquipoAnual: monto.optional().describe("Lo que paga POR AÑO de seguro del equipo."),
    condicionIva: z.enum(["monotributo", "responsable_inscripto", "exento"]).optional(),
    iva: porcentaje.optional().describe("Sólo responsable inscripto, si no es el 21 %."),
    ingresosBrutos: porcentaje.optional().describe("% de Ingresos Brutos sobre lo facturado. En régimen simplificado (incluido en el monotributo) va \"0\"."),
    comisionMedioDePago: porcentaje.optional().describe("% que le cobra Mercado Pago (u otro medio) por cada cobro."),
    sumarComisionAlPrecio: z.boolean().optional().describe("Si la comisión se suma al precio (por omisión, sí)."),
    sena: porcentaje.optional().describe("% de seña sobre el total."),
    recargoHoraExtra: porcentaje.optional(),
    recargoSabado: porcentaje.optional(),
    recargoDomingo: porcentaje.optional(),
    recargoFeriado: porcentaje.optional(),
    recargoExpres: porcentaje.optional().describe("% por entrega exprés."),
    diasDeEntrega: entero.optional().describe("Días de entrega habituales."),
    viaticos: z.enum(["por_km", "por_zonas", "no"]).optional().describe("Cómo cobra el viaje: por km, por zonas, o no cobra."),
    valorKm: monto.optional().describe("Por km recorrido (ida y vuelta)."),
    kmSinCargo: entero.optional().describe("Km sin cargo (ida y vuelta)."),
    zonas: z
      .array(z.object({ nombre: z.string().min(1).max(60), hastaKm: entero, monto }))
      .max(10)
      .optional()
      .describe("Zonas de viáticos, de la más cercana a la más lejana: hasta cuántos km y cuánto cobra."),
    minutosRetoquePorFoto: entero.optional(),
    inflacionMensual: porcentaje.optional().describe("Inflación mensual estimada para eventos a meses. \"0\" la apaga."),
    precioMinimo: monto.optional().describe("Precio mínimo por trabajo."),
    politicaCancelacion: z.string().max(2000).optional().describe("Texto de su política de cancelación, como lo dijo."),
  })
  .describe("Impuestos, cobros y recargos: sólo lo que dijo la persona.");

const ALCANCE_DEL_GASTO = { local: "local", coberturas: "coverage", compartido: "shared" } as const;

const diasOHoras = z.string().regex(/^\d{1,2}([.,]\d{1,2})?$/).describe("Número, con coma si hace falta (\"5,5\").");

/** Mi estudio (16/10/2026): sólo para workspaces de tipo estudio. Todo opcional; sólo lo que dijo la persona. */
const esquemaEstudio = z
  .object({
    activar: z.boolean().optional().describe("true: encender «Mi estudio» (gastos del local, retiro y sueldos por separado). false: apagarlo (no se borra nada)."),
    gastosFijos: z
      .array(
        z.object({
          rubroId: z.string().max(40).describe("id del rubro de gastos fijos, de ver_perfil_de_precios (premises, utilities, software, marketing, admin, maintenance, insurance, other)."),
          renglonId: z.string().max(80).optional().describe("id del renglón; si no existe, omitilo y mandá `etiqueta`."),
          etiqueta: z.string().min(1).max(60).optional(),
          monto: montoMes,
          de: z.enum(["local", "coberturas", "compartido"]).optional().describe("Sólo con «Local y coberturas» encendido: de quién es el gasto. local = del local; coberturas = sólo de las coberturas; compartido = se reparte entre los dos."),
        }),
      )
      .max(40)
      .optional()
      .describe("Gastos fijos del estudio (los que se pagan haya trabajo o no). Sin monotributo ni seguro del equipo: van en «cobros»."),
    retiro: montoMes.optional().describe("Lo que se lleva el dueño por mes, aparte del estudio."),
    tuJornada: z
      .object({ dias: diasOHoras.optional(), horasDia: diasOHoras.optional(), vacaciones: diasOHoras.optional().describe("Semanas por año."), vendible: porcentaje.optional().describe("% de su tiempo que termina en un presupuesto.") })
      .optional()
      .describe("La jornada del dueño."),
    personas: z
      .array(
        z.object({
          nombre: z.string().min(1).max(60).describe("Nombre de la persona: así se la encuentra para corregirla."),
          contratacion: z
            .enum(["dependencia", "informal", "monotributo", "jornal", "por_trabajo"])
            .optional()
            .describe("dependencia = registrada (con cargas); informal = sin registrar pero con aguinaldo y vacaciones pagas, sin cargas; monotributo = factura fija por mes; jornal = por día trabajado; por_trabajo = no es estructura (al cotizar va como tercerizado)."),
          sueldo: monto.optional().describe("Dependencia o informal: sueldo por mes. Monotributo: lo que factura por mes."),
          cargas: porcentaje.optional().describe("Sólo dependencia: cargas sociales (%). Si no lo sabe, no lo inventes."),
          aguinaldo: z.boolean().optional(),
          vacacionesPagas: z.boolean().optional(),
          jornal: monto.optional().describe("Sólo jornal: lo que cobra por día."),
          tarifaPorTrabajo: monto.optional(),
          unidadPorTrabajo: z.enum(["hora", "trabajo"]).optional(),
          dias: diasOHoras.optional().describe("Días por semana. 5 días + sábados alternados = \"5,5\"."),
          horasDia: diasOHoras.optional(),
          vacaciones: diasOHoras.optional().describe("Semanas de vacaciones por año."),
          vendible: porcentaje.optional().describe("% de su tiempo que termina en un presupuesto."),
          insumos: montoMes.optional().describe("Insumos y gastos de la persona por mes (viáticos, celular, uniforme)."),
          activa: z.boolean().optional(),
          de: z.enum(["local", "coberturas"]).optional().describe("Sólo con «Local y coberturas» encendido: si trabaja en el local o en las coberturas."),
          quitar: z.boolean().optional().describe("true: sacarla del equipo."),
        }),
      )
      .max(MAX_PERSONAS_DEL_ESTUDIO)
      .optional(),
    separarLocal: z.boolean().optional().describe("true: separar el local de las coberturas (cada gasto y cada persona va al local, a las coberturas o se comparte). false: volver a un solo estudio (no se borra nada)."),
    sueldoDelLocal: montoMes.optional().describe("Sólo separando el local: lo que el local le paga al dueño por mes."),
    tiempoEnElLocal: porcentaje.optional().describe("Sólo separando el local: qué % de su tiempo le da el dueño al local."),
    compartidoCoberturas: porcentaje.optional().describe("Sólo separando el local: qué % de los gastos compartidos lleva la cuenta de coberturas."),
    costoMercaderia: porcentaje.optional().describe("Sólo separando el local: % de lo que vende el local que se va en mercadería."),
    localEstimado: montoMes.optional().describe("Sólo separando el local: lo que deja el local por mes, cargado a mano (si no usa las ventas de Caja)."),
    otrasLineas: montoMes.optional().describe("Lo que dejan por mes productos, impresiones o cursos después de sus costos (se descuenta)."),
    ganancia: z
      .object({ monto: montoMes.optional().describe("Ganancia del estudio por mes, monto fijo."), porcentaje: porcentaje.optional().describe("O un % de la estructura.") })
      .optional()
      .describe("Ganancia del estudio para reinvertir, aparte del retiro."),
  })
  .describe("«Mi estudio»: estructura de costos de un estudio con equipo. Sólo si la situación dice que el workspace es un estudio.");

const esquemaCamaras = z
  .array(
    z.object({
      nombre: z.string().min(1).max(60).describe("Nombre de la cámara (la de carnets, la segunda…). No la principal: esa va en «equipo»."),
      valorReposicion: monto.optional(),
      vidaUtil: entero.optional().describe("Vida útil del obturador, en disparos."),
      disparosActuales: entero.optional(),
      quitar: z.boolean().optional(),
    }),
  )
  .max(MAX_CAMARAS_ADICIONALES)
  .describe("Otras cámaras del estudio, además de la principal.");

export const esquemaParchePerfil = z
  .object({
    moneda: z.string().regex(/^[A-Z]{3}$/).optional().describe("Código de moneda, por ejemplo ARS. Casi siempre ARS."),
    viveSoloDeFotografia: z.enum(["si", "no"]).optional(),
    ingresosExternos: montoMes.optional().describe("Sólo si no vive sólo de la fotografía: lo que le dejan sus otros ingresos por mes."),
    gastosPersonales: z
      .array(
        z.object({
          grupoId: z.string().max(40).describe("id del rubro, de ver_perfil_de_precios (housing, food, health…)."),
          itemId: z.string().max(60).optional().describe("id del renglón del rubro. Si el gasto no tiene renglón, omitilo y mandá `etiqueta`."),
          etiqueta: z.string().min(1).max(60).optional().describe("Nombre de un renglón propio, sólo si no existe en el rubro."),
          monto: montoMes,
        }),
      )
      .max(60)
      .optional()
      .describe("Gastos personales del mes, uno por renglón."),
    negocio: z
      .object({
        alquiler: montoMes.optional().describe("Alquiler del estudio u oficina ('0' si no tiene)."),
        software: montoMes.optional(),
        publicidad: montoMes.optional(),
        colaboradores: entero.optional().describe("Cantidad de empleados o colaboradores fijos ('0' si trabaja sola/o)."),
        costoColaboradores: montoMes.optional().describe("Costo mensual total de esos colaboradores."),
      })
      .optional(),
    equipo: z
      .object({
        renovacionMensual: montoMes
          .optional()
          .describe("Inversión mensual en equipo: lo que aparta por mes para tarjetas, baterías, lentes y otros equipos. NO es el desgaste de la cámara."),
        camara: z.string().max(80).optional().describe("Marca y modelo de la cámara principal."),
        vidaUtilObturador: entero.optional().describe("Vida útil del obturador de la cámara, en disparos."),
        disparosActuales: entero.optional().describe("Disparos que ya tiene la cámara."),
        valorReposicion: monto.optional().describe("Lo que cuesta hoy reemplazar la cámara."),
        disparosAnuales: entero.optional().describe("Disparos por AÑO sumando todos los trabajos. Los de un trabajo puntual no van acá: van al cotizar ese trabajo."),
      })
      .optional(),
    horasSemana: z.string().regex(/^\d{1,3}$/).optional().describe("Horas de trabajo por semana en total."),
    distribucion: z
      .object({
        unidad: z.enum(["horas", "porcentaje"]).describe("Cómo lo dijo la persona: horas por semana de cada tarea, o porcentajes."),
        coberturas: horasOPct.optional(),
        edicion: horasOPct.optional(),
        administracion: horasOPct.optional(),
        ventas: horasOPct.optional(),
        publicidad: horasOPct.optional(),
        capacitacion: horasOPct.optional(),
      })
      .optional()
      .describe("En qué se van las horas de la semana. Mandá las seis tareas; las que la persona no nombre van en 0."),
    fondoEmergencia: montoMes.optional(),
    ahorro: montoMes.optional().describe("Ahorro y vacaciones por mes."),
    cobros: esquemaCobros.optional(),
    estudio: esquemaEstudio.optional(),
    camaras: esquemaCamaras.optional(),
    posicionamiento: z.enum(POSICIONAMIENTOS).optional().describe(
      `Momento del negocio: ${COMMERCIAL_POSITIONING_OPTIONS.map((o) => `${o.id} = «${o.title}»`).join(", ")}.`,
    ),
  })
  .describe("Sólo los datos que dijo la persona en esta conversación. Lo que no dijo, no lo mandes.");

export type ParchePerfil = z.infer<typeof esquemaParchePerfil>;

// ── Aplicar el parche ──────────────────────────────────────────────────────────────────────────

const TAREAS: Record<keyof NonNullable<ParchePerfil["distribucion"]> & string, ClaveDistribucion | null> = {
  unidad: null,
  coberturas: "coverage",
  edicion: "editing",
  administracion: "administration",
  ventas: "sales",
  publicidad: "marketing",
  capacitacion: "training",
};

const ETIQUETA_TAREA: Record<ClaveDistribucion, string> = {
  coverage: "Coberturas",
  editing: "Edición",
  administration: "Administración",
  sales: "Ventas",
  marketing: "Publicidad",
  training: "Capacitación",
};

const NOMBRE_TAREA: Record<ClaveDistribucion, keyof ReturnType<typeof distribucionVacia>> = {
  coverage: "coberturas",
  editing: "edicion",
  administration: "administracion",
  sales: "ventas",
  marketing: "publicidad",
  training: "capacitacion",
};

function distribucionVacia() {
  return { coberturas: 0, edicion: 0, administracion: 0, ventas: 0, publicidad: 0, capacitacion: 0 };
}

const numero = (v: string | undefined) => Number(String(v ?? "0").replace(",", "."));

function idPropio(etiqueta: string): string {
  const slug = etiqueta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `dnxbot-${slug || "gasto"}`;
}

/** El perfil guardado normalizado, o el inicial (pesos, rubros por omisión) si no hay. */
export function perfilBase(guardado: CuantoCobroProfileInput | null): CuantoCobroProfileInput {
  return normalizarPerfil(guardado ?? {})!;
}

const CONTRATACION: Record<string, Exclude<StudioEmploymentType, "">> = {
  dependencia: "employee",
  informal: "informal",
  monotributo: "monotributista",
  jornal: "daily",
  por_trabajo: "per-job",
};

const igual = (a: string, b: string) =>
  a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es") === b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");

/** Opciones de `aplicarParche`. `permitirEstudio`: el workspace es de tipo estudio (lo decide la herramienta). */
export type OpcionesParche = { permitirEstudio?: boolean };

export function aplicarParche(
  base: CuantoCobroProfileInput,
  parche: ParchePerfil,
  opciones: OpcionesParche = {},
): { perfil: CuantoCobroProfileInput; errores: string[]; conversiones: Conversion[] } {
  const errores: string[] = [];
  const conversiones: Conversion[] = [];
  const p: CuantoCobroProfileInput = structuredClone(normalizarPerfil(base)!);
  const moneda = parche.moneda || p.currency || "ARS";
  /** El monto mensual (texto de dígitos); si vino con período, lo convierte y anota la cuenta. undefined = error. */
  const mes = (v: MontoMes, etiqueta: string): string | undefined => {
    if (typeof v === "string") return v;
    const r = aMensual(Number(v.monto), v.periodo, v.meses === undefined ? undefined : Number(v.meses));
    if (!r.ok) {
      errores.push(`${etiqueta}: ${r.error}`);
      return undefined;
    }
    if (v.periodo !== "mensual") {
      const como = v.periodo === "unica_vez" ? `por única vez, repartido en ${Number(v.meses)} meses` : FRASE[v.periodo];
      conversiones.push({
        etiqueta,
        detalle: `${formatCuantoCobroCurrency(Number(v.monto), moneda)} ${como} = ${formatCuantoCobroCurrency(r.mensual, moneda)} por mes`,
      });
    }
    return String(r.mensual);
  };
  /** Asigna el mensual al campo sólo si se pudo calcular. */
  const poner = (v: MontoMes | undefined, etiqueta: string, set: (s: string) => void) => {
    if (v === undefined) return;
    const m = mes(v, etiqueta);
    if (m !== undefined) set(m);
  };

  if (parche.moneda) p.currency = parche.moneda;
  if (parche.viveSoloDeFotografia) p.livesOnlyFromPhotography = parche.viveSoloDeFotografia === "si" ? "yes" : "no";
  poner(parche.ingresosExternos, "Ingresos externos", (v) => (p.externalMonthlyIncome = v));

  for (const g of parche.gastosPersonales ?? []) {
    const grupo = p.personalExpenseGroups.find((x) => x.id === g.grupoId);
    if (!grupo) {
      errores.push(`No existe el rubro «${g.grupoId}»: usá uno de ver_perfil_de_precios.`);
      continue;
    }
    if (g.itemId) {
      const item = grupo.items.find((i) => i.id === g.itemId);
      if (!item) {
        errores.push(`El rubro «${grupo.title}» no tiene el renglón «${g.itemId}»: usá uno de la lista o mandá una etiqueta propia.`);
        continue;
      }
      poner(g.monto, item.label, (v) => (item.amount = v));
      continue;
    }
    if (!g.etiqueta) {
      errores.push(`Falta el renglón del gasto de «${grupo.title}».`);
      continue;
    }
    const etiqueta = g.etiqueta.trim();
    const existente = grupo.items.find((i) => i.label.trim().toLocaleLowerCase("es") === etiqueta.toLocaleLowerCase("es"));
    const m = mes(g.monto, existente?.label ?? etiqueta);
    if (m === undefined) continue;
    if (existente) existente.amount = m;
    else grupo.items.push({ id: idPropio(etiqueta), label: etiqueta, amount: m, isCustom: true });
  }

  const n = parche.negocio;
  if (estudioEncendido(p) && (n?.colaboradores !== undefined || n?.costoColaboradores !== undefined) && !parche.estudio) {
    errores.push("Con «Mi estudio» encendido, cada persona va en el equipo (estudio.personas), no como colaboradores.");
  }
  poner(n?.alquiler, "Alquiler o estudio", (v) => (p.businessRent = v));
  poner(n?.software, "Software", (v) => (p.businessSoftware = v));
  poner(n?.publicidad, "Publicidad", (v) => (p.businessMarketing = v));
  if (n?.colaboradores !== undefined) p.employeesCount = n.colaboradores;
  poner(n?.costoColaboradores, "Costo de colaboradores", (v) => (p.employeeMonthlyCost = v));

  const e = parche.equipo;
  poner(e?.renovacionMensual, "Inversión mensual en equipo", (v) => (p.equipmentRenewalMonthly = v));
  if (e?.camara !== undefined) p.primaryCameraCustomName = e.camara;
  if (e?.vidaUtilObturador !== undefined) p.primaryCameraShutterRating = e.vidaUtilObturador;
  if (e?.disparosActuales !== undefined) p.primaryCameraCurrentShutterCount = e.disparosActuales;
  if (e?.valorReposicion !== undefined) p.primaryCameraReplacementValue = e.valorReposicion;
  if (e?.disparosAnuales !== undefined) p.estimatedAnnualShots = e.disparosAnuales;

  if (parche.horasSemana !== undefined) p.weeklyHours = parche.horasSemana;

  const d = parche.distribucion;
  if (d) {
    const valores: Partial<Record<ClaveDistribucion, string>> = {};
    for (const [k, clave] of Object.entries(TAREAS)) {
      if (clave) valores[clave] = (d as Record<string, string | undefined>)[k] ?? "0";
    }
    if (d.unidad === "porcentaje") {
      p.timeDistribution = {
        coverage: valores.coverage!,
        editing: valores.editing!,
        administration: valores.administration!,
        sales: valores.sales!,
        marketing: valores.marketing!,
        training: valores.training!,
      };
    } else {
      const semanal = parseCuantoCobroAmount(p.weeklyHours) ?? 0;
      const horas = Object.fromEntries(CLAVES_DISTRIBUCION.map((k) => [k, numero(valores[k])])) as Record<ClaveDistribucion, number>;
      const dist = distribucionDesdeHoras(horas, semanal);
      if (!dist) {
        errores.push("Para repartir las horas por tarea necesito primero tus horas por semana.");
      } else {
        const suma = CLAVES_DISTRIBUCION.reduce((s, k) => s + horas[k], 0);
        if (suma !== semanal) {
          const dif = semanal - suma;
          errores.push(
            `Las horas por tarea suman ${suma} y tus horas por semana son ${semanal}: ${dif > 0 ? `faltan repartir ${dif}` : `sobran ${-dif}`}.`,
          );
        }
        p.timeDistribution = dist;
      }
    }
  }

  poner(parche.fondoEmergencia, "Fondo de emergencia", (v) => (p.emergencyFundMonthly = v));
  poner(parche.ahorro, "Ahorro y vacaciones", (v) => (p.savingsGoalsMonthly = v));
  if (parche.posicionamiento) p.commercialPositioningId = parche.posicionamiento;

  const c = parche.cobros;
  if (c) {
    const x: CuantoCobroPricingExtras = extrasDelPerfil(p);
    const porc = (v: string | undefined, etiqueta: string, set: (s: string) => void) => {
      if (v === undefined) return;
      if (!porcentajeValido(v)) errores.push(`${etiqueta}: tiene que ser un porcentaje entre 0 y 100.`);
      else set(v);
    };
    poner(c.monotributo, "Monotributo", (v) => (x.monotributoMonthly = v));
    if (c.seguroEquipoAnual !== undefined) x.equipmentInsuranceAnnual = c.seguroEquipoAnual;
    if (c.condicionIva) x.ivaCondition = c.condicionIva;
    porc(c.iva, "IVA", (v) => (x.ivaPercent = v));
    porc(c.ingresosBrutos, "Ingresos Brutos", (v) => (x.grossIncomePercent = v));
    porc(c.comisionMedioDePago, "Comisión del medio de pago", (v) => (x.paymentCommissionPercent = v));
    if (c.sumarComisionAlPrecio !== undefined) x.includeCommissionInPrice = c.sumarComisionAlPrecio;
    porc(c.sena, "Seña", (v) => (x.depositPercent = v));
    porc(c.recargoHoraExtra, "Recargo de la hora extra", (v) => (x.overtimeSurchargePercent = v));
    porc(c.recargoSabado, "Recargo de sábado", (v) => (x.saturdaySurchargePercent = v));
    porc(c.recargoDomingo, "Recargo de domingo", (v) => (x.sundaySurchargePercent = v));
    porc(c.recargoFeriado, "Recargo de feriado", (v) => (x.holidaySurchargePercent = v));
    porc(c.recargoExpres, "Recargo por entrega exprés", (v) => (x.expressSurchargePercent = v));
    if (c.diasDeEntrega !== undefined) x.standardDeliveryDays = c.diasDeEntrega;
    if (c.viaticos) x.travelMode = c.viaticos === "por_km" ? "per_km" : c.viaticos === "por_zonas" ? "zones" : "";
    if (c.valorKm !== undefined) x.travelPerKm = c.valorKm;
    if (c.kmSinCargo !== undefined) x.travelFreeKm = c.kmSinCargo;
    if (c.zonas) x.travelZones = c.zonas.map((z, i) => ({ id: `zona-${i + 1}`, name: z.nombre.trim(), upToKm: z.hastaKm, amount: z.monto }));
    if (c.minutosRetoquePorFoto !== undefined) x.retouchMinutesPerPhoto = c.minutosRetoquePorFoto;
    porc(c.inflacionMensual, "Inflación mensual", (v) => {
      x.inflationMonthlyPercent = v;
      x.inflationEnabled = porcentajePositivo(v);
    });
    if (c.precioMinimo !== undefined) x.minimumJobPrice = c.precioMinimo;
    if (c.politicaCancelacion !== undefined) x.cancellationPolicy = c.politicaCancelacion.trim();
    p.pricingExtras = x;
  }

  const est = parche.estudio;
  if (est) {
    const yaActivo = estudioEncendido(p);
    if (est.activar === false) {
      if (p.studioStructure) p.studioStructure = { ...p.studioStructure, enabled: false };
    } else if (!yaActivo && !opciones.permitirEstudio) {
      errores.push("«Mi estudio» es para estudios con equipo: este workspace no es de tipo estudio. Se cambia en Configuración → Módulos.");
    } else {
      const e: CuantoCobroStudioStructure = yaActivo ? structuredClone(p.studioStructure!) : encenderMiEstudio(p);
      for (const g of est.gastosFijos ?? []) {
        const grupo = e.fixedCostGroups.find((x) => x.id === g.rubroId);
        if (!grupo) {
          errores.push(`No existe el rubro de gastos fijos «${g.rubroId}»: usá uno de ver_perfil_de_precios.`);
          continue;
        }
        const item = g.renglonId ? grupo.items.find((i) => i.id === g.renglonId) : grupo.items.find((i) => g.etiqueta && igual(i.label, g.etiqueta));
        if (g.renglonId && !item) {
          errores.push(`El rubro «${grupo.title}» no tiene el renglón «${g.renglonId}».`);
          continue;
        }
        if (!item && !g.etiqueta) {
          errores.push(`Falta el renglón del gasto fijo de «${grupo.title}».`);
          continue;
        }
        const m = mes(g.monto, item?.label ?? g.etiqueta!);
        if (m === undefined) continue;
        const scope = g.de ? ALCANCE_DEL_GASTO[g.de] : undefined;
        if (item) {
          item.amount = m;
          if (scope) item.scope = scope;
        } else grupo.items.push({ id: idPropio(g.etiqueta!), label: g.etiqueta!.trim(), amount: m, isCustom: true, ...(scope ? { scope } : {}) });
      }
      poner(est.retiro, "Tu retiro", (v) => (e.ownerDrawMonthly = v));
      poner(est.otrasLineas, "Lo que dejan otras líneas", (v) => (e.otherLinesMonthlyContribution = v));
      if (est.ganancia?.monto !== undefined) {
        poner(est.ganancia.monto, "Ganancia del estudio", (v) => {
          e.desiredProfitMonthly = v;
          e.desiredProfitMode = "amount";
        });
      } else if (est.ganancia?.porcentaje !== undefined) {
        if (!porcentajeValido(est.ganancia.porcentaje)) errores.push("Ganancia del estudio: tiene que ser un porcentaje entre 0 y 100.");
        else {
          e.desiredProfitPercent = est.ganancia.porcentaje;
          e.desiredProfitMode = "percent";
        }
      }
      const owner = e.people.find((x) => x.role === "owner");
      if (owner && est.tuJornada) {
        const j = est.tuJornada;
        if (j.dias !== undefined) owner.workdaysPerWeek = j.dias;
        if (j.horasDia !== undefined) owner.hoursPerWorkday = j.horasDia;
        if (j.vacaciones !== undefined) owner.vacationWeeksPerYear = j.vacaciones;
        if (j.vendible !== undefined) owner.billablePercent = j.vendible;
      }
      for (const q of est.personas ?? []) {
        let persona: StudioPerson | undefined = e.people.find((x) => x.role !== "owner" && igual(x.name, q.nombre));
        if (q.quitar) {
          if (persona) e.people = e.people.filter((x) => x !== persona);
          continue;
        }
        if (!persona) {
          if (e.people.length >= MAX_PERSONAS_DEL_ESTUDIO) {
            errores.push("El equipo ya tiene el máximo de personas.");
            continue;
          }
          persona = nuevaPersonaDelEstudio({ id: idPropio(q.nombre).replace("dnxbot-", "sp-"), name: q.nombre.trim() });
          e.people.push(persona);
        }
        const x = persona;
        if (q.contratacion) {
          x.employmentType = CONTRATACION[q.contratacion]!;
          if (x.employmentType === "informal") {
            x.includeSac = true;
            x.paidVacations = true;
            x.socialChargesPercent = "";
          }
        }
        if (q.sueldo !== undefined) x.monthlySalary = q.sueldo;
        if (q.cargas !== undefined) x.socialChargesPercent = q.cargas;
        if (q.aguinaldo !== undefined) x.includeSac = q.aguinaldo;
        if (q.vacacionesPagas !== undefined) x.paidVacations = q.vacacionesPagas;
        if (q.jornal !== undefined) x.dailyRate = q.jornal;
        if (q.tarifaPorTrabajo !== undefined) x.perJobRate = q.tarifaPorTrabajo;
        if (q.unidadPorTrabajo) x.perJobUnit = q.unidadPorTrabajo === "hora" ? "hour" : "job";
        if (q.dias !== undefined) x.workdaysPerWeek = q.dias;
        if (q.horasDia !== undefined) x.hoursPerWorkday = q.horasDia;
        if (q.vacaciones !== undefined) x.vacationWeeksPerYear = q.vacaciones;
        if (q.vendible !== undefined) x.billablePercent = q.vendible;
        if (q.activa !== undefined) x.active = q.activa;
        if (q.de) x.scope = q.de === "coberturas" ? "coverage" : "local";
        poner(q.insumos, `Insumos de ${x.name}`, (v) => (x.monthlySupplies = v));
      }
      if (est.separarLocal === false) e.separateLocal = false;
      else if (est.separarLocal === true || e.separateLocal === true) Object.assign(e, separarLocal(e));
      if (e.separateLocal === true) {
        poner(est.sueldoDelLocal, "Lo que te paga el local", (v) => (e.ownerLocalSalaryMonthly = v));
        poner(est.localEstimado, "Lo que deja el local", (v) => (e.localMonthlyContributionManual = v));
        const pct = (v: string | undefined, etiqueta: string, set: (s: string) => void) => {
          if (v === undefined) return;
          if (!porcentajeValido(v)) errores.push(`${etiqueta}: tiene que ser un porcentaje entre 0 y 100.`);
          else set(v);
        };
        pct(est.tiempoEnElLocal, "Tu tiempo en el local", (v) => (e.ownerLocalTimePercent = v));
        pct(est.compartidoCoberturas, "Lo compartido que llevan las coberturas", (v) => (e.coverageSharePercent = v));
        pct(est.costoMercaderia, "El costo de la mercadería", (v) => (e.localGoodsCostPercent = v));
      } else if (est.sueldoDelLocal !== undefined || est.tiempoEnElLocal !== undefined || est.compartidoCoberturas !== undefined || est.costoMercaderia !== undefined || est.localEstimado !== undefined) {
        errores.push("Para cargar lo del local primero hay que separar el local de las coberturas (separarLocal: true).");
      }
      p.studioStructure = e;
    }
  }

  if (parche.camaras) {
    let camaras = normalizarCamaras(p.cameras);
    for (const c of parche.camaras) {
      const existente = camaras.find((x) => igual(x.name, c.nombre));
      if (c.quitar) {
        camaras = camaras.filter((x) => x !== existente);
        continue;
      }
      const cam = existente ?? nuevaCamara({ id: idPropio(c.nombre).replace("dnxbot-", "cam-"), name: c.nombre.trim(), presetId: "custom" });
      if (c.valorReposicion !== undefined) cam.replacementValue = c.valorReposicion;
      if (c.vidaUtil !== undefined) cam.shutterRating = c.vidaUtil;
      if (c.disparosActuales !== undefined) cam.currentShutterCount = c.disparosActuales;
      if (!existente) {
        if (camaras.length >= MAX_CAMARAS_ADICIONALES) errores.push("Ya hay el máximo de cámaras adicionales.");
        else camaras.push(cam);
      }
    }
    if (camaras.length > 0) p.cameras = camaras;
    else delete p.cameras;
  }

  return { perfil: p, errores, conversiones };
}

// ── Lo que ve el modelo (y la tarjeta) ─────────────────────────────────────────────────────────

export type Origen = "manual" | "clf-import" | "dnx-bot" | null;

function plata(valor: number | null, moneda: string): string | null {
  return valor === null ? null : formatCuantoCobroCurrency(valor, moneda);
}

function plataDe(texto: string, moneda: string): string | null {
  return plata(parseCuantoCobroAmount(texto ?? ""), moneda);
}

export function vistaDelPerfil(perfil: CuantoCobroProfileInput, source: string | null) {
  const r = resumirPerfil(perfil);
  const m = perfil.currency || "ARS";
  const horas = horasPorTarea(perfil);
  const distribucionHoras = distribucionVacia();
  for (const k of CLAVES_DISTRIBUCION) distribucionHoras[NOMBRE_TAREA[k]] = horas[k];
  const origen: Origen = source === "manual" || source === "clf-import" || source === "dnx-bot" ? source : null;
  return {
    origen,
    completo: r.completo,
    faltan: r.faltan,
    estudio: vistaDelEstudio(perfil),
    resumen: {
      valorHora: r.completo ? plata(r.valorHora, m) : null,
      costoHora: r.completo ? plata(r.costoHora, m) : null,
      necesidadMensual: plata(r.necesidadMensual, m),
      horasFacturablesMes: `${Math.round(r.horasFacturablesMes)} h`,
      gastosPersonales: plata(r.gastosPersonales, m),
      gastosNegocio: plata(r.gastosNegocio, m),
      reservas: plata(r.reservas, m),
    },
    datos: {
      moneda: m,
      viveSoloDeFotografia: perfil.livesOnlyFromPhotography === "yes" ? "si" : perfil.livesOnlyFromPhotography === "no" ? "no" : null,
      ingresosExternos: plataDe(perfil.externalMonthlyIncome, m),
      negocio: {
        alquiler: plataDe(perfil.businessRent, m),
        software: plataDe(perfil.businessSoftware, m),
        publicidad: plataDe(perfil.businessMarketing, m),
        colaboradores: perfil.employeesCount || null,
        costoColaboradores: plataDe(perfil.employeeMonthlyCost, m),
      },
      equipo: {
        renovacionMensual: plataDe(perfil.equipmentRenewalMonthly, m),
        camara: perfil.primaryCameraCustomName || null,
        valorReposicion: plataDe(perfil.primaryCameraReplacementValue, m),
      },
      horasSemana: perfil.weeklyHours || null,
      distribucionHoras,
      fondoEmergencia: plataDe(perfil.emergencyFundMonthly, m),
      ahorro: plataDe(perfil.savingsGoalsMonthly, m),
      posicionamiento: perfil.commercialPositioningId || null,
      camarasAdicionales: normalizarCamaras(perfil.cameras).map((c) => ({
        nombre: c.name,
        valorReposicion: plataDe(c.replacementValue, m),
        vidaUtil: c.shutterRating || null,
      })),
      gastosPersonalesPorGrupo: perfil.personalExpenseGroups.map((g) => ({
        grupoId: g.id,
        titulo: g.title,
        total: plata(g.items.reduce((s, i) => s + (parseCuantoCobroAmount(i.amount) ?? 0), 0), m),
        renglones: g.items.map((i) => ({ itemId: i.id, etiqueta: i.label, monto: plataDe(i.amount, m) })),
      })),
    },
  };
}

export type VistaPerfil = ReturnType<typeof vistaDelPerfil>;

const TEXTO_CONTRATACION: Record<string, string> = {
  employee: "dependencia",
  informal: "informal (aguinaldo y vacaciones pagas)",
  monotributista: "monotributo",
  daily: "jornal",
  "per-job": "por trabajo",
};

/** Mi estudio, como lo ve el modelo: cifras del motor ya formateadas (nunca para que las calcule). null sin el modo. */
export function vistaDelEstudio(perfil: CuantoCobroProfileInput) {
  const d = desgloseDelEstudio(perfil);
  const e = perfil.studioStructure;
  if (!d || !e) return null;
  const m = perfil.currency || "ARS";
  return {
    valorHoraDelEstudio: plata(d.studioHourRate, m),
    necesidadMensual: plata(d.monthlyNeed, m),
    horasQueSeCobranPorMes: `${Math.round(d.capacityHours)} h`,
    gastosFijos: plata(d.fixedCosts, m),
    equipo: plata(d.teamCost, m),
    reservas: plata(d.reserves, m),
    retiro: plata(d.ownerDraw, m),
    otrasLineas: plata(d.otherLinesContribution, m),
    ganancia: plata(d.profit, m),
    gananciaComo: e.desiredProfitMode === "percent" ? "porcentaje" : "monto fijo",
    personas: d.people.map((x) => {
      const p = e.people.find((y) => y.id === x.id);
      return {
        nombre: x.name || (x.role === "owner" ? "Dueño" : "Sin nombre"),
        esDueno: x.role === "owner",
        contratacion: x.role === "owner" ? "dueño (retiro)" : (TEXTO_CONTRATACION[x.employmentType] ?? "sin elegir"),
        jornada: p ? `${p.workdaysPerWeek || "?"} días × ${p.hoursPerWorkday || "?"} h` : null,
        costoPorMes: x.inStructure ? plata(x.monthlyCost, m) : null,
        horasQueCobraPorMes: x.inStructure ? `${Math.round(x.billableHours)} h` : null,
        valorDeSuHora: plata(x.rate, m),
        activa: p?.active ?? true,
      };
    }),
    gastosFijosPorRubro: e.fixedCostGroups.map((g) => ({
      rubroId: g.id,
      titulo: g.title,
      renglones: g.items.map((i) => ({ renglonId: i.id, etiqueta: i.label, monto: plataDe(i.amount, m) })),
    })),
    ...(d.separated
      ? {
          localSeparado: {
            gastosPersonales: plata(d.separated.personalNeed, m),
            loQueTePagaElLocal: plata(d.separated.localSalary, m),
            loQueNecesitasLlevarte: plata(d.separated.ownerNetNeed, m),
            gastosCompartidosQueLlevanLasCoberturas: plata(d.separated.sharedToCoverage, m),
            gastosSoloDeCoberturas: plata(d.separated.coverageFixed, m),
            equipoDeCoberturas: plata(d.separated.coverageTeamCost, m),
          },
        }
      : {}),
    avisos: d.warnings,
  };
}

export type Simulacion = { perfil: CuantoCobroProfileInput; errores: string[]; vista: VistaPerfil; conversiones: Conversion[] };

/** El perfil con el parche aplicado, SIN guardar, con los errores del formulario y su resumen. */
export function simularPerfil(
  base: CuantoCobroProfileInput,
  parche: ParchePerfil,
  source: string | null = null,
  opciones: OpcionesParche = {},
): Simulacion {
  const { perfil, errores, conversiones } = aplicarParche(base, parche, opciones);
  const v = validarPerfil(perfil);
  const propios = [...errores];
  // Si ya se explicó cuánto falta repartir, el error genérico de la distribución sobra.
  const yaDijoDistribucion = errores.some((e) => e.startsWith("Las horas por tarea"));
  if (!v.ok && !(yaDijoDistribucion && v.error.startsWith("La distribución del tiempo"))) propios.push(v.error);
  return { perfil, errores: propios, vista: vistaDelPerfil(perfil, source), conversiones };
}

// ── Tarjeta «cálculo» (la pinta la burbuja con estos datos, nunca con el texto del modelo) ─────

export type TarjetaCalculo = { titulo: string; filas: { etiqueta: string; valor: string }[]; avisos: string[] };

export function tarjetaDelPerfil(s: Simulacion): TarjetaCalculo {
  const r = s.vista.resumen;
  const falta = "Falta completar";
  const est = s.vista.estudio;
  if (est) {
    return {
      titulo: "Mi estudio",
      filas: [
        { etiqueta: "Valor hora del estudio", valor: s.vista.completo ? (est.valorHoraDelEstudio ?? falta) : falta },
        { etiqueta: "Lo que tienen que cubrir las horas", valor: est.necesidadMensual ?? falta },
        { etiqueta: "Horas que se cobran por mes", valor: est.horasQueSeCobranPorMes },
        { etiqueta: "Gastos fijos del estudio", valor: est.gastosFijos ?? "$ 0" },
        { etiqueta: "Equipo", valor: est.equipo ?? "$ 0" },
        { etiqueta: est.localSeparado ? "Lo que necesitás llevarte de las coberturas" : "Tu retiro", valor: (est.localSeparado?.loQueNecesitasLlevarte ?? est.retiro) ?? "$ 0" },
        { etiqueta: "Ganancia del estudio", valor: est.ganancia ?? "$ 0" },
        ...est.personas
          .filter((x) => x.valorDeSuHora)
          .map((x) => ({ etiqueta: `Hora de ${x.nombre}`, valor: x.valorDeSuHora! })),
        ...s.conversiones.map((c) => ({ etiqueta: c.etiqueta, valor: c.detalle })),
      ],
      avisos: [...s.errores, ...est.avisos, ...(s.vista.faltan.length ? [`Falta: ${s.vista.faltan.join(", ")}.`] : [])],
    };
  }
  return {
    titulo: "Tu perfil de precios",
    filas: [
      { etiqueta: "Valor hora", valor: r.valorHora ?? falta },
      { etiqueta: "Costo hora", valor: r.costoHora ?? falta },
      { etiqueta: "Necesitás por mes", valor: r.necesidadMensual ?? falta },
      { etiqueta: "Horas que se cobran por mes", valor: r.horasFacturablesMes },
      { etiqueta: "Gastos personales", valor: r.gastosPersonales ?? "$ 0" },
      { etiqueta: "Gastos del negocio", valor: r.gastosNegocio ?? "$ 0" },
      // Cada monto que se dijo por otro período, con la cuenta hecha por el servidor.
      ...s.conversiones.map((c) => ({ etiqueta: c.etiqueta, valor: c.detalle })),
    ],
    avisos: [...s.errores, ...(s.vista.faltan.length ? [`Falta: ${s.vista.faltan.join(", ")}.`] : [])],
  };
}

// ── Qué cambia al guardar (para la tarjeta «¿Lo hago?») ────────────────────────────────────────

type Campo = { clave: string; etiqueta: string; valor: string };

function camposPlanos(p: CuantoCobroProfileInput): Campo[] {
  const m = p.currency || "ARS";
  const $ = (t: string) => plataDe(t, m) ?? "sin dato";
  const texto = (t: string) => (t?.trim() ? t.trim() : "sin dato");
  const horas = horasPorTarea(p);
  const pos = COMMERCIAL_POSITIONING_OPTIONS.find((o) => o.id === p.commercialPositioningId)?.title;
  return [
    { clave: "moneda", etiqueta: "Moneda", valor: texto(p.currency) },
    { clave: "vive", etiqueta: "Vive sólo de la fotografía", valor: p.livesOnlyFromPhotography === "yes" ? "sí" : p.livesOnlyFromPhotography === "no" ? "no" : "sin dato" },
    { clave: "externos", etiqueta: "Ingresos externos", valor: $(p.externalMonthlyIncome) },
    ...p.personalExpenseGroups.flatMap((g) =>
      g.items.map((i) => ({ clave: `gasto:${g.id}:${i.id}`, etiqueta: `${g.title} · ${i.label}`, valor: $(i.amount) })),
    ),
    { clave: "alquiler", etiqueta: "Alquiler o estudio", valor: $(p.businessRent) },
    { clave: "software", etiqueta: "Software", valor: $(p.businessSoftware) },
    { clave: "publicidad", etiqueta: "Publicidad", valor: $(p.businessMarketing) },
    { clave: "colaboradores", etiqueta: "Colaboradores", valor: texto(p.employeesCount) },
    { clave: "costoColaboradores", etiqueta: "Costo mensual del equipo", valor: $(p.employeeMonthlyCost) },
    { clave: "renovacion", etiqueta: "Inversión mensual en equipo", valor: $(p.equipmentRenewalMonthly) },
    { clave: "camara", etiqueta: "Cámara principal", valor: texto(p.primaryCameraCustomName) },
    { clave: "obturador", etiqueta: "Vida útil del obturador", valor: texto(p.primaryCameraShutterRating) },
    { clave: "disparos", etiqueta: "Disparos actuales de la cámara", valor: texto(p.primaryCameraCurrentShutterCount) },
    { clave: "reposicion", etiqueta: "Valor de reposición de la cámara", valor: $(p.primaryCameraReplacementValue) },
    { clave: "anuales", etiqueta: "Disparos por año (todos los trabajos)", valor: texto(p.estimatedAnnualShots) },
    { clave: "horasSemana", etiqueta: "Horas por semana", valor: texto(p.weeklyHours) },
    ...CLAVES_DISTRIBUCION.map((k) => ({ clave: `tarea:${k}`, etiqueta: `${ETIQUETA_TAREA[k]} (horas por semana)`, valor: String(horas[k]) })),
    { clave: "fondo", etiqueta: "Fondo de emergencia", valor: $(p.emergencyFundMonthly) },
    { clave: "ahorro", etiqueta: "Ahorro y vacaciones", valor: $(p.savingsGoalsMonthly) },
    { clave: "posicionamiento", etiqueta: "Momento del negocio", valor: pos ?? "sin dato" },
    ...camposDeCobros(p.pricingExtras, $),
    ...camposDelEstudio(p, $),
    ...normalizarCamaras(p.cameras).map((c) => ({
      clave: `cam:${c.id}`,
      etiqueta: `Cámara «${c.name}»`,
      valor: `${$(c.replacementValue)}, ${texto(c.shutterRating)} disparos de vida útil`,
    })),
  ];
}

/** Mi estudio en la tarjeta «¿Lo hago?»: un perfil sin el bloque no suma campos. */
function camposDelEstudio(p: CuantoCobroProfileInput, $: (t: string) => string): Campo[] {
  const e = p.studioStructure;
  if (!e) return [];
  const texto = (t: string) => (t?.trim() ? t.trim() : "sin dato");
  const separado = localSeparadoActivo(p);
  return [
    { clave: "e:modo", etiqueta: "Mi estudio", valor: e.enabled ? "encendido" : "apagado" },
    ...(separado
      ? [
          { clave: "e:sueldoLocal", etiqueta: "Lo que te paga el local", valor: $(e.ownerLocalSalaryMonthly ?? "") },
          { clave: "e:tiempoLocal", etiqueta: "Tu tiempo en el local", valor: e.ownerLocalTimePercent?.trim() ? `${e.ownerLocalTimePercent} %` : "sin dato" },
          { clave: "e:compartido", etiqueta: "Gastos compartidos que llevan las coberturas", valor: e.coverageSharePercent?.trim() ? `${e.coverageSharePercent} %` : "sin dato" },
          { clave: "e:mercaderia", etiqueta: "Costo de la mercadería del local", valor: e.localGoodsCostPercent?.trim() ? `${e.localGoodsCostPercent} %` : "sin dato" },
          { clave: "e:localEstimado", etiqueta: "Lo que deja el local (a mano)", valor: $(e.localMonthlyContributionManual ?? "") },
        ]
      : [
          { clave: "e:retiro", etiqueta: "Tu retiro", valor: $(e.ownerDrawMonthly) },
          { clave: "e:otras", etiqueta: "Lo que dejan otras líneas", valor: $(e.otherLinesMonthlyContribution) },
        ]),
    { clave: "e:separado", etiqueta: "Local y coberturas por separado", valor: separado ? "sí" : "no" },
    {
      clave: "e:ganancia",
      etiqueta: "Ganancia del estudio",
      valor: e.desiredProfitMode === "percent" ? (e.desiredProfitPercent.trim() ? `${e.desiredProfitPercent} %` : "sin dato") : $(e.desiredProfitMonthly),
    },
    ...e.fixedCostGroups.flatMap((g) =>
      g.items.map((i) => ({
        clave: `e:fijo:${g.id}:${i.id}`,
        etiqueta: `${g.title} · ${i.label}`,
        valor: separado && i.scope ? `${$(i.amount)} (${TEXTO_ALCANCE[i.scope]})` : $(i.amount),
      })),
    ),
    ...e.people.map((x) => ({
      clave: `e:persona:${x.id}`,
      etiqueta: x.role === "owner" ? "Tu jornada" : `Equipo · ${x.name || "sin nombre"}`,
      valor: [
        x.role === "owner" ? null : TEXTO_CONTRATACION[x.employmentType] ?? "sin contratación",
        x.monthlySalary.trim() ? $(x.monthlySalary) : null,
        x.employmentType === "employee" && x.socialChargesPercent.trim() ? `cargas ${x.socialChargesPercent} %` : null,
        `${texto(x.workdaysPerWeek)} días × ${texto(x.hoursPerWorkday)} h`,
        x.billablePercent.trim() ? `${x.billablePercent} % vendible` : null,
        separado && x.role !== "owner" && x.scope ? TEXTO_ALCANCE[x.scope] : null,
        x.active ? null : "inactiva",
      ]
        .filter(Boolean)
        .join(", "),
    })),
  ];
}

const TEXTO_ALCANCE = { local: "del local", coverage: "de coberturas", shared: "compartido" } as const;

const IVA_TEXTO: Record<string, string> = { monotributo: "monotributo", responsable_inscripto: "responsable inscripto", exento: "exento" };

/** Los datos de impuestos, cobros y recargos; un perfil sin el bloque no suma campos (sin cambios falsos). */
function camposDeCobros(e: CuantoCobroPricingExtras | undefined, $: (t: string) => string): Campo[] {
  if (!e) return [];
  const pc = (t: string) => (t?.trim() ? `${t.trim()} %` : "sin dato");
  const texto = (t: string) => (t?.trim() ? t.trim() : "sin dato");
  return [
    { clave: "c:monotributo", etiqueta: "Monotributo (por mes)", valor: $(e.monotributoMonthly) },
    { clave: "c:seguro", etiqueta: "Seguro del equipo (por año)", valor: $(e.equipmentInsuranceAnnual) },
    { clave: "c:iva", etiqueta: "Condición frente al IVA", valor: IVA_TEXTO[e.ivaCondition] ?? "sin dato" },
    { clave: "c:ivaPct", etiqueta: "IVA (%)", valor: pc(e.ivaPercent) },
    { clave: "c:iibb", etiqueta: "Ingresos Brutos (%)", valor: pc(e.grossIncomePercent) },
    { clave: "c:comision", etiqueta: "Comisión del medio de pago (%)", valor: pc(e.paymentCommissionPercent) },
    { clave: "c:sumaComision", etiqueta: "Comisión sumada al precio", valor: e.includeCommissionInPrice ? "sí" : "no" },
    { clave: "c:sena", etiqueta: "Seña (%)", valor: pc(e.depositPercent) },
    { clave: "c:horaExtra", etiqueta: "Recargo hora extra (%)", valor: pc(e.overtimeSurchargePercent) },
    { clave: "c:sabado", etiqueta: "Recargo sábado (%)", valor: pc(e.saturdaySurchargePercent) },
    { clave: "c:domingo", etiqueta: "Recargo domingo (%)", valor: pc(e.sundaySurchargePercent) },
    { clave: "c:feriado", etiqueta: "Recargo feriado (%)", valor: pc(e.holidaySurchargePercent) },
    { clave: "c:expres", etiqueta: "Recargo entrega exprés (%)", valor: pc(e.expressSurchargePercent) },
    { clave: "c:entrega", etiqueta: "Días de entrega", valor: texto(e.standardDeliveryDays) },
    { clave: "c:viaticos", etiqueta: "Viáticos", valor: e.travelMode === "per_km" ? "por km" : e.travelMode === "zones" ? "por zonas" : "sin dato" },
    { clave: "c:km", etiqueta: "Valor por km", valor: $(e.travelPerKm) },
    { clave: "c:kmLibres", etiqueta: "Km sin cargo", valor: texto(e.travelFreeKm) },
    { clave: "c:zonas", etiqueta: "Zonas de viáticos", valor: e.travelZones.length ? e.travelZones.map((z) => `${z.name} (hasta ${z.upToKm} km: ${$(z.amount)})`).join(", ") : "sin dato" },
    { clave: "c:retoque", etiqueta: "Minutos de retoque por foto", valor: texto(e.retouchMinutesPerPhoto) },
    { clave: "c:inflacion", etiqueta: "Inflación mensual (%)", valor: e.inflationEnabled ? pc(e.inflationMonthlyPercent) : "sin ajuste" },
    { clave: "c:minimo", etiqueta: "Precio mínimo por trabajo", valor: $(e.minimumJobPrice) },
    { clave: "c:cancelacion", etiqueta: "Política de cancelación", valor: e.cancellationPolicy.trim() ? "cargada" : "sin dato" },
  ];
}

export function cambiosEntre(antes: CuantoCobroProfileInput, despues: CuantoCobroProfileInput): { etiqueta: string; antes: string; ahora: string }[] {
  const previos = new Map(camposPlanos(antes).map((c) => [c.clave, c.valor]));
  return camposPlanos(despues)
    .filter((c) => (previos.get(c.clave) ?? "sin dato") !== c.valor)
    .map((c) => ({ etiqueta: c.etiqueta, antes: previos.get(c.clave) ?? "sin dato", ahora: c.valor }));
}
