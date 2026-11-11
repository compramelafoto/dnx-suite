import type { MaterialBox } from "./secuencia";

/**
 * Los 10 BOX del recorrido del Club de Beluz (SOYBELUZ), tal como los nombró Belén. Los materiales
 * de cada uno todavía no están definidos: se cargan desde el panel a medida que se decidan.
 *
 * Las carga `scripts/box-cargar-soybeluz.ts`. Viven acá, en un módulo puro, para que una prueba
 * pueda verificar que están los 10, en orden, sin tocar la base.
 */

export const WORKSPACE_SOYBELUZ = "ws_soybeluz";

export type CajaDelCatalogo = { number: number; name: string; materials: MaterialBox[] };

export const CATALOGO_BOX_SOYBELUZ: readonly CajaDelCatalogo[] = [
  { number: 1, name: "Mi primer universo creativo: Soltar la mano", materials: [] },
  { number: 2, name: "Un mundo de flores", materials: [] },
  { number: 3, name: "El universo de los patrones", materials: [] },
  { number: 4, name: "Mirar de otra manera", materials: [] },
  { number: 5, name: "Dibujar el movimiento", materials: [] },
  { number: 6, name: "Inventar lo que no existe", materials: [] },
  { number: 7, name: "El poder de las texturas", materials: [] },
  { number: 8, name: "Crear espacios y mundos", materials: [] },
  { number: 9, name: "Luces, sombras y volumen", materials: [] },
  { number: 10, name: "Encontrar mi propio trazo", materials: [] },
];
