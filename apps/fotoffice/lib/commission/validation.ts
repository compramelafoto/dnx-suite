/**
 * Lectura y validación de los formularios de la Comisión directiva. Funciones PURAS.
 */

import { isKnownAction } from "@/lib/permissions/actions";

type Fail = { ok: false; error: string };

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function parseRoleForm(
  fd: FormData,
): { ok: true; name: string; description: string | null } | Fail {
  const name = text(fd, "name");
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "El nombre del rol debe tener entre 2 y 60 caracteres." };
  }
  const description = text(fd, "description");
  if (description.length > 200) {
    return { ok: false, error: "La descripción no puede superar los 200 caracteres." };
  }
  return { ok: true, name, description: description || null };
}

export type PermissionLevel = "NONE" | "VIEW" | "MANAGE";

export function parsePermissionGrid(
  fd: FormData,
  editableModuleKeys: readonly string[],
): { moduleKey: string; level: PermissionLevel; actions: string[] }[] {
  return editableModuleKeys.map((moduleKey) => {
    const raw = fd.get(`level:${moduleKey}`);
    const level: PermissionLevel = raw === "VIEW" || raw === "MANAGE" ? raw : "NONE";
    const prefix = `action:${moduleKey}:`;
    const actions =
      level === "MANAGE"
        ? Array.from(fd.keys())
            .filter((k) => k.startsWith(prefix) && k.length > prefix.length)
            .map((k) => k.slice(prefix.length))
            .filter((a) => isKnownAction(moduleKey, a))
        : [];
    return { moduleKey, level, actions: Array.from(new Set(actions)) };
  });
}

export function parseOfficeForm(
  fd: FormData,
): { ok: true; name: string; votes: boolean } | Fail {
  const name = text(fd, "name");
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "El nombre del cargo debe tener entre 2 y 60 caracteres." };
  }
  return { ok: true, name, votes: fd.get("votes") !== null };
}

/** Parsea `YYYY-MM-DD` real; devuelve [año, mes, día] o null. */
function parseDay(value: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return [y, mo, d];
}

// Argentina es UTC−3 todo el año (sin horario de verano).
const AR_OFFSET_HOURS = 3;

export function parseTermDates(
  fd: FormData,
): { ok: true; startsAt: Date | null; endsAt: Date | null } | Fail {
  const rawStart = text(fd, "startsAt");
  const rawEnd = text(fd, "endsAt");
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (rawStart) {
    const d = parseDay(rawStart);
    if (!d) return { ok: false, error: "La fecha de inicio no es válida." };
    startsAt = new Date(Date.UTC(d[0], d[1] - 1, d[2], AR_OFFSET_HOURS, 0, 0, 0));
  }
  if (rawEnd) {
    const d = parseDay(rawEnd);
    if (!d) return { ok: false, error: "La fecha de fin no es válida." };
    endsAt = new Date(Date.UTC(d[0], d[1] - 1, d[2], AR_OFFSET_HOURS + 23, 59, 59, 999));
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };
  }
  return { ok: true, startsAt, endsAt };
}
