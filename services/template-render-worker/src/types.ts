import { z } from "zod";

export const templateRenderOutputSchema = z.object({
  format: z.literal("png"),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
});

export const templateRenderRequestSchema = z.object({
  requestId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  templateKey: z.string().optional(),
  templateVersion: z.string().optional(),
  rendererVersion: z.string().optional(),
  templateDocument: z.record(z.string(), z.unknown()).optional(),
  document: z.record(z.string(), z.unknown()),
  output: templateRenderOutputSchema.default({ format: "png" }),
});

export type TemplateRenderRequestBody = z.infer<typeof templateRenderRequestSchema>;

export type TemplateRenderSuccessResponse = {
  ok: true;
  pngBase64: string;
  width: number;
  height: number;
  durationMs: number;
  mimeType: "image/png";
  cached?: boolean;
};

export type TemplateRenderErrorResponse = {
  ok: false;
  error: string;
  code?: string;
};

export const RENDERER_VERSION = "template-engine-renderer:1";
