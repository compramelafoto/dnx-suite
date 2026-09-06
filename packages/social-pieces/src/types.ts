import type {
  EmitOutcome,
  ResourceResolver,
  VariableContract,
  VariableValues,
} from "@repo/design-studio";
import type { PublishFormat } from "@repo/social-publisher";

export type SocialPieceSpec = {
  /** Identificador estable de la plantilla, p. ej. "clf-album-carousel". */
  pieceId: string;
  format: PublishFormat;
  /** Documento del Designer, crudo: emitDesign lo migra y valida. */
  document: unknown;
  contract: VariableContract;
  values: VariableValues;
  /** Puerto de bytes: el producto entrega las fotos, el Designer no sabe de red. */
  resources: ResourceResolver;
  /** Resolución del raster. Por defecto la del documento. */
  dpi?: number;
};

export type RenderedPiece = {
  fileName: string;
  contentType: "image/jpeg";
  bytes: Uint8Array;
  rendererVersion: string;
  schemaVersion: number;
  resolvedValues: Record<string, string>;
  omittedVariables: string[];
};

/** Puerto de emisión. En producción es emitDesign; en test, una función. */
export type EmitPort = (input: {
  document: unknown;
  contract: VariableContract;
  values: VariableValues;
  resources: ResourceResolver;
  fileBaseName: string;
  pngDpi?: number;
}) => Promise<EmitOutcome>;
