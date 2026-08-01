import type { TemplateVariablePlugin } from "../../variables/types";
import { CLICKATON_TEMPLATE_ALIASES } from "./clickaton-aliases";
import { CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS } from "./clickaton-variable-definitions";

export { CLICKATON_TEMPLATE_ALIASES } from "./clickaton-aliases";
export { CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS } from "./clickaton-variable-definitions";
export {
  createClickatonTemplateExampleData,
  CLICKATON_TEMPLATE_EXAMPLE_DATA,
  CLICKATON_FIXTURE_PHOTO_DATA_URL,
} from "./clickaton-example-data";
export { normalizeInstagramHandle } from "./normalize-instagram";
export type { NormalizeInstagramResult } from "./normalize-instagram";
export {
  CLICKATON_DEFAULT_TIMEZONE,
  CLICKATON_FORMATTER_NAMES,
  formatDateDayMonthUppercase,
  formatDateLong,
  formatDateLongUppercase,
  formatDateShort,
  formatParticipantNumber,
  toZonedCalendarParts,
} from "./clickaton-formatters";

export const clickatonTemplateVariablesPlugin: TemplateVariablePlugin = {
  id: "clickaton",
  label: "Clickatón",
  definitions: CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS,
  aliases: CLICKATON_TEMPLATE_ALIASES,
};
