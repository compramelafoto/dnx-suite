const HISTORICO = "https://api.argentinadatos.com/v1/cotizaciones/dolares/tarjeta";
const HOY = "https://dolarapi.com/v1/dolares/tarjeta";
const TIMEOUT_MS = 5_000;
/** Días hacia atrás que se prueban si una fecha no tiene cotización (feriados largos). */
const DIAS_ATRAS = 5;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pesos por dólar tarjeta (venta) de una fecha. El dólar tarjeta ya incluye los impuestos,
 * así que el gasto se carga con impuesto 0%. Una sola consulta por fecha y por corrida.
 * Devuelve null si no hay cotización en ningún lado: el mail se reintenta en la próxima lectura.
 */
export function createFxLookup(opts: { fetchImpl?: typeof fetch; today?: Date } = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const today = ymd(opts.today ?? new Date());
  const cache = new Map<string, Promise<number | null>>();

  async function venta(url: string): Promise<number | null> {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as { venta?: unknown } | null;
      const v = typeof body?.venta === "number" ? body.venta : Number(body?.venta);
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  }

  async function lookup(day: string): Promise<number | null> {
    const base = new Date(`${day}T12:00:00Z`);
    for (let i = 0; i <= DIAS_ATRAS; i++) {
      const d = new Date(base.getTime() - i * 86_400_000);
      const [y, m, dd] = ymd(d).split("-");
      const v = await venta(`${HISTORICO}/${y}/${m}/${dd}`);
      if (v !== null) return v;
      if (i === 0 && day >= today) {
        const hoy = await venta(HOY);
        if (hoy !== null) return hoy;
      }
    }
    return null;
  }

  return (date: Date): Promise<number | null> => {
    const day = ymd(date);
    let p = cache.get(day);
    if (!p) {
      p = lookup(day);
      cache.set(day, p);
    }
    return p;
  };
}
