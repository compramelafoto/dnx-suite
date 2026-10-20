import { z } from "zod";
import { AJUSTES_NEUTROS, esquemaAjustes, type Ajustes } from "./ajustes";
import type { Nitidez } from "./medidas";

/**
 * La receta de una pieza: todo lo que se decidió en pantalla, en proporciones (nunca píxeles de
 * pantalla). El servidor la aplica sobre el original completo. Módulo PURO.
 *
 * Un único modelo de encuadre: proporciones de la caja de la foto ya girada (`cajaRotada`).
 * En RECORTAR cae dentro de la foto (0..1). En ENCAJAR puede salirse (x/y negativos,
 * ancho/alto mayores que 1): lo que queda afuera de la foto es borde del color `colorBorde`.
 * Las recetas de la etapa 1 (carnet) no traen orientación ni color y se arman igual que antes.
 */

export type Encuadre = { x: number; y: number; ancho: number; alto: number };
export type Modo = "RECORTAR" | "ENCAJAR";
export type Orientacion = "VERTICAL" | "HORIZONTAL";
export type Receta = {
  version: 1;
  modo: Modo;
  /** Cómo va el papel. Falta en las recetas de carnet: la medida ya dice cómo es la pieza. */
  orientacion?: Orientacion;
  rotacion90: 0 | 90 | 180 | 270;
  /** −10 a +10 grados. */
  enderezar: number;
  encuadre: Encuadre;
  /** Sólo cuenta en ENCAJAR. Si falta, blanco. */
  colorBorde?: string;
  ajustes: Ajustes;
  /** null = la de la salida. */
  nitidez: Nitidez | null;
};

export const COLOR_BORDE_POR_OMISION = "#ffffff";
/** En ENCAJAR la foto puede achicarse hasta 1/20 del lado del papel: más chica no tiene sentido. */
export const LADO_MAX_ENCAJAR = 20;
const TOLERANCIA = 0.0001;

/** Si el encuadre tiene sentido para el modo (también lo usa el editor antes de guardar). */
export function encuadreValido(modo: Modo, e: Encuadre): boolean {
  if (modo === "RECORTAR") {
    return e.x >= 0 && e.y >= 0 && e.ancho <= 1 && e.alto <= 1 && e.x + e.ancho <= 1 + TOLERANCIA && e.y + e.alto <= 1 + TOLERANCIA;
  }
  if (e.ancho > LADO_MAX_ENCAJAR || e.alto > LADO_MAX_ENCAJAR) return false;
  // Algo de la foto tiene que caer en el papel.
  const dentroX = Math.min(1, e.x + e.ancho) - Math.max(0, e.x);
  const dentroY = Math.min(1, e.y + e.alto) - Math.max(0, e.y);
  return dentroX > 0.001 && dentroY > 0.001;
}

const esquema = z
  .object({
    version: z.literal(1),
    modo: z.enum(["RECORTAR", "ENCAJAR"]),
    orientacion: z.enum(["VERTICAL", "HORIZONTAL"]).optional(),
    rotacion90: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    enderezar: z.number().min(-10).max(10),
    encuadre: z
      .object({ x: z.number().finite(), y: z.number().finite(), ancho: z.number().finite().gt(0), alto: z.number().finite().gt(0) })
      .strict(),
    colorBorde: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
    ajustes: esquemaAjustes,
    nitidez: z.enum(["SUAVE", "NORMAL", "FUERTE"]).nullable(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (!encuadreValido(r.modo, r.encuadre)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["encuadre"], message: "Encuadre fuera de rango" });
  });

export function validarReceta(x: unknown): Receta | null {
  const r = esquema.safeParse(x);
  return r.success ? (r.data as Receta) : null;
}

export function recetaInicial(): Receta {
  return { version: 1, modo: "RECORTAR", rotacion90: 0, enderezar: 0, encuadre: { x: 0, y: 0, ancho: 1, alto: 1 }, ajustes: { ...AJUSTES_NEUTROS }, nitidez: null };
}

export function anguloTotal(r: Receta): number {
  return r.rotacion90 + r.enderezar;
}

export function colorBordeDe(r: Receta): string {
  return r.colorBorde ?? COLOR_BORDE_POR_OMISION;
}
