/** Versión del renderer (bump al cambiar algoritmo de composición). */
export const RENDERER_VERSION = "1.0.0";

export type CompositionPlatform =
  | "CLICKATON"
  | "FOTORANK"
  | "COMPRAMELAFOTO"
  | "INFOSPOT"
  | "DNX";

export type CompositionVariableMap = Record<string, string | number | null | undefined>;

export type CropBox = {
  /** Fracción 0–1 del ancho (origen top-left). */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropParams = {
  cropX: number;
  cropY: number;
  zoom: number;
  rotation: number;
  boundingBox: CropBox | null;
  strategy: "FACE" | "ATTENTION" | "CENTER" | "MANUAL";
};

export type TextBlock = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontWeight?: "normal" | "bold";
  color: string;
  align?: "left" | "center" | "right";
  /** Contenido con placeholders {{var}} */
  content: string;
  maxLines?: number;
};

export type ImageBlock = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clave de variable de asset: photo | logo | background */
  assetKey: string;
  fit?: "cover" | "contain";
  shape?: "rect" | "circle";
  borderColor?: string;
  borderWidth?: number;
};

export type RectBlock = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity?: number;
};

export type CompositionBlock = TextBlock | ImageBlock | RectBlock;

export type CompositionTemplate = {
  id: string;
  name: string;
  version: number;
  platform: CompositionPlatform;
  kind: "WELCOME_STORY" | "POSTER" | "OG" | "CUSTOM";
  width: number;
  height: number;
  background: string;
  blocks: CompositionBlock[];
  variables: string[];
};

export type RenderAssetInputs = {
  photo?: Buffer | null;
  logo?: Buffer | null;
  background?: Buffer | null;
};

export type RenderRequest = {
  template: CompositionTemplate;
  variables: CompositionVariableMap;
  assets: RenderAssetInputs;
  crop?: CropParams | null;
};

export type RenderOutput = {
  png: Buffer;
  webp: Buffer;
  width: number;
  height: number;
  templateId: string;
  templateVersion: number;
  rendererVersion: string;
  contentHash: string;
};

export type ProfilePhotoValidation = {
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  allowedMime: readonly string[];
};
