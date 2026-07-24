import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import type { NormalizedPlace } from "../types";

export type LocationSearchProps = {
  /** La app inyecta el buscador (proxy Nominatim / Server Action). */
  onSearch: (query: string) => Promise<NormalizedPlace[]>;
  onSelect: (place: NormalizedPlace) => void;
  minQueryLength?: number;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
};

/**
 * Buscador controlado de lugares. Sin fetch propio: el host provee onSearch.
 * MapPicker Leaflet permanece en cada app (assets/estilos distintos).
 */
export function LocationSearch({
  onSearch,
  onSelect,
  minQueryLength = 3,
  placeholder = "Buscar lugar…",
  className,
  style,
  disabled,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedPlace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < minQueryLength) {
      setError(`Escribí al menos ${minQueryLength} caracteres.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hits = await onSearch(q);
      setResults(hits);
      if (hits.length === 0) setError("Sin resultados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de búsqueda");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className} style={style} data-dnx-geo="location-search">
      <form onSubmit={(e) => void submit(e)}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          aria-label="Buscar ubicación"
        />
        <button type="submit" disabled={disabled || loading}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {results.length > 0 ? (
        <ul>
          {results.map((place, i) => (
            <li key={place.placeId || `${place.latitude},${place.longitude},${i}`}>
              <button type="button" onClick={() => onSelect(place)}>
                {place.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
