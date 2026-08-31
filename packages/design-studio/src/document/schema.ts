/**
 * El documento neutral. Es lo único que el editor produce y lo único que el renderizador
 * consume. No contiene estructuras de ninguna librería de edición: cambiar react-rnd por
 * otra cosa no debe obligar a migrar una sola plantilla.
 *
 * Coordenadas: origen arriba a la izquierda, `y` hacia abajo.
 * Unidades: milímetros si `format.medium` es PRINT, píxeles si es SCREEN.
 */

export const DESIGN_SCHEMA_VERSION = 1;

export type DesignMedium = "PRINT" | "SCREEN";

export type DesignFormat = {
  medium: DesignMedium;
  /** mm en PRINT, px en SCREEN */
  width: number;
  height: number;
  /** Solo PRINT: densidad a la que se rasteriza. Obligatorio en PRINT. */
  dpi?: number;
  /** Solo PRINT: milímetros de sangrado por lado. */
  bleedMm?: number;
  /** Solo PRINT: milímetros de margen seguro por lado. */
  safeAreaMm?: number;
};

/** Metadatos de capa del editor. Solo `hidden` afecta al dibujo. */
export type BlockChrome = {
  locked?: boolean;
  hidden?: boolean;
  layerName?: string;
};

export type BlockGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Grados en sentido horario alrededor del centro de la caja. */
  rotation?: number;
  /** 0 a 1. */
  opacity?: number;
};

export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold";
export type FontStyle = "normal" | "italic";

export type TextBlock = BlockGeometry &
  BlockChrome & {
    type: "text";
    fontId: string;
    /** Cuerpo tipográfico en PUNTOS, en los dos medios. No en las unidades del documento. */
    fontSize: number;
    fontWeight?: FontWeight;
    fontStyle?: FontStyle;
    color: string;
    align?: TextAlign;
    /** Texto fijo o con marcadores `{{clave}}` declarados en el contrato de variables. */
    content: string;
    /** Si el texto no entra en estas líneas, la validación de publicación lo rechaza. */
    maxLines?: number;
  };

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export type QrBlock = BlockGeometry &
  BlockChrome & {
    type: "qrcode";
    /** Clave de la variable de tipo `qrPayload` que trae la URL corta o el token. */
    variableKey: string;
    errorCorrection: QrErrorCorrection;
    /** Módulos de zona de silencio por lado. El estándar recomienda 4. */
    quietZoneModules: number;
    darkColor?: string;
    lightColor?: string;
  };

export type ImageFit = "cover" | "contain";

/**
 * Forma con la que se recorta la imagen.
 *
 * Existe porque una foto de socio dentro de un círculo es una petición corriente y hasta ahora
 * el editor la ofrecía sin que llegara al papel: se elegía "circular" y la credencial salía
 * cuadrada igual. Una opción que no cambia nada es peor que no tenerla.
 */
export type ImageMask = "rect" | "circle" | "ellipse";

export type ImageBlock = BlockGeometry &
  BlockChrome & {
    type: "image";
    /**
     * Referencia de recurso que el producto resuelve a bytes, o clave de una variable de
     * tipo `image`. Exactamente una de las dos.
     */
    resourceRef?: string;
    variableKey?: string;
    fit: ImageFit;
    /** Por omisión rectangular, que es no recortar nada. */
    mask?: ImageMask;
    /** Solo con `mask: "rect"`. Radio de esquina, en las unidades del documento. */
    cornerRadius?: number;
  };

export type LineBlock = BlockGeometry &
  BlockChrome & {
    type: "line";
    strokeColor: string;
    strokeWidth: number;
  };

export type RectBlock = BlockGeometry &
  BlockChrome & {
    type: "rect";
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    /** Radio de esquina, en las unidades del documento. */
    cornerRadius?: number;
  };

export type DesignBlock = TextBlock | QrBlock | ImageBlock | LineBlock | RectBlock;

export type DesignSide = {
  id: string;
  name: string;
  background: string;
  blocks: DesignBlock[];
};

export type DesignDocument = {
  schemaVersion: number;
  metadata: { name: string; description?: string };
  format: DesignFormat;
  /** Arreglo, no campos por cara: así el fotolibro entra después sin rediseñar el esquema. */
  sides: DesignSide[];
};

export const BLOCK_TYPES = ["text", "qrcode", "image", "line", "rect"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
