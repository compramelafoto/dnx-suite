import { z } from "@repo/dnx-bot";
import {
  COMMERCIAL_POSITIONING_OPTIONS,
  formatCuantoCobroCurrency,
  parseCuantoCobroAmount,
  type CuantoCobroProfileInput,
} from "@repo/cuanto-cobro-core";
import {
  CLAVES_DISTRIBUCION,
  distribucionDesdeHoras,
  horasPorTarea,
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
        renovacionMensual: montoMes.optional().describe("Lo que aparta por mes para renovar el equipo."),
        camara: z.string().max(80).optional(),
        vidaUtilObturador: entero.optional(),
        disparosActuales: entero.optional(),
        valorReposicion: monto.optional(),
        disparosAnuales: entero.optional(),
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

export function aplicarParche(
  base: CuantoCobroProfileInput,
  parche: ParchePerfil,
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
  poner(n?.alquiler, "Alquiler o estudio", (v) => (p.businessRent = v));
  poner(n?.software, "Software", (v) => (p.businessSoftware = v));
  poner(n?.publicidad, "Publicidad", (v) => (p.businessMarketing = v));
  if (n?.colaboradores !== undefined) p.employeesCount = n.colaboradores;
  poner(n?.costoColaboradores, "Costo de colaboradores", (v) => (p.employeeMonthlyCost = v));

  const e = parche.equipo;
  poner(e?.renovacionMensual, "Renovación de equipo", (v) => (p.equipmentRenewalMonthly = v));
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

export type Simulacion = { perfil: CuantoCobroProfileInput; errores: string[]; vista: VistaPerfil; conversiones: Conversion[] };

/** El perfil con el parche aplicado, SIN guardar, con los errores del formulario y su resumen. */
export function simularPerfil(base: CuantoCobroProfileInput, parche: ParchePerfil, source: string | null = null): Simulacion {
  const { perfil, errores, conversiones } = aplicarParche(base, parche);
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
    { clave: "renovacion", etiqueta: "Renovación mensual de equipo", valor: $(p.equipmentRenewalMonthly) },
    { clave: "camara", etiqueta: "Cámara principal", valor: texto(p.primaryCameraCustomName) },
    { clave: "obturador", etiqueta: "Vida útil del obturador", valor: texto(p.primaryCameraShutterRating) },
    { clave: "disparos", etiqueta: "Disparos actuales", valor: texto(p.primaryCameraCurrentShutterCount) },
    { clave: "reposicion", etiqueta: "Valor de reposición de la cámara", valor: $(p.primaryCameraReplacementValue) },
    { clave: "anuales", etiqueta: "Disparos por año", valor: texto(p.estimatedAnnualShots) },
    { clave: "horasSemana", etiqueta: "Horas por semana", valor: texto(p.weeklyHours) },
    ...CLAVES_DISTRIBUCION.map((k) => ({ clave: `tarea:${k}`, etiqueta: `${ETIQUETA_TAREA[k]} (horas por semana)`, valor: String(horas[k]) })),
    { clave: "fondo", etiqueta: "Fondo de emergencia", valor: $(p.emergencyFundMonthly) },
    { clave: "ahorro", etiqueta: "Ahorro y vacaciones", valor: $(p.savingsGoalsMonthly) },
    { clave: "posicionamiento", etiqueta: "Momento del negocio", valor: pos ?? "sin dato" },
  ];
}

export function cambiosEntre(antes: CuantoCobroProfileInput, despues: CuantoCobroProfileInput): { etiqueta: string; antes: string; ahora: string }[] {
  const previos = new Map(camposPlanos(antes).map((c) => [c.clave, c.valor]));
  return camposPlanos(despues)
    .filter((c) => (previos.get(c.clave) ?? "sin dato") !== c.valor)
    .map((c) => ({ etiqueta: c.etiqueta, antes: previos.get(c.clave) ?? "sin dato", ahora: c.valor }));
}
