import { parseCuantoCobroAmount, type CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { esquemaParchePerfil, type ParchePerfil } from "./motor";

/**
 * Borrador del perfil de precios (lógica pura, sin base). Mientras se arma el perfil conversando,
 * cada respuesta confirmada se anota acá —NO en el perfil guardado—, así una conversación nueva,
 * otro día o un corte no tiran el trabajo (FOTOFFICE, 13/10: 25 montos perdidos). Se guarda como
 * una lista de anotaciones con fecha: el borrador es su fusión en orden.
 *
 * La fecha sirve para el caché: la situación del turno muestra sólo lo anotado ANTES de la ventana
 * de historial que ve el modelo (lo de adentro ya está en el historial). Así la situación no cambia
 * en cada respuesta y el caché del historial sigue sirviendo.
 */

export type Anotacion = { en: string; parche: ParchePerfil };

/** Más anotaciones que esto → las más viejas se compactan en una (el tamaño de la fila queda acotado). */
export const MAX_ANOTACIONES = 100;

type Gasto = NonNullable<ParchePerfil["gastosPersonales"]>[number];

function claveGasto(g: Gasto): string {
  return `${g.grupoId}|${g.itemId ?? `~${(g.etiqueta ?? "").trim().toLocaleLowerCase("es")}`}`;
}

type Estudio = NonNullable<ParchePerfil["estudio"]>;
type GastoFijo = NonNullable<Estudio["gastosFijos"]>[number];
const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const claveFijo = (g: GastoFijo) => `${g.rubroId}|${g.renglonId ?? `~${sinTildes(g.etiqueta ?? "")}`}`;

/** Une dos listas por clave: lo nuevo pisa a lo viejo con la misma clave; `mezclar` decide cómo (por omisión, reemplaza). */
function unirPorClave<T>(a: T[] | undefined, b: T[] | undefined, clave: (x: T) => string, mezclar: (viejo: T, nuevo: T) => T = (_v, n) => n): T[] | undefined {
  if (!a && !b) return undefined;
  const out = [...(a ?? [])];
  for (const x of b ?? []) {
    const i = out.findIndex((y) => clave(y) === clave(x));
    if (i >= 0) out[i] = mezclar(out[i]!, x);
    else out.push(x);
  }
  return out;
}

/** Mi estudio: campo por campo; gastos fijos por renglón, personas por nombre (campo por campo). */
function fusionarEstudio(a: Estudio | undefined, b: Estudio): Estudio {
  const out: Estudio = { ...(a ?? {}), ...b };
  const fijos = unirPorClave(a?.gastosFijos, b.gastosFijos, claveFijo);
  if (fijos) out.gastosFijos = fijos;
  const personas = unirPorClave(a?.personas, b.personas, (x) => sinTildes(x.nombre), (v, n) => ({ ...v, ...n }));
  if (personas) out.personas = personas;
  if (a?.tuJornada || b.tuJornada) out.tuJornada = { ...(a?.tuJornada ?? {}), ...(b.tuJornada ?? {}) };
  if (b.ganancia) out.ganancia = b.ganancia;
  return out;
}

/** `b` sobre `a`: lo nuevo pisa campo por campo; los gastos, por renglón; la distribución, entera. */
export function fusionarParches(a: ParchePerfil, b: ParchePerfil): ParchePerfil {
  const out: ParchePerfil = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof ParchePerfil, unknown][]) {
    if (v === undefined) continue;
    if (k === "gastosPersonales") {
      const porClave = new Map((a.gastosPersonales ?? []).map((g) => [claveGasto(g), g]));
      for (const g of b.gastosPersonales ?? []) {
        porClave.delete(claveGasto(g));
        porClave.set(claveGasto(g), g);
      }
      // Orden: los viejos que siguen en su lugar, después los corregidos o nuevos.
      const viejos = (a.gastosPersonales ?? []).filter((g) => porClave.get(claveGasto(g)) === g);
      const nuevos = (b.gastosPersonales ?? []).filter((g, i, arr) => arr.findLastIndex((x) => claveGasto(x) === claveGasto(g)) === i);
      out.gastosPersonales = [...viejos, ...nuevos];
    } else if (k === "estudio") {
      out.estudio = fusionarEstudio(a.estudio, v as Estudio);
    } else if (k === "camaras") {
      out.camaras = unirPorClave(a.camaras, b.camaras, (x) => sinTildes(x.nombre), (viejo, nuevo) => ({ ...viejo, ...nuevo }));
    } else if (k === "negocio" || k === "equipo" || k === "cobros") {
      (out as Record<string, unknown>)[k] = { ...(a[k] ?? {}), ...(v as object) };
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/** El borrador: todas las anotaciones fusionadas en orden; con `hasta`, sólo las anteriores a ese momento. */
export function parcheDelBorrador(anotaciones: Anotacion[], hasta?: Date): ParchePerfil {
  const limite = hasta?.getTime() ?? Infinity;
  return anotaciones.filter((x) => Date.parse(x.en) < limite).reduce<ParchePerfil>((acc, x) => fusionarParches(acc, x.parche), {});
}

/** Lo guardado en la base, validado: lo que no es un parche válido se descarta. */
export function leerAnotaciones(raw: unknown): Anotacion[] {
  const lista = (raw as { anotaciones?: unknown } | null)?.anotaciones;
  if (!Array.isArray(lista)) return [];
  const out: Anotacion[] = [];
  for (const x of lista) {
    const en = (x as { en?: unknown } | null)?.en;
    if (typeof en !== "string" || Number.isNaN(Date.parse(en))) continue;
    const p = esquemaParchePerfil.safeParse((x as { parche?: unknown }).parche);
    if (p.success) out.push({ en, parche: p.data });
  }
  return out;
}

export function sumarAnotacion(anotaciones: Anotacion[], parche: ParchePerfil, ahora: Date): Anotacion[] {
  const todas = [...anotaciones, { en: ahora.toISOString(), parche }];
  if (todas.length <= MAX_ANOTACIONES) return todas;
  const sobran = todas.length - MAX_ANOTACIONES + 1;
  const viejas = todas.slice(0, sobran);
  return [{ en: viejas.at(-1)!.en, parche: parcheDelBorrador(viejas) }, ...todas.slice(sobran)];
}

// ── Lo que se cuenta del borrador (sin montos: las cifras salen de las herramientas) ────────────

const NEGOCIO: Record<string, string> = {
  alquiler: "alquiler o estudio",
  software: "software",
  publicidad: "publicidad",
  colaboradores: "colaboradores",
  costoColaboradores: "costo de colaboradores",
};
const EQUIPO: Record<string, string> = {
  renovacionMensual: "inversión mensual en equipo",
  camara: "cámara",
  vidaUtilObturador: "vida útil del obturador",
  disparosActuales: "disparos actuales",
  valorReposicion: "valor de reposición",
  disparosAnuales: "disparos por año (todos los trabajos)",
};

const COBROS: Record<string, string> = {
  monotributo: "monotributo",
  seguroEquipoAnual: "seguro del equipo",
  condicionIva: "condición frente al IVA",
  iva: "IVA",
  ingresosBrutos: "ingresos brutos",
  comisionMedioDePago: "comisión del medio de pago",
  sumarComisionAlPrecio: "si suma la comisión al precio",
  sena: "seña",
  recargoHoraExtra: "recargo de la hora extra",
  recargoSabado: "recargo de sábado",
  recargoDomingo: "recargo de domingo",
  recargoFeriado: "recargo de feriado",
  recargoExpres: "recargo por entrega exprés",
  diasDeEntrega: "días de entrega",
  viaticos: "cómo cobra los viáticos",
  valorKm: "valor por km",
  kmSinCargo: "km sin cargo",
  zonas: "zonas de viáticos",
  minutosRetoquePorFoto: "minutos de retoque por foto",
  inflacionMensual: "inflación mensual",
  precioMinimo: "precio mínimo por trabajo",
  politicaCancelacion: "política de cancelación",
};

/** Qué ya contó la persona, en palabras (por rubro y renglón), sin ningún monto. */
export function loAnotado(parche: ParchePerfil, base: CuantoCobroProfileInput): string[] {
  const l: string[] = [];
  if (parche.moneda) l.push("moneda");
  if (parche.viveSoloDeFotografia) l.push("si vive sólo de la fotografía");
  if (parche.ingresosExternos !== undefined) l.push("otros ingresos");
  const porRubro = new Map<string, string[]>();
  for (const g of parche.gastosPersonales ?? []) {
    const grupo = base.personalExpenseGroups.find((x) => x.id === g.grupoId);
    const titulo = grupo?.title ?? g.grupoId;
    const renglon = (g.itemId ? grupo?.items.find((i) => i.id === g.itemId)?.label : null) ?? g.etiqueta ?? g.itemId ?? "";
    porRubro.set(titulo, [...(porRubro.get(titulo) ?? []), renglon]);
  }
  for (const [titulo, renglones] of porRubro) l.push(`gastos de ${titulo} (${renglones.join(", ")})`);
  for (const k of Object.keys(parche.negocio ?? {})) l.push(NEGOCIO[k] ?? k);
  for (const k of Object.keys(parche.equipo ?? {})) l.push(EQUIPO[k] ?? k);
  if (parche.horasSemana) l.push("horas por semana");
  if (parche.distribucion) l.push("horas por tarea");
  if (parche.fondoEmergencia !== undefined) l.push("fondo de emergencia");
  if (parche.ahorro !== undefined) l.push("ahorro y vacaciones");
  if (parche.posicionamiento) l.push("momento del negocio");
  for (const k of Object.keys(parche.cobros ?? {})) l.push(COBROS[k] ?? k);
  const e = parche.estudio;
  if (e) {
    if (e.activar !== undefined) l.push(e.activar ? "Mi estudio encendido" : "Mi estudio apagado");
    if (e.gastosFijos?.length) l.push(`gastos fijos del estudio (${e.gastosFijos.map((g) => g.etiqueta ?? g.renglonId ?? g.rubroId).join(", ")})`);
    if (e.retiro !== undefined) l.push("tu retiro");
    if (e.tuJornada) l.push("tu jornada");
    for (const x of e.personas ?? []) l.push(x.quitar ? `quitar a ${x.nombre} del equipo` : `${x.nombre} (${Object.keys(x).filter((k) => k !== "nombre").join(", ") || "nombre"})`);
    if (e.separarLocal !== undefined) l.push(e.separarLocal ? "local y coberturas por separado" : "local y coberturas juntos");
    if (e.sueldoDelLocal !== undefined) l.push("lo que te paga el local");
    if (e.tiempoEnElLocal !== undefined) l.push("tu tiempo en el local");
    if (e.compartidoCoberturas !== undefined) l.push("gastos compartidos que llevan las coberturas");
    if (e.costoMercaderia !== undefined) l.push("costo de la mercadería");
    if (e.localEstimado !== undefined) l.push("lo que deja el local");
    if (e.otrasLineas !== undefined) l.push("lo que dejan otras líneas");
    if (e.ganancia) l.push("ganancia del estudio");
  }
  for (const c of parche.camaras ?? []) l.push(c.quitar ? `quitar la cámara ${c.nombre}` : `cámara ${c.nombre}`);
  return l;
}

/** Rubros de gastos personales sin ningún monto, ni en el perfil guardado ni en el borrador. */
export function rubrosSinDatos(parche: ParchePerfil, base: CuantoCobroProfileInput): string[] {
  // Con «Mi estudio» no hacen falta gastos personales: el retiro los reemplaza.
  // (con el local separado sí hacen falta: de ahí sale lo que necesita llevarse de las coberturas)
  const separado = parche.estudio?.separarLocal === true || (base.studioStructure?.separateLocal === true && parche.estudio?.separarLocal !== false);
  if (!separado && ((base.studioStructure?.enabled === true && parche.estudio?.activar !== false) || (parche.estudio && parche.estudio.activar !== false))) return [];
  const anotados = new Set((parche.gastosPersonales ?? []).map((g) => g.grupoId));
  return base.personalExpenseGroups
    .filter((g) => !anotados.has(g.id) && !g.items.some((i) => (parseCuantoCobroAmount(i.amount ?? "") ?? 0) > 0))
    .map((g) => g.title);
}
