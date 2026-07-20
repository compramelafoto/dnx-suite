import {
  AdminRegistrationValidationError,
  toSerializableAdminRegistrationError,
} from "../domain/errors";

export type AdminRegistrationActionState<T = unknown> = {
  ok: boolean;
  code?: string;
  message?: string;
  errors?: Record<string, string>;
  details?: Record<string, unknown>;
  data?: T;
  values?: Record<string, string>;
};

export function regSuccess<T>(data?: T, message?: string): AdminRegistrationActionState<T> {
  return { ok: true, data, message };
}

export function regFailure<T = unknown>(
  error: unknown,
  values?: Record<string, string>,
): AdminRegistrationActionState<T> {
  const serialized = toSerializableAdminRegistrationError(error);
  return {
    ok: false,
    code: serialized.code,
    message: serialized.message,
    errors:
      serialized.fieldErrors ??
      (error instanceof AdminRegistrationValidationError ? error.fieldErrors : undefined),
    details: serialized.details,
    values,
  };
}

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}
