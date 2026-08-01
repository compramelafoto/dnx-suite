import { DANGEROUS_PATH_SEGMENTS } from "../core/constants";
import { isDangerousPath, isValidVariablePath } from "../bindings/parse";

export type SafeGetResult =
  | { ok: true; found: true; value: unknown }
  | { ok: true; found: false; value: undefined }
  | { ok: false; error: "unsafe_path" | "invalid_path" };

/**
 * Lectura segura de paths anidados. Bloquea prototype pollution.
 * Soporta data anidada `{ student: { fullName } }` y plana `{ "student.fullName": ... }`.
 */
export function safeGetByPath(data: unknown, path: string): SafeGetResult {
  if (!isValidVariablePath(path)) {
    return { ok: false, error: isDangerousPath(path) ? "unsafe_path" : "invalid_path" };
  }

  if (data == null || typeof data !== "object") {
    return { ok: true, found: false, value: undefined };
  }

  const root = data as Record<string, unknown>;

  // Flat key exacto
  if (Object.prototype.hasOwnProperty.call(root, path)) {
    return { ok: true, found: true, value: root[path] };
  }

  const segments = path.split(".");
  let current: unknown = root;

  for (const segment of segments) {
    if (DANGEROUS_PATH_SEGMENTS.has(segment)) {
      return { ok: false, error: "unsafe_path" };
    }
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return { ok: true, found: false, value: undefined };
    }
    const obj = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(obj, segment)) {
      return { ok: true, found: false, value: undefined };
    }
    current = obj[segment];
  }

  return { ok: true, found: true, value: current };
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}
