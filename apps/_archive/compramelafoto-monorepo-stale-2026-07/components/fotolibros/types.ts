export type FitMode = "cover" | "contain";

export type FrameShape = "rect" | "circle" | "triangle" | "pentagon" | "heart";

export type FrameItem = {
  id: string;
  type: "frame";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  imageId?: string;
  fitMode: FitMode;
  imageZoom: number;
  imageRotation?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  /** Forma del encuadre (por defecto rect). */
  shape?: FrameShape;
  /** Opacidad de la imagen (0–1). Por defecto 1. */
  imageOpacity?: number;
  /** Grosor del borde en pt. 0 = sin borde. */
  borderWidth?: number;
  /** Color del borde (hex o CSS). */
  borderColor?: string;
};

/// Texto editable sobre la hoja (como en el editor de polaroids)
export type TextItem = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  rotation: number;
  align: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  width?: number; // ancho máximo para ajuste de línea (opcional)
  /** Separación entre caracteres (px). Por defecto 0. */
  letterSpacing?: number;
  /** Multiplicador de interlineado (ej. 1.5 = 150%). Por defecto 1. */
  lineHeight?: number;
  /** Subrayado. */
  underline?: boolean;
};

export type Spread = {
  id: string;
  items: FrameItem[];
  texts: TextItem[];
  /** Imagen de fondo de la hoja (cover en todo el spread). */
  backgroundImageId?: string;
  /** Color de fondo sólido (hex). Si se combina con imagen, la imagen va encima. */
  backgroundColor?: string;
};

export type AlbumSpec = {
  pageWidth: number;
  pageHeight: number;
  bleed: number;
  safe: number;
};

export type AlbumDocument = {
  id: string;
  title: string;
  spec: AlbumSpec;
  spreads: Spread[];
};

export type ImageAsset = {
  id: string;
  url: string;
  name: string;
  favorite?: boolean;
};
