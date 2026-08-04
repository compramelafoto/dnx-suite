/**
 * Guard y utilidades comunes de las APIs admin del CMS Clickatón.
 *
 * `requireClickatonAdmin` (páginas) redirige; en API hace falta JSON, así que
 * se replica el mismo criterio de acceso con `getClickatonAuthUser` +
 * `hasClickatonAdminAccess`, igual que las rutas de participant-cards.
 */
import { NextResponse } from "next/server";
import { getClickatonAuthUser, type ClickatonAuthUser } from "@/lib/admin/auth";
import { hasClickatonAdminAccess } from "@/lib/admin/access";

export type ContentAdminGuardResult =
  | { user: ClickatonAuthUser; response: null }
  | { user: null; response: NextResponse };

export async function requireContentAdminApi(): Promise<ContentAdminGuardResult> {
  const user = await getClickatonAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "No autenticado", code: "CLICKATON_CONTENT_UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }
  if (!hasClickatonAdminAccess({ email: user.email, globalRole: user.globalRole })) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Sin permisos administrativos", code: "CLICKATON_CONTENT_FORBIDDEN" },
        { status: 403 },
      ),
    };
  }
  return { user, response: null };
}

export function parseRouteId(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export function parseListLimit(
  value: string | null | undefined,
  fallback = 50,
  max = 200,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

export function trimOptionalFormValue(
  value: FormDataEntryValue | null,
  max: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeOptionalString(
  value: string | null | undefined,
  max: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export type OptionalTextResult =
  | { ok: true; value: string | null | undefined }
  | { ok: false; field: string };

/**
 * Lee un campo de texto opcional de un payload JSON sin depender de zod
 * (clickaton no lo tiene como dependencia directa).
 */
export function readOptionalText(
  body: Record<string, unknown>,
  field: string,
  max: number,
): OptionalTextResult {
  const raw = body[field];
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, field };
  return { ok: true, value: normalizeOptionalString(raw, max) };
}
