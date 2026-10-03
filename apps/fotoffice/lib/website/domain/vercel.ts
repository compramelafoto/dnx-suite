import "server-only";
import { resolve4 } from "node:dns/promises";
import { VERCEL_APEX_IP, type DnsRecord } from "./dns-records";

/**
 * Conexión con la API de Vercel para agregar/quitar/comprobar el dominio propio en el proyecto
 * de FOTOFFICE. Sin `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` no se rompe nada: la pantalla
 * avisa que falta y la comprobación cae a una consulta DNS directa.
 */

type VercelConfig = { token: string; projectId: string; teamId: string | null };

export function vercelConfig(): VercelConfig | null {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID?.trim() || null };
}

async function vercelFetch(cfg: VercelConfig, path: string, init?: RequestInit) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (cfg.teamId) url.searchParams.set("teamId", cfg.teamId);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

function errorCode(body: Record<string, unknown>): string {
  const err = body.error as { code?: string; message?: string } | undefined;
  return err?.code ?? "";
}

export type VercelResult = { ok: true } | { ok: false; error: string };

/** Agrega `domain` y `www.domain` (este último redirige al primero). Repetir no hace daño. */
export async function addDomainToVercel(domain: string): Promise<VercelResult> {
  const cfg = vercelConfig();
  if (!cfg) return { ok: false, error: "Falta conectar FOTOFFICE con Vercel (VERCEL_API_TOKEN)." };
  const project = encodeURIComponent(cfg.projectId);

  for (const payload of [{ name: domain }, { name: `www.${domain}`, redirect: domain, redirectStatusCode: 308 }]) {
    const res = await vercelFetch(cfg, `/v10/projects/${project}/domains`, { method: "POST", body: JSON.stringify(payload) });
    if (res.ok) continue;
    const code = errorCode(res.body);
    // Ya estaba en ESTE proyecto: es lo que queríamos.
    if (res.status === 409 && code === "domain_already_in_project") continue;
    if (code === "domain_already_in_use" || code === "domain_taken") {
      return { ok: false, error: `${payload.name} ya está usado en otra cuenta de Vercel. Hay que liberarlo allá primero.` };
    }
    return { ok: false, error: `Vercel no aceptó ${payload.name} (${code || res.status}).` };
  }
  return { ok: true };
}

export async function removeDomainFromVercel(domain: string): Promise<VercelResult> {
  const cfg = vercelConfig();
  if (!cfg) return { ok: true };
  const project = encodeURIComponent(cfg.projectId);
  for (const name of [`www.${domain}`, domain]) {
    const res = await vercelFetch(cfg, `/v9/projects/${project}/domains/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return { ok: false, error: `Vercel no dejó quitar ${name} (${errorCode(res.body) || res.status}).` };
  }
  return { ok: true };
}

export type DomainCheck = {
  connected: boolean;
  /** Qué falta, en lenguaje claro. null si está conectado. */
  problem: string | null;
  /** Registros extra que pide Vercel (ej. TXT de verificación si el dominio estuvo en otra cuenta). */
  extraRecords: DnsRecord[];
  apexIp?: string;
};

/** Pregunta a Vercel; sin token, mira el DNS directamente. */
export async function checkDomain(domain: string): Promise<DomainCheck> {
  const cfg = vercelConfig();
  if (!cfg) return checkDnsDirectly(domain);
  const project = encodeURIComponent(cfg.projectId);

  const [projectDomain, config] = await Promise.all([
    vercelFetch(cfg, `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`),
    vercelFetch(cfg, `/v6/domains/${encodeURIComponent(domain)}/config`),
  ]);
  if (projectDomain.status === 404) {
    return { connected: false, problem: "El dominio no está agregado en Vercel. Tocá «Reintentar conexión».", extraRecords: [] };
  }
  if (!projectDomain.ok) return checkDnsDirectly(domain);

  const verification = (projectDomain.body.verification as { type?: string; domain?: string; value?: string }[] | undefined) ?? [];
  const extraRecords: DnsRecord[] = verification
    .filter((v) => v.type && v.domain && v.value)
    .map((v) => ({
      type: (v.type === "TXT" ? "TXT" : v.type === "CNAME" ? "CNAME" : "A") as DnsRecord["type"],
      name: v.domain!.endsWith(`.${domain}`) ? v.domain!.slice(0, -domain.length - 1) : v.domain!,
      value: v.value!,
      note: "Verificación que pide Vercel porque el dominio estuvo en otra cuenta.",
    }));

  const recommended = config.body.recommendedIPv4 as { rank?: number; value?: string[] }[] | undefined;
  const apexIp = recommended?.find((r) => r.rank === 1)?.value?.[0];

  const verified = projectDomain.body.verified === true;
  const misconfigured = config.ok ? config.body.misconfigured === true : true;
  if (verified && !misconfigured) return { connected: true, problem: null, extraRecords, apexIp };

  if (!verified) {
    return { connected: false, problem: "Falta el registro de verificación que figura abajo.", extraRecords, apexIp };
  }
  return {
    connected: false,
    problem: "El dominio todavía no apunta a FOTOFFICE. Si ya cambiaste los registros, puede tardar hasta unas horas.",
    extraRecords,
    apexIp,
  };
}

async function checkDnsDirectly(domain: string): Promise<DomainCheck> {
  try {
    const ips = await resolve4(domain);
    if (ips.includes(VERCEL_APEX_IP)) return { connected: true, problem: null, extraRecords: [] };
    return {
      connected: false,
      problem: `El dominio todavía apunta a ${ips.join(", ")}. Tiene que apuntar a ${VERCEL_APEX_IP}.`,
      extraRecords: [],
    };
  } catch {
    return { connected: false, problem: "No encontramos el dominio en el DNS todavía.", extraRecords: [] };
  }
}
