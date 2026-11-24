/**
 * Preventa escolar: quién elige las fotos del pack.
 *
 * - FAMILY: cada familia elige con su link (como siempre).
 * - PHOTOGRAPHER: la familia paga y el fotógrafo elige por ella.
 * - FAMILY_THEN_PHOTOGRAPHER: la familia tiene unos días; vencidos, el pedido pasa a «Te toca
 *   elegir». La familia sigue pudiendo elegir hasta que el fotógrafo lo haga: gana el primero.
 *
 * Puro (sin base): la regla se guarda en `SchoolPhotoChooserSetting` y se lee con `cargarRegla`
 * (`quien-elige-las-fotos-server.ts`).
 */

export const MODOS_ELECCION = ["FAMILY", "PHOTOGRAPHER", "FAMILY_THEN_PHOTOGRAPHER"] as const;
export type ModoEleccion = (typeof MODOS_ELECCION)[number];

export type ReglaEleccion = { mode: ModoEleccion; familyDays: number };

export const DIAS_POR_DEFECTO = 7;
const DIAS_MIN = 1;
const DIAS_MAX = 60;
const DIA_MS = 24 * 60 * 60 * 1000;

export function esModoEleccion(v: unknown): v is ModoEleccion {
  return typeof v === "string" && (MODOS_ELECCION as readonly string[]).includes(v);
}

/** Días acotados a 1–60; sin dato, los de por defecto. */
export function acotarDias(dias: number | null | undefined): number {
  if (dias == null || !Number.isFinite(dias)) return DIAS_POR_DEFECTO;
  return Math.min(DIAS_MAX, Math.max(DIAS_MIN, Math.round(dias)));
}

export function leerRegla(fila: { mode: string; familyDays: number | null } | null): ReglaEleccion {
  if (!fila) return { mode: "FAMILY", familyDays: DIAS_POR_DEFECTO };
  return {
    mode: esModoEleccion(fila.mode) ? fila.mode : "FAMILY",
    familyDays: acotarDias(fila.familyDays),
  };
}

/**
 * Quién tiene que elegir hoy un pack todavía no canjeado. `inicio` es cuándo la familia pudo
 * empezar a elegir: el aviso de «ya están las fotos» o, sin aviso, la fecha del pack.
 */
export function quienElige(regla: ReglaEleccion, pack: { inicio: Date }, ahora: Date): "FAMILIA" | "FOTOGRAFO" {
  if (regla.mode === "FAMILY") return "FAMILIA";
  if (regla.mode === "PHOTOGRAPHER") return "FOTOGRAFO";
  const vence = pack.inicio.getTime() + regla.familyDays * DIA_MS;
  return ahora.getTime() >= vence ? "FOTOGRAFO" : "FAMILIA";
}

/** ¿La familia puede confirmar el canje con su link? */
export function familiaPuedeElegir(regla: ReglaEleccion): boolean {
  return regla.mode !== "PHOTOGRAPHER";
}

export const TEXTOS_MODO: Record<ModoEleccion, { titulo: string; ayuda: string }> = {
  FAMILY: {
    titulo: "La familia",
    ayuda: "Cada familia elige sus fotos con su link, como hasta ahora.",
  },
  PHOTOGRAPHER: {
    titulo: "Yo (el fotógrafo)",
    ayuda: "Las familias pagan y vos elegís las fotos de cada pack. Ellas reciben el aviso cuando está listo.",
  },
  FAMILY_THEN_PHOTOGRAPHER: {
    titulo: "La familia, y si no elige, yo",
    ayuda:
      "La familia tiene unos días para elegir. Si no lo hace, el pedido pasa a «Te toca elegir». Hasta que elijas vos, la familia todavía puede hacerlo.",
  },
};
