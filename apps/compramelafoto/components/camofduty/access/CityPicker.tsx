"use client";

import { useEffect, useRef, useState } from "react";

export interface PickedCity {
  city: string;
  province: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface GeocodeHit {
  lat: number;
  lon: number;
  displayName: string;
  city: string;
  address: Record<string, string | undefined>;
}

/**
 * Ciudad con su ubicación en el mapa: se escribe y se elige de la lista
 * (así queda georreferenciada para avisar trabajos cerca).
 */
export default function CityPicker({ value, onChange, error }: { value: PickedCity | null; onChange: (c: PickedCity | null) => void; error?: string }) {
  const [query, setQuery] = useState(value ? [value.city, value.province].filter(Boolean).join(", ") : "");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) setQuery([value.city, value.province].filter(Boolean).join(", "));
  }, [value]);

  const search = (q: string) => {
    setQuery(q);
    onChange(null);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
        const data = res.ok ? ((await res.json()) as GeocodeHit[]) : [];
        setHits(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const pick = (h: GeocodeHit) => {
    const city: PickedCity = {
      city: h.city || h.displayName.split(",")[0],
      province: h.address.state ?? "",
      country: h.address.country ?? "",
      latitude: h.lat,
      longitude: h.lon,
    };
    onChange(city);
    setQuery([city.city, city.province].filter(Boolean).join(", "));
    setOpen(false);
  };

  return (
    <div className="cod-field cod-city">
      <label htmlFor="cod-city">Ciudad</label>
      <input
        id="cod-city"
        autoComplete="off"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Escribí tu ciudad y elegila de la lista"
        aria-invalid={!!error}
      />
      {loading ? <span className="cod-field__hint">Buscando…</span> : null}
      {value ? <span className="cod-field__ok">Ubicada en el mapa ✓</span> : null}
      {open && hits.length > 0 ? (
        <ul className="cod-city__list" role="listbox">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button type="button" onClick={() => pick(h)}>
                {h.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <span className="cod-field__error">{error}</span> : null}
    </div>
  );
}
