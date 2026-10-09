"use client";

import { useEffect, useState } from "react";

export type Lugar = { latitude: number; longitude: number; displayName: string; address: string | null; city: string | null; province: string | null };

/** Escribe, espera 400 ms y busca. Elegir un resultado completa dirección, ciudad, provincia y punto. */
export function BuscadorDireccion({ onElegir }: { onElegir: (l: Lugar) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Lugar[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const j = (await r.json()) as Lugar[] | { error: string };
      if (Array.isArray(j)) { setRes(j); setError(j.length ? null : "No encontramos esa dirección."); }
      else { setRes([]); setError(j.error); }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscá la dirección (calle, número, ciudad)"
        className="w-full rounded-[10px] border border-[var(--mf-line)] bg-white px-3 py-2"
      />
      {error ? <p className="mt-1 text-sm text-[var(--mf-muted)]">{error}</p> : null}
      {res.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-[10px] border border-[var(--mf-line)] bg-white">
          {res.map((l) => (
            <li key={`${l.latitude},${l.longitude}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--mf-surface)]"
                onClick={() => { onElegir(l); setRes([]); setQ(l.displayName); }}
              >
                {l.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
