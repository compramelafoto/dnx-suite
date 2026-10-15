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
    } else if (k === "negocio" || k === "equipo") {
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
  return l;
}

/** Rubros de gastos personales sin ningún monto, ni en el perfil guardado ni en el borrador. */
export function rubrosSinDatos(parche: ParchePerfil, base: CuantoCobroProfileInput): string[] {
  const anotados = new Set((parche.gastosPersonales ?? []).map((g) => g.grupoId));
  return base.personalExpenseGroups
    .filter((g) => !anotados.has(g.id) && !g.items.some((i) => (parseCuantoCobroAmount(i.amount ?? "") ?? 0) > 0))
    .map((g) => g.title);
}
