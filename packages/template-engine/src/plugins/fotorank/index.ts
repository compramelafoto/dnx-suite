import type { TemplateVariablePlugin } from "../../variables/types";
import { FOTORANK_TEMPLATE_VARIABLE_DEFINITIONS } from "./definitions";

export const fotorankTemplateVariablesPlugin: TemplateVariablePlugin = {
  id: "fotorank",
  label: "FotoRank — Diplomas",
  definitions: FOTORANK_TEMPLATE_VARIABLE_DEFINITIONS,
};

export { FOTORANK_TEMPLATE_VARIABLE_DEFINITIONS };
