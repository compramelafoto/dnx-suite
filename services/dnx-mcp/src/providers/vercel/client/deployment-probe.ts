import {
  buildProtectionBypassHeaders,
  protectionBypassStatus,
  type ProtectionBypassResolution,
} from "./protection-bypass.js";

export type DeploymentProbeMethod = "GET" | "HEAD" | "POST";

export interface DeploymentProbeRequest {
  url: string;
  method?: DeploymentProbeMethod;
  /** Status HTTP esperado. Si se omite, cualquier 2xx cuenta como ok. */
  expectedStatus?: number;
  headers?: Record<string, string>;
  body?: string;
  /** Timeout en ms. Default 15_000. */
  timeoutMs?: number;
  /** Si false, no inyecta bypass aunque exista secret. Default true. */
  applyBypass?: boolean;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

export interface DeploymentProbeResult {
  url: string;
  method: DeploymentProbeMethod;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  /** Primeros chars del body (sin secret). */
  bodyPreview: string;
  /** True si la respuesta parece gate de Deployment Protection. */
  protectionBlocked: boolean;
  bypassApplied: boolean;
  error: string | null;
  expectedStatus: number | null;
}

export interface SmokeProbeSpec {
  id: string;
  name: string;
  /** URL absoluta o path relativo a baseUrl. */
  target: string;
  type?: "http" | "cli" | "mcp";
  method?: DeploymentProbeMethod;
  expectedStatus?: number;
}

export interface HealthProbeSpec {
  name: string;
  url: string;
  method?: DeploymentProbeMethod;
  expectedStatus?: number;
}

const PROTECTION_MARKERS = [
  "protected deployment",
  "vercel_auth_enabled",
  "login – vercel",
  "login - vercel",
  "vercel.com/sso-api",
] as const;

function normalizeDeploymentUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url.replace(/^\/+/, "")}`;
}

export function resolveProbeUrl(baseUrl: string, target: string): string {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return target;
  }
  const base = normalizeDeploymentUrl(baseUrl).replace(/\/+$/, "");
  const path = target.startsWith("/") ? target : `/${target}`;
  return `${base}${path}`;
}

function previewBody(text: string, max = 240): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function detectProtectionBlock(
  status: number | null,
  body: string,
  contentType: string | null,
): boolean {
  const lower = body.toLowerCase();
  if (PROTECTION_MARKERS.some((m) => lower.includes(m))) {
    return true;
  }
  if (status === 401 && lower.includes("protection")) {
    return true;
  }
  if (
    contentType?.includes("text/html") &&
    lower.includes("<!doctype html") &&
    lower.includes("vercel")
  ) {
    return true;
  }
  return false;
}

/**
 * Probe HTTP contra una URL de deployment (preview).
 * Inyecta `x-vercel-protection-bypass` si `VERCEL_AUTOMATION_BYPASS_SECRET` está definido.
 */
export async function probeDeploymentUrl(
  request: DeploymentProbeRequest,
): Promise<DeploymentProbeResult> {
  const method = request.method ?? "GET";
  const url = normalizeDeploymentUrl(request.url);
  const applyBypass = request.applyBypass !== false;
  const env = request.env ?? process.env;
  const bypassHeaders = applyBypass ? buildProtectionBypassHeaders({ env }) : {};
  const bypassApplied = Object.keys(bypassHeaders).length > 0;
  const finalHeaders = {
    ...(request.headers ?? {}),
    ...bypassHeaders,
  };

  const fetchImpl = request.fetchImpl ?? fetch;
  const timeoutMs = request.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const init: RequestInit = {
      method,
      headers: finalHeaders,
      redirect: "manual",
      signal: controller.signal,
    };
    if (request.body !== undefined && method !== "GET" && method !== "HEAD") {
      init.body = request.body;
    }

    const response = await fetchImpl(url, init);
    const contentType = response.headers.get("content-type");
    const text = await response.text().catch(() => "");
    const bodyPreview = previewBody(text);
    const protectionBlocked = detectProtectionBlock(response.status, text, contentType);

    let ok: boolean;
    if (request.expectedStatus !== undefined) {
      ok = response.status === request.expectedStatus;
    } else {
      ok = response.status >= 200 && response.status < 300;
    }

    // Redirect SSO sin follow = protection
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "";
      if (location.includes("vercel.com/sso") || location.includes("sso-api")) {
        return {
          url,
          method,
          ok: false,
          status: response.status,
          contentType,
          bodyPreview,
          protectionBlocked: true,
          bypassApplied,
          error: "Redirect a Vercel SSO (Deployment Protection).",
          expectedStatus: request.expectedStatus ?? null,
        };
      }
    }

    return {
      url,
      method,
      ok: ok && !protectionBlocked,
      status: response.status,
      contentType,
      bodyPreview,
      protectionBlocked,
      bypassApplied,
      error: protectionBlocked
        ? "Respuesta bloqueada por Deployment Protection."
        : ok
          ? null
          : `Status ${String(response.status)} no esperado` +
            (request.expectedStatus !== undefined
              ? ` (esperado ${String(request.expectedStatus)})`
              : ""),
      expectedStatus: request.expectedStatus ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      method,
      ok: false,
      status: null,
      contentType: null,
      bodyPreview: "",
      protectionBlocked: false,
      bypassApplied,
      error: message,
      expectedStatus: request.expectedStatus ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface DeploymentProbeSuiteResult {
  baseUrl: string;
  bypass: { enabled: boolean; header: string };
  probes: DeploymentProbeResult[];
  passed: boolean;
  issues: string[];
}

/**
 * Ejecuta health + smoke HTTP contra el baseUrl del deployment preview.
 * Paths relativos se resuelven contra baseUrl; URLs absolutas se usan tal cual
 * (útil para catálogo), pero el bypass se aplica siempre a todos los probes.
 */
export async function runDeploymentHttpProbes(options: {
  baseUrl: string;
  healthEndpoints?: HealthProbeSpec[];
  smokeTests?: SmokeProbeSpec[];
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<DeploymentProbeSuiteResult> {
  const baseUrl = normalizeDeploymentUrl(options.baseUrl);
  const env = options.env ?? process.env;
  const bypass = protectionBypassStatus(env);
  const probes: DeploymentProbeResult[] = [];
  const issues: string[] = [];

  for (const health of options.healthEndpoints ?? []) {
    // Solo health endpoints cuyo host coincida con el deployment, o paths relativos.
    // Evita pegarle a producción (p.ej. compramelafoto.com) desde validate staging.
    const absolute = health.url.startsWith("http");
    if (absolute) {
      try {
        const healthHost = new URL(health.url).host;
        const baseHost = new URL(baseUrl).host;
        if (healthHost !== baseHost) {
          continue;
        }
      } catch {
        continue;
      }
    }

    const url = absolute ? health.url : resolveProbeUrl(baseUrl, health.url);
    const result = await probeDeploymentUrl({
      url,
      method: health.method ?? "GET",
      expectedStatus: health.expectedStatus ?? 200,
      env,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
    probes.push(result);
    if (!result.ok) {
      issues.push(
        `Health "${health.name}" falló: ${result.error ?? `status ${String(result.status)}`}`,
      );
    }
  }

  for (const smoke of options.smokeTests ?? []) {
    if (smoke.type && smoke.type !== "http") {
      continue;
    }
    const absolute = smoke.target.startsWith("http");
    let url: string;
    if (absolute) {
      // Reescribir host del catálogo (preview.dominio) al deployment URL real.
      try {
        const targetUrl = new URL(smoke.target);
        const base = new URL(baseUrl);
        targetUrl.protocol = base.protocol;
        targetUrl.host = base.host;
        url = targetUrl.toString();
      } catch {
        url = resolveProbeUrl(baseUrl, smoke.target);
      }
    } else {
      url = resolveProbeUrl(baseUrl, smoke.target);
    }

    const result = await probeDeploymentUrl({
      url,
      method: smoke.method ?? "GET",
      env,
      ...(smoke.expectedStatus !== undefined ? { expectedStatus: smoke.expectedStatus } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
    probes.push(result);
    if (!result.ok) {
      issues.push(
        `Smoke "${smoke.id}" (${smoke.name}) falló: ${result.error ?? `status ${String(result.status)}`}`,
      );
    }
  }

  return {
    baseUrl,
    bypass: { enabled: bypass.enabled, header: bypass.header },
    probes,
    passed: issues.length === 0,
    issues,
  };
}

/** Re-export útil para callers que solo necesitan saber si hay secret. */
export type { ProtectionBypassResolution };
