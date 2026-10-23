/**
 * Modelos del Estudio de luz.
 *
 * - Bustos: escaneo de Lee Perry-Smith (CC BY 3.0) con distintos tonos.
 * - Cuerpo entero: Microsoft Rocketbox Avatar Library (licencia MIT),
 *   con esqueleto completo para posar. Archivos en public/camofduty/models/figures.
 */

export type BustId = "skin-light" | "skin-medium" | "skin-dark" | "plaster";

export interface FigureSpec {
  id: string;
  /** Carpeta en public/camofduty/models/figures. */
  folder: string;
  name: string;
  outfit: string;
  gender: "mujer" | "hombre";
}

export const FIGURES: FigureSpec[] = [
  { id: "sofia", folder: "Female_Adult_01", name: "Sofía", outfit: "Camisa rosa y jean", gender: "mujer" },
  { id: "valentina", folder: "Female_Adult_02", name: "Valentina", outfit: "Blusa blanca y pollera", gender: "mujer" },
  { id: "camila", folder: "Female_Adult_03", name: "Camila", outfit: "Top violeta, salida", gender: "mujer" },
  { id: "laura", folder: "Female_Adult_09", name: "Laura", outfit: "Saco largo, ejecutiva", gender: "mujer" },
  { id: "martina", folder: "Female_Adult_11", name: "Martina", outfit: "Vestido y botas", gender: "mujer" },
  { id: "julia", folder: "Female_Adult_12", name: "Julia", outfit: "Buzo urbano y short", gender: "mujer" },
  { id: "mia", folder: "Female_Party_01", name: "Mía", outfit: "Fiesta, top blanco", gender: "mujer" },
  { id: "tomas", folder: "Male_Adult_02", name: "Tomás", outfit: "Suéter claro", gender: "hombre" },
  { id: "ricardo", folder: "Male_Adult_03", name: "Ricardo", outfit: "Saco gris, adulto mayor", gender: "hombre" },
  { id: "mateo", folder: "Male_Adult_04", name: "Mateo", outfit: "Campera urbana", gender: "hombre" },
  { id: "lucas", folder: "Male_Adult_06", name: "Lucas", outfit: "Camisa roja", gender: "hombre" },
  { id: "martin", folder: "Male_Adult_08", name: "Martín", outfit: "Camisa celeste", gender: "hombre" },
  { id: "samuel", folder: "Male_Adult_12", name: "Samuel", outfit: "Campera de jean", gender: "hombre" },
  { id: "joaquin", folder: "Male_Adult_13", name: "Joaquín", outfit: "Suéter de rombos", gender: "hombre" },
];

export const BUST_LABELS: Record<BustId, string> = {
  "skin-light": "Piel clara",
  "skin-medium": "Piel media",
  "skin-dark": "Piel oscura",
  plaster: "Busto de yeso",
};

export type SubjectId = BustId | string;

export const FIGURE_DIR = "/camofduty/models/figures";

export function figureById(id: string): FigureSpec | null {
  return FIGURES.find((f) => f.id === id) ?? null;
}

export function isBust(id: string): id is BustId {
  return id in BUST_LABELS;
}

export function isKnownSubject(id: unknown): id is SubjectId {
  return typeof id === "string" && (isBust(id) || figureById(id) !== null);
}

export function figureUrl(figure: FigureSpec, file: string): string {
  return `${FIGURE_DIR}/${figure.folder}/${file}`;
}
