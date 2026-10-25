/**
 * Medidas reales de los pliegos de fotolibro.
 *
 * Un pliego es una hoja del libro abierta: las dos páginas enfrentadas, impresas en una sola
 * copia que después se monta. Los laboratorios lo nombran por la medida abierta redondeada
 * ("30x60"), pero la copia que sale de la máquina es un poco distinta: 305 × 610 mm. Diseñar
 * con la medida redondeada deja un filete blanco o recorta la foto.
 *
 * Las medidas son las mismas en todos los laboratorios de la zona (todos imprimen en el mismo
 * papel de 152, 203 y 305 mm de ancho), por eso viven en un solo catálogo y no por proveedor.
 *
 * Fuentes (21/10/2026):
 * - La lista de canales de la impresora de un laboratorio (columna "Print Size", en mm).
 * - La lista de precios de La Isla, que publica la "medida real en cm" de cada pliego.
 *   Es la única de las tres listas que la publica; Copy Express y Román sólo dicen la medida
 *   abierta redondeada y remiten a pedir la plantilla.
 *
 * La tapa flexible sale unos milímetros más larga que la de hojas rígidas: el laboratorio tiene
 * canales distintos para cada una ("20X31" contra "20x30", "30X475" contra "30X45").
 */

export type LineaFotolibro = "RIGIDO" | "FLEXIBLE";
export type OrientacionPagina = "VERTICAL" | "HORIZONTAL" | "CUADRADO";

export type MedidaPliego = {
  /** Estable: queda guardado en las plantillas. No cambiar uno existente. */
  id: string;
  /** Como lo nombran los laboratorios: medida abierta redondeada, alto × ancho, en cm. */
  nombre: string;
  linea: LineaFotolibro;
  /** Medida real de la copia, en milímetros. El alto es el lado corto del papel. */
  altoMm: number;
  anchoMm: number;
};

export const LINEAS_FOTOLIBRO: Record<LineaFotolibro, string> = {
  RIGIDO: "Hojas rígidas",
  FLEXIBLE: "Tapa flexible",
};

const m = (nombre: string, linea: LineaFotolibro, altoMm: number, anchoMm: number): MedidaPliego => ({
  id: `${linea === "RIGIDO" ? "rigido" : "flexible"}-${nombre}`,
  nombre,
  linea,
  altoMm,
  anchoMm,
});

export const MEDIDAS_PLIEGO: readonly MedidaPliego[] = [
  m("15x30", "RIGIDO", 152, 305),
  m("15x45", "RIGIDO", 152, 457),
  m("15x60", "RIGIDO", 152, 610),
  m("20x30", "RIGIDO", 203, 305),
  m("20x40", "RIGIDO", 203, 405),
  m("20x60", "RIGIDO", 203, 610),
  m("30x40", "RIGIDO", 305, 403),
  m("30x45", "RIGIDO", 305, 457),
  m("30x60", "RIGIDO", 305, 610),
  m("30x80", "RIGIDO", 305, 810),
  m("30x90", "RIGIDO", 305, 910),

  m("15x30", "FLEXIBLE", 152, 310),
  m("15x45", "FLEXIBLE", 152, 470),
  m("15x60", "FLEXIBLE", 152, 620),
  m("20x30", "FLEXIBLE", 203, 310),
  m("20x40", "FLEXIBLE", 203, 415),
  m("20x60", "FLEXIBLE", 203, 620),
  m("30x45", "FLEXIBLE", 305, 470),
  m("30x60", "FLEXIBLE", 305, 620),
  m("30x80", "FLEXIBLE", 305, 820),
];

export function medidaPorId(id: string): MedidaPliego | null {
  return MEDIDAS_PLIEGO.find((x) => x.id === id) ?? null;
}

/** El libro cerrado: una página es la mitad del pliego. */
export function paginaCerrada(medida: MedidaPliego): { altoMm: number; anchoMm: number; orientacion: OrientacionPagina } {
  const anchoMm = medida.anchoMm / 2;
  const diferencia = medida.altoMm - anchoMm;
  // Un 20x40 (203 × 202,5 mm) es cuadrado aunque no dé exacto.
  const orientacion: OrientacionPagina =
    Math.abs(diferencia) <= 5 ? "CUADRADO" : diferencia > 0 ? "VERTICAL" : "HORIZONTAL";
  return { altoMm: medida.altoMm, anchoMm, orientacion };
}

