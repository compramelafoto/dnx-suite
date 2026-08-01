import type { APIRequestContext } from "@playwright/test";
import { apiDeleteTemplate } from "./api";

const tracked = new Set<string>();

export function trackTemplateId(id: string | undefined | null) {
  if (id) tracked.add(id);
}

export function trackedTemplateIds(): string[] {
  return [...tracked];
}

export async function cleanupTrackedTemplates(request: APIRequestContext): Promise<void> {
  const ids = [...tracked];
  tracked.clear();
  for (const id of ids) {
    try {
      await apiDeleteTemplate(request, id);
    } catch {
      // best-effort
    }
  }
}

/** Limpia plantillas E2E por prefijo vía listado del owner autenticado. */
export async function cleanupE2ETemplatesByPrefix(
  request: APIRequestContext,
  prefix: string
): Promise<number> {
  const res = await request.get(
    `/api/template-v2/templates?scope=mine&pageSize=50&q=${encodeURIComponent(prefix)}`
  );
  if (!res.ok()) return 0;
  const body = (await res.json()) as { items?: Array<{ id: string; name?: string }> };
  let n = 0;
  for (const item of body.items ?? []) {
    if (!item.name?.startsWith(prefix) && !item.name?.includes("E2E TEMPLATE V2")) continue;
    const del = await apiDeleteTemplate(request, item.id);
    if (del.status < 400) n += 1;
  }
  return n;
}
