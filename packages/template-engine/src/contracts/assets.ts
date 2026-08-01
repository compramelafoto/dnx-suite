export type TemplateAssetReference = {
  kind: "IMAGE" | "LOGO" | "FONT" | "OTHER";
  /** Clave de storage o URL lógica. */
  key: string;
  mimeType?: string;
  meta?: Record<string, unknown>;
};

export type ResolvedTemplateAsset = {
  url: string;
  key: string;
  mimeType?: string;
  width?: number;
  height?: number;
};

/**
 * Puerto de resolución de assets (R2/CDN). Sin implementación en el core.
 */
export interface TemplateAssetResolver {
  resolveAsset(asset: TemplateAssetReference): Promise<ResolvedTemplateAsset>;
}
