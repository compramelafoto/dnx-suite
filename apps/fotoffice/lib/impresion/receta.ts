import { z } from "zod";
import { AJUSTES_NEUTROS, esquemaAjustes, type Ajustes } from "./ajustes";
import type { Nitidez } from "./medidas";

/**
 * La receta de una pieza: todo lo que se decidió en pantalla, en proporciones (nunca píxeles de
 * pantalla). El servidor la aplica sobre el original completo. Módulo PURO.
 * Etapa 1: sólo RECORTAR. ENCAJAR, orientación y color de borde llegan en la etapa 2.
 */

export type Encuadre = { x: number; y: number; ancho: number; alto: number };
export type Receta = {
  version: 1;
  modo: "RECORTAR";
  rotacion90: 0 | 90 | 180 | 270;
  /** −10 a +10 grados. */
  enderezar: number;
  /** Proporciones 0..1 de la caja de la foto ya girada (`cajaRotada`). */
  encuadre: Encuadre;
  ajustes: Ajustes;
  /** null = la de la salida. */
  nitidez: Nitidez | null;
};

const fraccion = z.number().min(0).max(1);
const esquema = z
  .object({
    version: z.literal(1),
    modo: z.literal("RECORTAR"),
    rotacion90: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    enderezar: z.number().min(-10).max(10),
    encuadre: z
      .object({ x: fraccion, y: fraccion, ancho: z.number().gt(0).max(1), alto: z.number().gt(0).max(1) })
      .strict()
      .refine((e) => e.x + e.ancho <= 1.0001 && e.y + e.alto <= 1.0001),
    ajustes: esquemaAjustes,
    nitidez: z.enum(["SUAVE", "NORMAL", "FUERTE"]).nullable(),
  })
  .strict();

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
