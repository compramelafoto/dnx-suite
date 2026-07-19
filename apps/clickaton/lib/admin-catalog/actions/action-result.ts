import { CatalogValidationError, toSerializableCatalogError } from "../domain/errors";

export type CatalogActionState<T = unknown> = {
  ok: boolean;
  code?: string;
  message?: string;
  errors?: Record<string, string>;
  details?: Record<string, unknown>;
  data?: T;
  /** Valores rehidratados tras error (formularios). */
  values?: Record<string, string>;
};

export function catalogSuccess<T>(data?: T, message?: string): CatalogActionState<T> {
  return { ok: true, data, message };
}

export function catalogFailure<T = unknown>(
  error: unknown,
  values?: Record<string, string>,
): CatalogActionState<T> {
  const serialized = toSerializableCatalogError(error);
  const errors =
    serialized.fieldErrors ??
    (error instanceof CatalogValidationError ? error.fieldErrors : undefined);
  return {
    ok: false,
    code: serialized.code,
    message: serialized.message,
    errors,
    details: serialized.details,
    values,
  };
}

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export function formBool(formData: FormData, key: string, defaultValue = false): boolean {
  const v = formData.get(key);
  if (v === null) return defaultValue;
  if (typeof v === "string") {
    return v === "on" || v === "true" || v === "1";
  }
  return defaultValue;
}
