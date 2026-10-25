/**
 * Ayudantes de presentación del tablero (Consultas y Proyectos). Módulo PURO: lo usa el
 * componente de cliente; no lee la base ni cambia datos.
 */

/** Clase del punto de color de una etapa (los mismos colores que las etiquetas). Desconocido: gris. */
const PUNTO_DE_COLOR: Record<string, string> = {
  gris: "bg-slate-400",
  rojo: "bg-red-500",
  naranja: "bg-orange-500",
  amarillo: "bg-amber-400",
  verde: "bg-emerald-500",
  azul: "bg-sky-500",
  violeta: "bg-violet-500",
  rosa: "bg-pink-500",
};

export function clasePuntoDeEtapa(color: string): string {
  return PUNTO_DE_COLOR[color] ?? PUNTO_DE_COLOR.gris!;
}

/** Iniciales para el avatar del responsable: "Daniel Cuart" → "DC"; "ana@x.com" → "A". */
export function iniciales(nombre: string): string {
  const limpio = nombre.trim();
  if (!limpio) return "?";
  const palabras = (limpio.includes("@") ? limpio.split("@")[0]! : limpio).split(/[\s._-]+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1 || limpio.includes("@")) return palabras[0]!.charAt(0).toLocaleUpperCase("es");
  return (palabras[0]!.charAt(0) + palabras[palabras.length - 1]!.charAt(0)).toLocaleUpperCase("es");
}

/** Totales del tablero entero: cuántas hay y la suma del valor estimado de todas las columnas. */
export function resumenDeColumnas(columnas: readonly { total: number; valorTotal: number }[]): { total: number; valor: number } {
  return columnas.reduce((acc, c) => ({ total: acc.total + c.total, valor: acc.valor + c.valorTotal }), { total: 0, valor: 0 });
}

/** Qué parte del tablero está en esta columna, de 0 a 100 (entero). Sin nada en el tablero: 0. */
export function porcentajeDe(parte: number, total: number): number {
  if (!(total > 0) || !(parte > 0)) return 0;
  return Math.min(100, Math.round((parte / total) * 100));
}
