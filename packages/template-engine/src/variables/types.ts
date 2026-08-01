export type TemplateVariableValueType =
  | "text"
  | "number"
  | "date"
  | "image"
  | "boolean"
  /** Extensión alineada a V2 (QR como texto URL). */
  | "qrUrl";

export type TemplateVariableUsableIn = "TEXT" | "IMAGE";

export type TemplateVariableDefinition = {
  path: string;
  label: string;
  description?: string;
  valueType: TemplateVariableValueType;
  required?: boolean;
  example?: unknown;
  aliases?: string[];
  /** Formatter por defecto (nombre). */
  formatter?: string;
  /** Formatters permitidos. */
  formatters?: string[];
  usableIn?: TemplateVariableUsableIn[];
  defaultFallback?: string | null;
  group?: string;
  groupLabel?: string;
};

export type TemplateVariablePlugin = {
  id: string;
  label?: string;
  definitions: TemplateVariableDefinition[];
  /** Alias slug → path canónico adicionales del plugin. */
  aliases?: Record<string, string>;
};

export type ResolveVariableStatus =
  | "resolved"
  | "empty"
  | "missing"
  | "unknown"
  | "type_mismatch"
  | "unsafe_path";

export type ResolveVariableResult = {
  status: ResolveVariableStatus;
  path: string;
  value: unknown;
  formatted?: string;
  usedFallback?: boolean;
  aliasUsed?: string;
  definition?: TemplateVariableDefinition;
};
