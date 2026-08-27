import type { TemplateVariablePlugin } from "../../variables/types";
import {
  SPONSOR_TEMPLATE_ALIASES,
  SPONSOR_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./sponsor-variable-definitions";

export {
  SPONSOR_TEMPLATE_ALIASES,
  SPONSOR_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./sponsor-variable-definitions";

export const sponsorTemplateVariablesPlugin: TemplateVariablePlugin = {
  id: "sponsor",
  label: "Sponsors",
  definitions: SPONSOR_TEMPLATE_VARIABLE_DEFINITIONS,
  aliases: SPONSOR_TEMPLATE_ALIASES,
};
