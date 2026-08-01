/**
 * Referencia canónica a una variable dinámica.
 * Las formas legacy `{alumno}` / `{student.fullName}` se normalizan aquí.
 */
export type TemplateBindingRef = {
  type: "variable";
  /** Path canónico, p.ej. `student.fullName`. */
  path: string;
  /** Expresión original (trazabilidad), p.ej. `{alumno}`. */
  original: string;
  /** Alias usado si la expresión no era el path canónico. */
  aliasUsed?: string;
  /** Fallback declarativo opcional (legacy `{{key | "—"}}` o override). */
  fallback?: string | null;
  formatter?: string;
};

export type ParseBindingResult =
  | { ok: true; binding: TemplateBindingRef }
  | { ok: false; error: string; original: string };
