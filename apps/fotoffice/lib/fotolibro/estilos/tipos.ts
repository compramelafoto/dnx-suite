/**
 * Estilos de fotolibro: el diseño completo que se aplica a todo un libro.
 *
 * Un estilo no es una imagen guardada: es código que dibuja (en SVG, con medidas en milímetros)
 * el fondo de cada pliego para la medida que tenga el libro —20x30, 30x30, 30x90…— y dice dónde
 * pueden ir las fotos y los títulos. Así un mismo estilo sirve para cualquier laboratorio, y el
 * catálogo entero no ocupa ni una imagen en el almacenamiento hasta que alguien lo usa.
 *
 * Al aplicarlo, el navegador dibuja los fondos a la medida exacta del libro y los sube en alta
 * (ver `components/fotolibro/modo/aplicar-estilo.ts`). Las fotos las sigue acomodando el Modo
 * Fotolibro, dentro de la zona que deja el estilo.
 */

export const TEMAS = [
  { id: "bodas", nombre: "Bodas" },
  { id: "pareja", nombre: "Pareja y aniversario" },
  { id: "xv", nombre: "XV" },
  { id: "infantil", nombre: "Cumpleaños infantil" },
  { id: "adultos", nombre: "Cumpleaños adultos" },
  { id: "bautismo", nombre: "Bautismo" },
  { id: "comunion", nombre: "Comunión y Confirmación" },
  { id: "bebes", nombre: "Bebés" },
  { id: "embarazo", nombre: "Embarazo" },
  { id: "familia", nombre: "Familia" },
  { id: "egresados", nombre: "Egresados" },
  { id: "playa", nombre: "Vacaciones de playa" },
  { id: "montana", nombre: "Montaña" },
  { id: "nieve", nombre: "Nieve" },
  { id: "europa", nombre: "Europa" },
  { id: "eeuu", nombre: "Estados Unidos" },
  { id: "mascotas", nombre: "Mascotas" },
] as const;

export type TemaId = (typeof TEMAS)[number]["id"];

/**
 * Qué pliego es dentro del libro. El primero abre (lleva el título), el último cierra, y los del
 * medio alternan dos fondos para que el libro no se vea repetido.
 */
export type TipoPliego = "apertura" | "interior" | "interior-alt" | "cierre";

export type Medidas = { anchoMm: number; altoMm: number };

/** Lo que se suma al margen de cada página para que las fotos no pisen los adornos. */
export type Zona = { arriba: number; abajo: number; exterior: number; interior: number };

export type RolTexto = "titulo" | "subtitulo" | "fecha" | "frase";

/** Un título del estilo, con su lugar en el pliego (mm, origen arriba a la izquierda). */
export type TextoDelEstilo = {
  rol: RolTexto;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nombre de familia del catálogo de tipografías del editor (se imprime igual que en pantalla). */
  fuente: string;
  /** Cuerpo, en puntos. */
  puntos: number;
  color: string;
  alineacion?: "left" | "center" | "right";
  negrita?: boolean;
  italica?: boolean;
  mayusculas?: boolean;
  /** Lo que se muestra de ejemplo en el catálogo y como sugerencia al completarlo. */
  ejemplo: string;
};

export type EstiloFotolibro = {
  /** Estable: queda guardado en el libro. `<tema>-<nn>-<nombre>`. */
  id: string;
  tema: TemaId;
  nombre: string;
  descripcion: string;
  /** El color del papel, por si el fondo todavía no está dibujado. */
  papel: string;
  margenMm?: number;
  separacionMm?: number;
  /** Radio de las esquinas de las fotos, en mm (0 = rectas). */
  esquinasMm?: number;
  /** El fondo del pliego, en SVG con viewBox en milímetros. Sin textos: los títulos van aparte. */
  fondo: (tipo: TipoPliego, m: Medidas) => string;
  zona?: (tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>;
  textos?: (tipo: TipoPliego, m: Medidas) => TextoDelEstilo[];
};

export function tipoDePliego(indice: number, cantidad: number): TipoPliego {
  if (indice === 0) return "apertura";
  if (cantidad > 1 && indice === cantidad - 1) return "cierre";
  return indice % 2 === 1 ? "interior" : "interior-alt";
}
