/**
 * Cassettes que no se pudieron digitalizar (cinta cortada, vacía, mojada…). Módulo PURO (sin base).
 *
 * **Sin columna nueva.** Se guardan como una `DigitalizacionGrabacion` del trabajo ya cerrada:
 * `estado='COMPLETA'`, `sinImagen=true`, `conversionEstado='SIN_IMAGEN'`, `motivoFin='NO_DIGITALIZABLE'`,
 * `titulo` = el motivo, `duracionSeg=0`, sin partes y con `partesBorradasAt` puesto (no hay nada
 * crudo que bajar ni que borrar). `motivoFin` es TEXT sin CHECK en la base: el valor nuevo sólo
 * existe en el código.
 *
 * Así cuenta como «grabado» y «hecho» para la cuenta de cassettes (`./cassettes.ts`): 18 grabados +
 * 2 que no se pudieron de 20 vendidos = completo. El worker de conversión nunca la toma (sólo toma
 * `PENDIENTE`) y el relleno HLS tampoco (sólo `LISTA`). «Quitar» la deja DESCARTADA.
 *
 * Una grabación SIN_IMAGEN común (un corte de prueba de 0 min) NO es esto: no lleva este `motivoFin`
 * y el cliente no la ve.
 */
import type { TipoGrabacion } from "./constants";
import { ID_VALIDO } from "./claves";

export const MOTIVO_FIN_NO_DIGITALIZABLE = "NO_DIGITALIZABLE";

export const MOTIVOS_NO_DIGITALIZABLE = {
  CORTADA: "Cinta cortada",
  VACIA: "Cinta vacía (sin grabación)",
  MOJADA: "Cinta mojada u hongos",
  NO_LEE: "La casetera no la lee",
  OTRO: "Otro",
} as const;
export type MotivoNoDigitalizable = keyof typeof MOTIVOS_NO_DIGITALIZABLE;

export const MAX_MOTIVO_OTRO = 100;

/** El `mimeType` que se guarda (la columna es obligatoria): el mismo que usaría una grabación de ese tipo. */
export const MIME_NO_DIGITALIZABLE: Record<TipoGrabacion, string> = { VHS: "video/webm", DVD: "video/dvd" };

export type NoDigitalizableNuevo = {
  proyectoId: string;
  tipo: TipoGrabacion;
  /** Número de cassette (1–999); en un DVD puede ir null. */
  cassetteNumero: number | null;
  /** El texto que queda en `titulo`: el del motivo elegido, o el que escribió la persona en «Otro». */
  motivo: string;
};

const esObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Lo que manda el formulario, validado. null ante cualquier duda. */
export function validarNoDigitalizable(x: unknown): NoDigitalizableNuevo | null {
  if (!esObj(x)) return null;
  const { proyectoId, tipo, cassetteNumero, motivo, otro } = x;
  if (typeof proyectoId !== "string" || !ID_VALIDO.test(proyectoId)) return null;
  if (tipo !== "VHS" && tipo !== "DVD") return null;
  if (cassetteNumero !== null && !(Number.isInteger(cassetteNumero) && (cassetteNumero as number) >= 1 && (cassetteNumero as number) <= 999)) return null;
  if (tipo === "VHS" && cassetteNumero === null) return null;
  if (typeof motivo !== "string" || !Object.hasOwn(MOTIVOS_NO_DIGITALIZABLE, motivo)) return null;
  let texto: string = MOTIVOS_NO_DIGITALIZABLE[motivo as MotivoNoDigitalizable];
  if (motivo === "OTRO") {
    if (typeof otro !== "string") return null;
    const t = otro.trim().replace(/\s+/g, " ");
    if (t.length < 1 || t.length > MAX_MOTIVO_OTRO) return null;
    texto = t;
  }
  return { proyectoId, tipo, cassetteNumero: cassetteNumero as number | null, motivo: texto };
}

/** ¿Es un cassette que no se pudo digitalizar? */
export function esNoDigitalizable(g: { motivoFin?: string | null }): boolean {
  return g.motivoFin === MOTIVO_FIN_NO_DIGITALIZABLE;
}

type Datos = { tipo: string; cassetteNumero: number | null; titulo: string | null };

/** «Cassette 7», «Cassette» o «DVD». */
export function nombreDelCassette(g: { tipo: string; cassetteNumero: number | null }): string {
  if (g.tipo === "DVD") return g.cassetteNumero != null ? `DVD ${g.cassetteNumero}` : "DVD";
  return g.cassetteNumero != null ? `Cassette ${g.cassetteNumero}` : "Cassette";
}

/** El motivo guardado (o «sin motivo»). */
export function motivoDe(g: { titulo: string | null }): string {
  return g.titulo?.trim() || "sin motivo";
}

/** Para el equipo (trabajo, pedido, lista): «Cassette 7 · No se pudo digitalizar: Cinta cortada». */
export function textoNoDigitalizable(g: Datos): string {
  return `${nombreDelCassette(g)} · No se pudo digitalizar: ${motivoDe(g)}`;
}

/** Para el cliente: «Cassette 7: no se pudo digitalizar (Cinta cortada)». */
export function textoClienteNoDigitalizable(g: Datos): string {
  return `${nombreDelCassette(g)}: no se pudo digitalizar (${motivoDe(g)})`;
}

/** La línea del correo «Tus videos están listos»; null si no hay ninguno. */
export function lineaCorreoNoDigitalizables(lista: readonly Datos[]): string | null {
  if (lista.length === 0) return null;
  const detalle = lista.map((g) => `${nombreDelCassette(g)} (${motivoDe(g)})`).join(", ");
  return lista.length === 1
    ? `1 cassette no se pudo digitalizar: ${detalle}.`
    : `${lista.length} cassettes no se pudieron digitalizar: ${detalle}.`;
}

/** El número por defecto del formulario: el mayor de los cassettes del trabajo más uno. */
export function siguienteCassette(numeros: readonly (number | null)[]): number {
  const mayor = numeros.reduce<number>((m, n) => (n != null && n > m ? n : m), 0);
  return Math.min(999, mayor + 1);
}

/**
 * El tipo que propone el formulario: el de las grabaciones del trabajo si son todas del mismo, si
 * no lo que diga el nombre del trabajo (o de su producto), y si no VHS. La persona lo puede cambiar.
 */
export function tipoPorDefecto(textos: readonly (string | null | undefined)[], tipos: readonly string[]): TipoGrabacion {
  const vistos = new Set(tipos.filter((t) => t === "VHS" || t === "DVD"));
  if (vistos.size === 1) return [...vistos][0] as TipoGrabacion;
  const texto = textos.filter(Boolean).join(" ").toLowerCase();
  return /\bdvd\b/.test(texto) && !/\bvhs\b/.test(texto) ? "DVD" : "VHS";
}
