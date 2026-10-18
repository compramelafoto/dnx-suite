import "server-only";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { aCobroMp, consultaCobros, type CobroMp } from "./mp-cobros";

export type ResultadoCobrosMp =
  | { ok: true; cobros: CobroMp[] }
  | { ok: false; motivo: "SIN_CONEXION" | "RECONECTAR" | "ERROR_MP" };

/**
 * Lo que entró a la cuenta de Mercado Pago del negocio en el rango. Sólo lectura: usa el
 * permiso que el dueño dio en Configuración → Cobros, y el token nunca sale del servidor.
 */
export async function buscarCobrosMp(workspaceId: string, desde: Date, hasta: Date): Promise<ResultadoCobrosMp> {
  const cobrador = await resolveWorkspaceCollector(workspaceId);
  if (!cobrador.ok) {
    return { ok: false, motivo: cobrador.code === "NOT_CONNECTED" || cobrador.code === "NO_CREDENTIAL" ? "SIN_CONEXION" : "RECONECTAR" };
  }
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  const collectorId = cobrador.collector.providerUserId;
  for (const [k, v] of Object.entries(consultaCobros(desde, hasta, collectorId))) url.searchParams.set(k, v);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cobrador.collector.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("[caja][mp-cobros] Mercado Pago respondió", { status: res.status });
      return { ok: false, motivo: res.status === 401 || res.status === 403 ? "RECONECTAR" : "ERROR_MP" };
    }
    const cuerpo = (await res.json()) as { results?: unknown[] };
    const cobros = (cuerpo.results ?? [])
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => aCobroMp(r, collectorId))
      .filter((c): c is CobroMp => c !== null);
    return { ok: true, cobros };
  } catch (e) {
    console.error("[caja][mp-cobros] no se pudo consultar", { error: e instanceof Error ? e.name : "desconocido" });
    return { ok: false, motivo: "ERROR_MP" };
  }
}
