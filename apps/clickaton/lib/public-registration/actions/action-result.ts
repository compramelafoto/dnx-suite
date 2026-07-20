import {
  PublicRegistrationValidationError,
  toSerializablePublicRegistrationError,
} from "../domain/errors";

export type PublicRegistrationActionState<T = unknown> = {
  ok: boolean;
  code?: string;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
  values?: Record<string, string>;
};

export function pubSuccess<T>(data?: T, message?: string): PublicRegistrationActionState<T> {
  return { ok: true, data, message };
}

export function pubFailure<T = unknown>(
  error: unknown,
  values?: Record<string, string>,
): PublicRegistrationActionState<T> {
  const serialized = toSerializablePublicRegistrationError(error);
  return {
    ok: false,
    code: serialized.code,
    message: serialized.message,
    errors:
      serialized.fieldErrors ??
      (error instanceof PublicRegistrationValidationError ? error.fieldErrors : undefined),
    values,
  };
}

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export function formBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}
