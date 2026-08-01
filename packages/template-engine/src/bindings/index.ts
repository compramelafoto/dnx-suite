export type { TemplateBindingRef, ParseBindingResult } from "./types";
export {
  BRACE_TOKEN_RE,
  DOUBLE_BRACE_TOKEN_RE,
  parseTemplateBinding,
  isTemplateBinding,
  isDangerousPath,
  isValidVariablePath,
  normalizeBraceSlug,
} from "./parse";
export { normalizeTemplateBinding, type NormalizeBindingOptions } from "./normalize";
export { serializeTemplateBinding, braceSnippetForPath } from "./serialize";
