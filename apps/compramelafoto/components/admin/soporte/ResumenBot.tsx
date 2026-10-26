"use client";

import { useEffect, useState } from "react";

type Resumen = { total: number; unToque: number; charlas: number; tickets: number; resueltasPorBot: number; porAudiencia: { BUYER: number; PHOTOGRAPHER: number } };

function hoyAR(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}
function haceDiasAR(d: number): string {
  return new Date(Date.now() - 3 * 3_600_000 - d * 86_400_000).toISOString().slice(0, 10);
}

/** Números del DNX Bot arriba del tablero: cuánto atendió, cuánto resolvió solo y cuánto pasó a ticket. */
export default function ResumenBot() {
  const [desde, setDesde] = useState(haceDiasAR(14));
  const [hasta, setHasta] = useState(hoyAR());
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    setError(false);
    fetch(`/api/admin/support/resumen-bot?desde=${desde}&hasta=${hasta}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => { if (vivo) setR(d); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [desde, hasta]);

  const pct = r && r.total > 0 ? Math.round((r.tickets / r.total) * 100) : 0;
  const kpis = r
    ? [
        { titulo: "Consultas al DNX Bot", valor: r.total, nota: "en el período" },
        { titulo: "Resueltas por el bot", valor: r.resueltasPorBot, nota: `${r.unToque} de un solo toque · ${r.charlas} charlas` },
        { titulo: "Pasaron a reclamo", valor: r.tickets, nota: `${pct} % del total` },
        { titulo: "Por tipo de cliente", valor: `${r.porAudiencia.BUYER} · ${r.porAudiencia.PHOTOGRAPHER}`, nota: "compradores · fotógrafos" },
      ]
    : [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-gray-600">
          Desde
          <input type="date" className="rounded-lg border border-gray-300 px-2 py-1" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-gray-600">
          Hasta
          <input type="date" className="rounded-lg border border-gray-300 px-2 py-1" value={hasta} min={desde} max={hoyAR()} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {error && <span className="text-red-600">No se pudieron cargar los números del bot.</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(kpis.length ? kpis : Array.from({ length: 4 }, () => null)).map((k, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">{k?.titulo ?? "…"}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{k?.valor ?? "—"}</p>
            <p className="text-xs text-gray-500">{k?.nota ?? ""}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
