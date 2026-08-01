import type { ResolvedTemplateDocument } from "../schema/document";

export type TemplateRenderFormat = "png" | "jpeg" | "webp" | "pdf";

export type TemplateRenderResult = {
  format: TemplateRenderFormat;
  /** Bytes del artefacto (Node Buffer o Uint8Array). */
  bytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  pageIndex?: number;
};

/**
 * Puerto de render. Implementaciones futuras: DOM/browser, Sharp, headless.
 * El core no implementa ni importa Sharp/Next/React.
 */
export interface TemplateRenderer {
  render(
    input: ResolvedTemplateDocument,
    options?: { format?: TemplateRenderFormat; pageIndex?: number }
  ): Promise<TemplateRenderResult>;
}
