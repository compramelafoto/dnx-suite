import { CommunicationError } from "../shared/errors";
import type { CommunicationLogger } from "../shared/logger";
import { createCommunicationLogger } from "../shared/logger";
import {
  CommunicationBrandRegistry,
  createBrandRegistry,
  DEFAULT_BRANDS,
} from "./branding/index";
import {
  DEFAULT_TEMPLATES,
  type AnyCommunicationTemplateDefinition,
  type RegisterTemplateOptions,
} from "./definitions/index";
import { resolveLocaleBundle } from "./locales/index";
import {
  CommunicationTemplateRegistry,
  createTemplateRegistry,
} from "./registry";
import type { EmailTemplateRenderInput, TemplateRenderResult } from "./types";

export type EmailTemplateEngineOptions = {
  brandRegistry?: CommunicationBrandRegistry;
  templateRegistry?: CommunicationTemplateRegistry;
  /** Si true (default), registra brands/templates por defecto. */
  registerDefaults?: boolean;
  logger?: CommunicationLogger;
  defaultLocale?: string;
};

/**
 * Motor real de templates email (HTML + texto + subject).
 * Sin React Email / MJML / Handlebars — builder TS + escape.
 */
export class EmailTemplateEngine {
  readonly brands: CommunicationBrandRegistry;
  readonly templates: CommunicationTemplateRegistry;
  private readonly logger: CommunicationLogger;
  private readonly defaultLocale: string;

  constructor(options: EmailTemplateEngineOptions = {}) {
    this.brands = options.brandRegistry ?? createBrandRegistry();
    this.templates = options.templateRegistry ?? createTemplateRegistry();
    this.logger = options.logger ?? createCommunicationLogger();
    this.defaultLocale = options.defaultLocale ?? "es-AR";

    if (options.registerDefaults !== false) {
      if (this.brands.listBrands().length === 0) {
        for (const brand of DEFAULT_BRANDS) {
          this.brands.registerBrand(brand);
        }
      }
      if (this.templates.listTemplates().length === 0) {
        for (const template of DEFAULT_TEMPLATES) {
          this.templates.registerTemplate(template);
        }
      }
    }
  }

  registerTemplate(
    template: AnyCommunicationTemplateDefinition,
    options?: RegisterTemplateOptions,
  ): void {
    this.templates.registerTemplate(template, options);
  }

  getTemplate(id: string): AnyCommunicationTemplateDefinition {
    return this.templates.getTemplate(id);
  }

  hasTemplate(id: string): boolean {
    return this.templates.hasTemplate(id);
  }

  removeTemplate(id: string): boolean {
    return this.templates.removeTemplate(id);
  }

  clearTemplates(): void {
    this.templates.clearTemplates();
  }

  async render(input: EmailTemplateRenderInput): Promise<TemplateRenderResult> {
    return this.renderInternal(input, "render");
  }

  async preview(input: EmailTemplateRenderInput): Promise<TemplateRenderResult> {
    const result = await this.renderInternal(input, "preview");
    if (!result.ok) return result;
    return {
      ...result,
      warnings: [
        ...(result.warnings ?? []),
        "preview: sin side effects de envío; HTML listo para inspección local.",
      ],
    };
  }

  private async renderInternal(
    input: EmailTemplateRenderInput,
    mode: "render" | "preview",
  ): Promise<TemplateRenderResult> {
    const locale = input.locale?.trim() || this.defaultLocale;

    try {
      const template = this.templates.getTemplate(input.templateId);
      const brand = this.brands.getBrand(input.brandId);
      const copy = resolveLocaleBundle(locale);

      const validation = template.validate(input.data);
      if (!validation.ok) {
        return {
          ok: false,
          templateId: input.templateId,
          brandId: input.brandId,
          locale,
          errorCode: "INVALID_TEMPLATE_PAYLOAD",
          errorMessage: validation.errors.join("; "),
          missingVariables: validation.errors,
        };
      }

      const ctx = {
        data: validation.data,
        brand,
        locale,
        copy,
        allowHttp: input.allowHttp,
      };

      const subject = template.renderSubject(ctx);
      const html = template.renderHtml(ctx);
      const text = template.renderText(ctx);
      const preheader = template.renderPreheader?.(ctx);

      if (!subject.trim() || !html.trim() || !text.trim()) {
        return {
          ok: false,
          templateId: template.id,
          brandId: brand.id,
          locale,
          errorCode: "RENDER_FAILED",
          errorMessage: "El template produjo subject/html/text vacío.",
        };
      }

      this.logger.info(`template.${mode}`, {
        templateId: template.id,
        brandId: brand.id,
        locale,
        hasCta: Boolean(
          typeof validation.data === "object" &&
            validation.data &&
            ("actionUrl" in validation.data || "loginUrl" in validation.data),
        ),
      });

      return {
        ok: true,
        subject,
        html,
        text,
        preheader,
        templateId: template.id,
        brandId: brand.id,
        locale,
        message: {
          subject,
          html,
          text,
        },
      };
    } catch (error) {
      if (error instanceof CommunicationError) {
        return {
          ok: false,
          templateId: input.templateId,
          brandId: input.brandId,
          locale,
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido al renderizar";
      this.logger.error(`template.${mode} failed`, { errorCode: "RENDER_FAILED" });
      return {
        ok: false,
        templateId: input.templateId,
        brandId: input.brandId,
        locale,
        errorCode: "RENDER_FAILED",
        errorMessage,
      };
    }
  }
}

export function createEmailTemplateEngine(
  options?: EmailTemplateEngineOptions,
): EmailTemplateEngine {
  return new EmailTemplateEngine(options);
}

/** @deprecated Usar EmailTemplateEngine / createEmailTemplateEngine. */
export type TemplateEngine = EmailTemplateEngine;

/** @deprecated Alias de createEmailTemplateEngine. */
export function createStubTemplateEngine(): EmailTemplateEngine {
  return createEmailTemplateEngine();
}

/** @deprecated Alias histórico. */
export const StubTemplateEngine = EmailTemplateEngine;
