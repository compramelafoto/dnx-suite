import type { CommunicationBrand } from "../branding/types";
import type { LocaleBundle } from "../locales/types";

export const COMMUNICATION_TEMPLATE_IDS = [
  "system.test",
  "user.welcome",
  "ops.daily-report",
] as const;

export type CommunicationTemplateId = (typeof COMMUNICATION_TEMPLATE_IDS)[number];

export type CommunicationTemplatePayloadMap = {
  "system.test": {
    recipientName: string;
    message: string;
    actionLabel?: string;
    actionUrl?: string;
    /** ISO-8601 de generación (smoke). */
    generatedAt?: string;
    /** Identificador de prueba no sensible. */
    testId?: string;
    /** Entorno declarado: development | staging | … */
    environment?: string;
  };
  "user.welcome": {
    recipientName: string;
    platformName: string;
    loginUrl?: string;
    supportUrl?: string;
  };
  "ops.daily-report": {
    /** Fecha del día informado, ya formateada para mostrar (DD/MM/AAAA). */
    reportDate: string;
    /** Estado del informe en texto: Completo / Parcial / Fallido. */
    status: string;
    /** Cantidad de alertas críticas, para el asunto. */
    criticalCount: number;
    /** Bloque de alertas en texto plano (versión para lectores sin HTML). */
    alertsBlock: string;
    /** Bloque de números clave en texto plano. */
    summaryBlock: string;
    /**
     * Mismos bloques ya maquetados en HTML por la app anfitriona.
     *
     * Se insertan sin escapar: la app es responsable de escapar los datos que
     * vienen de la base. Si no se envían, el HTML cae al texto plano dentro de
     * un bloque preformateado.
     */
    alertsHtml?: string;
    summaryHtml?: string;
    /** Enlace al panel con el detalle completo. */
    panelUrl?: string;
    /** Aviso de secciones que no se pudieron generar. */
    failedSectionsNote?: string;
  };
};

export type TemplatePayloadValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export type TemplateRenderContext<TData> = {
  data: TData;
  brand: CommunicationBrand;
  locale: string;
  copy: LocaleBundle;
  /** Permite http: en CTAs (tests). */
  allowHttp?: boolean;
};

export interface CommunicationTemplateDefinition<
  TId extends CommunicationTemplateId = CommunicationTemplateId,
> {
  id: TId;
  channel: "email";
  validate(
    data: unknown,
  ): TemplatePayloadValidationResult<CommunicationTemplatePayloadMap[TId]>;
  renderSubject(
    input: TemplateRenderContext<CommunicationTemplatePayloadMap[TId]>,
  ): string;
  renderHtml(
    input: TemplateRenderContext<CommunicationTemplatePayloadMap[TId]>,
  ): string;
  renderText(
    input: TemplateRenderContext<CommunicationTemplatePayloadMap[TId]>,
  ): string;
  renderPreheader?(
    input: TemplateRenderContext<CommunicationTemplatePayloadMap[TId]>,
  ): string;
}

export type AnyCommunicationTemplateDefinition = {
  id: string;
  channel: "email";
  validate(data: unknown): TemplatePayloadValidationResult<unknown>;
  renderSubject(input: TemplateRenderContext<unknown>): string;
  renderHtml(input: TemplateRenderContext<unknown>): string;
  renderText(input: TemplateRenderContext<unknown>): string;
  renderPreheader?(input: TemplateRenderContext<unknown>): string;
};

export type RegisterTemplateOptions = {
  replace?: boolean;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function requireStringField(
  data: Record<string, unknown>,
  field: string,
  errors: string[],
): string | undefined {
  const value = data[field];
  if (!isNonEmptyString(value)) {
    errors.push(`Campo obligatorio inválido: ${field}`);
    return undefined;
  }
  return value.trim();
}

export function optionalStringField(
  data: Record<string, unknown>,
  field: string,
  errors: string[],
): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    errors.push(`Campo opcional inválido: ${field}`);
    return undefined;
  }
  return value.trim();
}

export function asRecord(data: unknown): Record<string, unknown> | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
}
