const SERIE = "https://api.argentinadatos.com/v1/cotizaciones/dolares/tarjeta";
const HOY = "https://dolarapi.com/v1/dolares/tarjeta";
const TIMEOUT_MS = 10_000;
/** Días hacia atrás que se prueban si una fecha no tiene cotización (fines de semana, feriados largos). */
const DIAS_ATRAS = 5;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pesos por dólar tarjeta (venta) de una fecha. El dólar tarjeta ya incluye los impuestos, así
 * que el gasto se carga con impuesto 0%. La serie histórica completa (~250 KB) se baja una sola
 * vez por corrida. Devuelve null si no hay cotización: el mail se reintenta en la próxima lectura.
 */
export function createFxLookup(opts: { fetchImpl?: typeof fetch; today?: Date } = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let serie: Promise<{ porFecha: Map<string, number>; ultima: string } | null> | null = null;
  let hoy: Promise<number | null> | null = null;

  async function getJson(url: string): Promise<unknown> {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function venta(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function cargarSerie() {
    serie ??= getJson(SERIE).then((body) => {
      if (!Array.isArray(body)) return null;
      const porFecha = new Map<string, number>();
      let ultima = "";
      for (const row of body as { fecha?: unknown; venta?: unknown }[]) {
        const v = venta(row?.venta);
        if (typeof row?.fecha === "string" && v !== null) {
          porFecha.set(row.fecha, v);
          if (row.fecha > ultima) ultima = row.fecha;
        }
      }
      return porFecha.size ? { porFecha, ultima } : null;
    });
    return serie;
  }

  return async (date: Date): Promise<number | null> => {
    const day = ymd(date);
    const s = await cargarSerie();
    if (s) {
      for (let i = 0; i <= DIAS_ATRAS; i++) {
        const v = s.porFecha.get(ymd(new Date(date.getTime() - i * 86_400_000)));
        if (v !== undefined) return v;
      }
    }
    // Lo más reciente puede no estar todavía en la serie: se usa la cotización del día.
    if (!s || day > s.ultima) {
      hoy ??= getJson(HOY).then((b) => venta((b as { venta?: unknown } | null)?.venta));
      return hoy;
    }
    return null;
  };
}
