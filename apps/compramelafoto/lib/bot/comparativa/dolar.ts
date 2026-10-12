/** Cotización del dólar tarjeta (pesos por dólar), la que paga quien factura en dólares con tarjeta argentina. */
export const DOLAR_TARJETA_URL = "https://dolarapi.com/v1/dolares/tarjeta";
export const DOLAR_TIMEOUT_MS = 3_000;

export type Cotizacion = { pesosPorDolar: number; fuente: "dolarapi" | "variable" };

type Opciones = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
};

function positivo(n: unknown): number | null {
  const v = typeof n === "string" ? Number(n.replace(",", ".")) : n;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Cadena de respaldo: dolarapi.com (venta, con 3 s de tope) → variable `CLF_BOT_USD_ARS` → `null`
 * (sin cotización, el reporte omite los pesos). Nunca tira.
 */
export async function cotizacionDolar(opciones: Opciones = {}): Promise<Cotizacion | null> {
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const env = opciones.env ?? process.env;
  try {
    const res = await fetchImpl(DOLAR_TARJETA_URL, {
      signal: AbortSignal.timeout(opciones.timeoutMs ?? DOLAR_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { venta?: unknown } | null;
      const venta = positivo(body?.venta);
      if (venta) return { pesosPorDolar: venta, fuente: "dolarapi" };
    }
  } catch {
    // Caída, timeout o JSON roto: se sigue con la variable de entorno.
  }
  const deVariable = positivo(env.CLF_BOT_USD_ARS);
  return deVariable ? { pesosPorDolar: deVariable, fuente: "variable" } : null;
}