const ORIENTACION: Record<OrientacionPagina, string> = {
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal",
  CUADRADO: "cuadrado",
};

const cm = (mm: number) => (mm / 10).toLocaleString("es-AR", { maximumFractionDigits: 2 });

/** "Libro de 20 × 15 cm, vertical". */
export function describirCerrado(medida: MedidaPliego): string {
  const p = paginaCerrada(medida);
  return `${cm(p.altoMm)} × ${cm(p.anchoMm)} cm, ${ORIENTACION[p.orientacion]}`;
}

/** "203 × 305 mm". Ancho primero: así se lee el pliego apaisado en pantalla. */
export function describirPliego(medida: MedidaPliego): string {
  return `${medida.anchoMm} × ${medida.altoMm} mm`;
}

export const DPI_FOTOLIBRO = 300;

/** Lienzo del editor para un pliego: ancho y alto en píxeles a 300 dpi. */
export function lienzoDelPliego(medida: MedidaPliego): { width: number; height: number } {
  const px = (mm: number) => Math.round((mm * DPI_FOTOLIBRO) / 25.4);
  return { width: px(medida.anchoMm), height: px(medida.altoMm) };
}

/**
 * Qué medidas ofrece cada laboratorio, según su lista de precios de octubre de 2026.
 *
 * Se reconoce al proveedor por el nombre cargado en Configuración → Proveedores (sin tildes ni
 * mayúsculas). Es una guía para elegir, no una restricción: un proveedor sin entrada acá
 * ofrece todas las medidas.
 *
 * Quedaron afuera las medidas de Copy Express sin medida real conocida (10x15, 10x20, 10x30,
 * 13x36, 15x20, 15x44, 20x80, 25x50, 25x75) y la 30x90 de tapa flexible.
 */
const OFERTA_POR_PROVEEDOR: Record<string, readonly string[]> = {
  "la isla": [
    "rigido-15x30", "rigido-15x45", "rigido-15x60", "rigido-20x30", "rigido-20x40", "rigido-20x60",
    "rigido-30x45", "rigido-30x60", "rigido-30x80", "rigido-30x90",
    "flexible-15x30", "flexible-15x45", "flexible-15x60", "flexible-20x30", "flexible-20x40",
    "flexible-20x60", "flexible-30x45", "flexible-30x60", "flexible-30x80",
  ],
  roman: [
    "rigido-15x30", "rigido-15x60", "rigido-20x30", "rigido-20x40", "rigido-20x60",
    "rigido-30x45", "rigido-30x60", "rigido-30x90",
  ],
  "copy express": [
    "rigido-15x30", "rigido-15x60", "rigido-20x30", "rigido-20x40", "rigido-20x60", "rigido-30x40",
    "rigido-30x45", "rigido-30x60", "rigido-30x80", "rigido-30x90",
    "flexible-15x30", "flexible-15x60", "flexible-20x30", "flexible-20x40", "flexible-20x60",
    "flexible-30x45", "flexible-30x60", "flexible-30x80",
  ],
};

/**
 * Los laboratorios de los que hay lista, para elegir sin tener proveedores cargados (el socio
 * en su portal). El `id` no es de la base: sólo sirve para el desplegable.
 */
export const LABORATORIOS_CONOCIDOS = [
  { id: "lab-la-isla", name: "La Isla" },
  { id: "lab-roman", name: "Román" },
  { id: "lab-copy-express", name: "Copy Express" },
] as const;

export function normalizarNombreProveedor(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Las medidas que ofrece un proveedor, o `null` si no hay datos de su lista. */
export function medidasDelProveedor(nombre: string): MedidaPliego[] | null {
  const ids = OFERTA_POR_PROVEEDOR[normalizarNombreProveedor(nombre)];
  if (!ids) return null;
  return MEDIDAS_PLIEGO.filter((x) => ids.includes(x.id));
}
