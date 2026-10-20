/**
 * Geometría de la hoja de prueba (todo en mm: 1 unidad del SVG = 1 mm). Funciones puras para
 * poder probarlas sin navegador.
 */

export type Marca = { pos: number; largo: number; numero: number | null };

/** Marcas de una regla de 100 mm: cada 1 mm de 1,5 mm de largo y cada 10 mm de 4 mm, con número. */
export function marcasDeRegla(): Marca[] {
  const marcas: Marca[] = [];
  for (let mm = 0; mm <= 100; mm++) {
    const decena = mm % 10 === 0;
    marcas.push({ pos: mm, largo: decena ? 4 : 1.5, numero: decena ? mm : null });
  }
  return marcas;
}

export const GRISES = Array.from({ length: 11 }, (_, i) => i * 10);

/** 0 % = negro, 100 % = blanco, como un parche de tinta. */
export function colorDeGris(porcentaje: number): string {
  const v = Math.round((porcentaje / 100) * 255);
  return `rgb(${v},${v},${v})`;
}

export const COLORES_PRUEBA = [
  { nombre: "Rojo", css: "#ff0000" },
  { nombre: "Verde", css: "#00ff00" },
  { nombre: "Azul", css: "#0000ff" },
  { nombre: "Cian", css: "#00ffff" },
  { nombre: "Magenta", css: "#ff00ff" },
  { nombre: "Amarillo", css: "#ffff00" },
] as const;

/** Origen de una regla de 100 mm centrada en un eje de `largo` mm. */
export function origenCentrado(largo: number): number {
  return Math.round(((largo - 100) / 2) * 10) / 10;
}

/** Nombre de archivo seguro: sólo letras, números, punto, guion y guion bajo. */
export function nombreDescarga(salida: string, tamano: string, hojaId: string): string {
  return `${salida}_${tamano}_${hojaId}.jpg`.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Qué hacer con la imagen al montar la página: si ya cargó antes de la hidratación, `onLoad` no llega. */
export function decisionAlMontar(complete: boolean, naturalWidth: number, fase: string): "imprimir" | "error" | "esperar" {
  if (fase !== "cargando" || !complete) return "esperar";
  return naturalWidth > 0 ? "imprimir" : "error";
}
