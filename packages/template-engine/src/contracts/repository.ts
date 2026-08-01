import type { TemplateDocument } from "../schema/document";

/**
 * Puerto de persistencia. Sin Prisma ni DB en el core.
 */
export interface TemplateRepository {
  getTemplate(id: string): Promise<TemplateDocument | null>;
  saveTemplate(template: TemplateDocument): Promise<void>;
  listTemplates?(query?: { ownerId?: string; status?: string }): Promise<TemplateDocument[]>;
}
