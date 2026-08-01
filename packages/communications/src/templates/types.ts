import type { CommunicationMessage } from "../shared/types";

/**
 * Input público de render/preview en la fachada.
 */
export type EmailTemplateRenderInput = {
  templateId: string;
  brandId: string;
  /** Default: es-AR. Locales desconocidos → LOCALE_NOT_SUPPORTED (sin fallback silencioso). */
  locale?: string;
  data: unknown;
  /** Permite http: en CTAs (tests / preview local). */
  allowHttp?: boolean;
};

/**
 * Resultado de render/preview.
 * ok=true solo si subject/html/text se generaron correctamente.
 */
export type TemplateRenderResult = {
  ok: boolean;
  subject?: string;
  html?: string;
  text?: string;
  templateId?: string;
  brandId?: string;
  locale?: string;
  preheader?: string;
  /** Atajo para communications.send({ message }). */
  message?: CommunicationMessage;
  missingVariables?: string[];
  warnings?: string[];
  errorCode?: string;
  errorMessage?: string;
  /** Alias legible; preferir errorMessage. */
  messageText?: string;
};

/** @deprecated Usar EmailTemplateRenderInput en la fachada. */
export type TemplateRenderContext = EmailTemplateRenderInput;

/** Tipos legacy del stub (aún exportados para compat). */
export interface TemplateLayout {
  id: string;
  key: string;
  description?: string;
}

export interface TemplateComponent {
  id: string;
  key: string;
  description?: string;
}

export interface TemplateHelper {
  name: string;
  description?: string;
  apply: (value: unknown, args?: Record<string, unknown>) => unknown;
}

export interface TemplateBranding {
  id: string;
  key: string;
  product?: string;
}
