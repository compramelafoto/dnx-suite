import { CommunicationError } from "../shared/errors";
import type {
  AnyCommunicationTemplateDefinition,
  RegisterTemplateOptions,
} from "./definitions/types";

/**
 * Registry aislable de templates (mismo patrón que providers).
 */
export class CommunicationTemplateRegistry {
  private readonly templates = new Map<string, AnyCommunicationTemplateDefinition>();

  registerTemplate(
    template: AnyCommunicationTemplateDefinition,
    options: RegisterTemplateOptions = {},
  ): void {
    const id = template.id?.trim();
    if (!id) {
      throw new CommunicationError("INVALID_TEMPLATE", "template.id es obligatorio.");
    }
    if (template.channel !== "email") {
      throw new CommunicationError(
        "CHANNEL_NOT_SUPPORTED",
        `Solo se admiten templates channel=email en etapa 02 (recibido: ${template.channel}).`,
      );
    }
    if (this.templates.has(id) && !options.replace) {
      throw new CommunicationError(
        "TEMPLATE_ALREADY_REGISTERED",
        `Template "${id}" ya registrado. Usá { replace: true }.`,
        { templateId: id },
      );
    }
    this.templates.set(id, template);
  }

  getTemplate(id: string): AnyCommunicationTemplateDefinition {
    const template = this.templates.get(id);
    if (!template) {
      throw new CommunicationError(
        "TEMPLATE_NOT_FOUND",
        `Template inexistente: "${id}".`,
        { templateId: id },
      );
    }
    return template;
  }

  tryGetTemplate(id: string): AnyCommunicationTemplateDefinition | undefined {
    return this.templates.get(id);
  }

  hasTemplate(id: string): boolean {
    return this.templates.has(id);
  }

  removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  clearTemplates(): void {
    this.templates.clear();
  }

  listTemplates(): ReadonlyArray<{ id: string; channel: "email" }> {
    return [...this.templates.values()].map((template) => ({
      id: template.id,
      channel: "email",
    }));
  }
}

export function createTemplateRegistry(
  seed: AnyCommunicationTemplateDefinition[] = [],
): CommunicationTemplateRegistry {
  const registry = new CommunicationTemplateRegistry();
  for (const template of seed) {
    registry.registerTemplate(template);
  }
  return registry;
}
