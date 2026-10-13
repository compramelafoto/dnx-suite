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
  .describe("Monto mensual en pesos, sólo dígitos (sin $, puntos ni comas). '450 lucas' → '450000'. Tiene que haberlo dicho la persona.");
const entero = z.string().regex(/^\d{1,9}$/).describe("Número entero, sólo dígitos.");
const horasOPct = z.string().regex(/^\d{1,3}([.,]\d{1,2})?$/);

const POSICIONAMIENTOS = ["starting", "growing", "stable", "established", "high-demand"] as const;

export const esquemaParchePerfil = z
  .object({
    moneda: z.string().regex(/^[A-Z]{3}$/).optional().describe("Código de moneda, por ejemplo ARS. Casi siempre ARS."),
    viveSoloDeFotografia: z.enum(["si", "no"]).optional(),
    ingresosExternos: monto.optional().describe("Sólo si no vive sólo de la fotografía: lo que le dejan sus otros ingresos por mes."),
    gastosPersonales: z
      .array(
        z.object({
          grupoId: z.string().max(40).describe("id del rubro, de ver_perfil_de_precios (housing, food, health…)."),
          itemId: z.string().max(60).optional().describe("id del renglón del rubro. Si el gasto no tiene renglón, omitilo y mandá `etiqueta`."),
          etiqueta: z.string().min(1).max(60).optional().describe("Nombre de un renglón propio, sólo si no existe en el rubro."),
          monto,
        }),
      )
      .max(60)
      .optional()
      .describe("Gastos personales del mes, uno por renglón."),
    negocio: z
      .object({
        alquiler: monto.optional().describe("Alquiler del estudio u oficina ('0' si no tiene)."),
        software: monto.optional(),
        publicidad: monto.optional(),
        colaboradores: entero.optional().describe("Cantidad de empleados o colaboradores fijos ('0' si trabaja sola/o)."),
        costoColaboradores: monto.optional().describe("Costo mensual total de esos colaboradores."),
      })
      .optional(),
    equipo: z
      .object({
        renovacionMensual: monto.optional().describe("Lo que aparta por mes para renovar el equipo."),
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
    fondoEmergencia: monto.optional(),
    ahorro: monto.optional().describe("Ahorro y vacaciones por mes."),
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

export function aplicarParche(base: CuantoCobroProfileInput, parche: ParchePerfil): { perfil: CuantoCobroProfileInput; errores: string[] } {
  const errores: string[] = [];
  const p: CuantoCobroProfileInput = structuredClone(normalizarPerfil(base)!);

  if (parche.moneda) p.currency = parche.moneda;
  if (parche.viveSoloDeFotografia) p.livesOnlyFromPhotography = parche.viveSoloDeFotografia === "si" ? "yes" : "no";
  if (parche.ingresosExternos !== undefined) p.externalMonthlyIncome = parche.ingresosExternos;

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
      item.amount = g.monto;
      continue;
    }
    if (!g.etiqueta) {
      errores.push(`Falta el renglón del gasto de «${grupo.title}».`);
      continue;
    }
    const etiqueta = g.etiqueta.trim();
    const existente = grupo.items.find((i) => i.label.trim().toLocaleLowerCase("es") === etiqueta.toLocaleLowerCase("es"));
    if (existente) existente.amount = g.monto;
    else grupo.items.push({ id: idPropio(etiqueta), label: etiqueta, amount: g.monto, isCustom: true });
  }

  const n = parche.negocio;
  if (n?.alquiler !== undefined) p.businessRent = n.alquiler;
  if (n?.software !== undefined) p.businessSoftware = n.software;
  if (n?.publicidad !== undefined) p.businessMarketing = n.publicidad;
  if (n?.colaboradores !== undefined) p.employeesCount = n.colaboradores;
  if (n?.costoColaboradores !== undefined) p.employeeMonthlyCost = n.costoColaboradores;

  const e = parche.equipo;
  if (e?.renovacionMensual !== undefined) p.equipmentRenewalMonthly = e.renovacionMensual;
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

  if (parche.fondoEmergencia !== undefined) p.emergencyFundMonthly = parche.fondoEmergencia;
  if (parche.ahorro !== undefined) p.savingsGoalsMonthly = parche.ahorro;
  if (parche.posicionamiento) p.commercialPositioningId = parche.posicionamiento;

  return { perfil: p, errores };
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

export type Simulacion = { perfil: CuantoCobroProfileInput; errores: string[]; vista: VistaPerfil };

/** El perfil con el parche aplicado, SIN guardar, con los errores del formulario y su resumen. */
export function simularPerfil(base: CuantoCobroProfileInput, parche: ParchePerfil, source: string | null = null): Simulacion {
  const { perfil, errores } = aplicarParche(base, parche);
  const v = validarPerfil(perfil);
  const propios = [...errores];
  // Si ya se explicó cuánto falta repartir, el error genérico de la distribución sobra.
  const yaDijoDistribucion = errores.some((e) => e.startsWith("Las horas por tarea"));
  if (!v.ok && !(yaDijoDistribucion && v.error.startsWith("La distribución del tiempo"))) propios.push(v.error);
  return { perfil, errores: propios, vista: vistaDelPerfil(perfil, source) };
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
