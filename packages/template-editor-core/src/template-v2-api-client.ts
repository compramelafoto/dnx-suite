/**
 * Cliente thin para APIs Template V2 restauradas (P0-03).
 * No reescribe el editor; útil para flujos controlados / tests.
 */

export type TemplateV2ApiEnvelope<T> = T & { ok?: boolean; error?: string; code?: string };

async function parseJson<T>(res: Response): Promise<TemplateV2ApiEnvelope<T>> {
  const data = (await res.json().catch(() => ({}))) as TemplateV2ApiEnvelope<T>;
  return data;
}

export async function apiListTemplates(query?: Record<string, string>) {
  const qs = new URLSearchParams(query ?? {}).toString();
  const res = await fetch(`/api/template-v2/templates${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  return { res, data: await parseJson<{ items: unknown[]; pagination: unknown }>(res) };
}

export async function apiCreateTemplate(body?: Record<string, unknown>) {
  const res = await fetch("/api/template-v2/templates", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return {
    res,
    data: await parseJson<{ templateId?: string; versionId?: string }>(res),
  };
}

export async function apiGetTemplate(templateId: string) {
  const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  return { res, data: await parseJson<{ template?: unknown; legacy?: unknown }>(res) };
}

export async function apiLoadEditorVersion(templateId: string, versionId: string) {
  const res = await fetch(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/save`,
    { credentials: "include", cache: "no-store" }
  );
  return { res, data: await parseJson<Record<string, unknown>>(res) };
}

export async function apiSaveEditorVersion(
  templateId: string,
  versionId: string,
  payload: unknown
) {
  const res = await fetch(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/save`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return { res, data: await parseJson<{ revision?: number; updatedAt?: string }>(res) };
}

export async function apiValidateTemplate(
  templateId: string,
  draft?: unknown
) {
  const res = await fetch(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/validate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft ?? {}),
    }
  );
  return {
    res,
    data: await parseJson<{
      valid?: boolean;
      errors?: unknown[];
      warnings?: unknown[];
    }>(res),
  };
}
