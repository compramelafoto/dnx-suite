import type { TemplateVariablePlugin } from "../../variables/types";
import { FOTOFFICE_TEMPLATE_VARIABLE_DEFINITIONS } from "./definitions";

export const fotofficeTemplateVariablesPlugin: TemplateVariablePlugin = {
  id: "fotoffice",
  label: "FotoOffice — Socios",
  definitions: FOTOFFICE_TEMPLATE_VARIABLE_DEFINITIONS,
};

export { FOTOFFICE_TEMPLATE_VARIABLE_DEFINITIONS };
