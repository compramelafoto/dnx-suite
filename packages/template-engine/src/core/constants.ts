/** Versión del schema canónico TemplateDocument. Bump solo con cambios incompatibles. */
export const TEMPLATE_SCHEMA_VERSION = 1 as const;

/** Versiones de schema aceptadas por el parser actual. */
export const SUPPORTED_TEMPLATE_SCHEMA_VERSIONS = [1] as const;

export const DANGEROUS_PATH_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Formatters reconocidos por el core (escolares + Clickatón). */
export const KNOWN_FORMATTERS = [
  "none",
  "uppercase",
  "titleCase",
  "truncate",
  "date.short",
  "date.long",
  "date.longUppercase",
  "date.dayMonthUppercase",
  "participantNumber",
] as const;

export type KnownFormatter = (typeof KNOWN_FORMATTERS)[number];
