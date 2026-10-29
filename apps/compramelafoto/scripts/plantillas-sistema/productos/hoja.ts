/**
 * Tamaños de hoja de los productos que no son libritos (diplomas, calendarios, señaladores…) y
 * las piezas de SVG para dibujar sus fondos a ese tamaño.
 *
 * Todas las medidas de un modelo van en píxeles de su lienzo; `h.mm(10)` convierte milímetros.
 */
import type { Rect } from "../lienzo";

export type Formato = {
  clave: string;
  /** Cómo se lo nombra en la descripción: «A4 apaisado (29,7 × 21 cm)». */
  nombre: string;
  anchoMm: number;
  altoMm: number;
  /** Los pósters grandes van a 200 dpi: a esa distancia de lectura sobra y los archivos pesan menos. */
  dpi: number;
};

export const FORMATOS = {
  a4Apaisado: { clave: "a4-apaisado", nombre: "A4 apaisado (29,7 × 21 cm)", anchoMm: 297, altoMm: 210, dpi: 300 },
  a4Vertical: { clave: "a4-vertical", nombre: "A4 vertical (21 × 29,7 cm)", anchoMm: 210, altoMm: 297, dpi: 300 },
  a3Vertical: { clave: "a3-vertical", nombre: "A3 vertical (29,7 × 42 cm)", anchoMm: 297, altoMm: 420, dpi: 200 },
  a5Vertical: { clave: "a5-vertical", nombre: "A5 vertical (14,8 × 21 cm)", anchoMm: 148, altoMm: 210, dpi: 300 },
  foto15x21: { clave: "15x21", nombre: "15 × 21 cm", anchoMm: 150, altoMm: 210, dpi: 300 },
  senalador: { clave: "senalador", nombre: "señalador de 5 × 18 cm", anchoMm: 50, altoMm: 180, dpi: 300 },
  tarjeta: { clave: "tarjeta", nombre: "tarjeta de 15 × 10 cm", anchoMm: 150, altoMm: 100, dpi: 300 },
  iman: { clave: "iman", nombre: "imán de 10 × 15 cm", anchoMm: 100, altoMm: 150, dpi: 300 },
} as const satisfies Record<string, Formato>;

/** Una hoja de un formato: su tamaño en píxeles y ayudas para ubicar cosas. */
export class Hoja {
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly cy: number;
  readonly pxPorMm: number;
  constructor(readonly formato: Formato) {
    this.pxPorMm = formato.dpi / 25.4;
    this.w = Math.round(formato.anchoMm * this.pxPorMm);
    this.h = Math.round(formato.altoMm * this.pxPorMm);
    this.cx = this.w / 2;
    this.cy = this.h / 2;
  }
  mm(v: number): number {
    return Math.round(v * this.pxPorMm);
  }
  /** Fracción del ancho / del alto. */
  fx(f: number): number {
    return Math.round(this.w * f);
  }
  fy(f: number): number {
    return Math.round(this.h * f);
  }
  get apaisada(): boolean {
    return this.w > this.h;
  }
  /** Margen de seguridad contra el corte. */
  get seguridad(): number {
    return this.mm(5);
  }
  /** Rectángulo centrado en x. Las medidas pueden ir en fracciones de la hoja con `fx`/`fy`. */
  centrado(y: number, w: number, h: number, cx = this.cx): Rect {
    return { x: cx - w / 2, y, w, h };
  }
  svg(contenido: string, defs = ""): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}"><defs>${defs}</defs>${contenido}</svg>`;
  }
  /** Capa de grano sobre toda la hoja (con `filtroGrano` en los defs). */
  grano(id: string, opacidad: number, modo: "multiply" | "screen" | "overlay" = "multiply"): string {
    return `<rect width="${this.w}" height="${this.h}" filter="url(#${id})" opacity="${opacidad}" style="mix-blend-mode:${modo}"/>`;
  }
  /** El tamaño en cm para las descripciones: «21 × 29,7 cm». */
  get medida(): string {
    const cm = (v: number) => String(v / 10).replace(".", ",");
    return `${cm(this.formato.anchoMm)} × ${cm(this.formato.altoMm)} cm`;
  }
}

/** Un rectángulo achicado `d` por lado. */
export const achicar = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

export const rect = (r: Rect, atributos: string) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${atributos}/>`;
