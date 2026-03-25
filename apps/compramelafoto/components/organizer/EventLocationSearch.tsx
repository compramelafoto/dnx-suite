"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Input from "@/components/ui/Input";

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onOutside]);
}

type GeocodeResult = { lat: number; lon: number; displayName?: string; display_name?: string };

type EventLocationSearchProps = {
  onSelect: (lat: number, lon: number, displayName: string) => void;
  value?: string;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
};

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

export default function EventLocationSearch({
  onSelect,
  value,
  onClear,
  placeholder = "Ej: Teatro Colón, Estadio Monumental",
  className = "",
}: EventLocationSearchProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setError(null);
        return;
      }
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setError(null);
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
          signal: abortRef.current.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? "Error al buscar");
          setResults([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setResults(list);
        setOpen(true);
        if (list.length === 0) setError("No se encontraron resultados");
        else setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Error de conexión");
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  function pickResult(r: GeocodeResult) {
    if (r.lat != null && r.lon != null) {
      const name = r.displayName ?? r.display_name ?? "";
      onSelect(r.lat, r.lon, name);
      setResults([]);
      setQuery("");
      setOpen(false);
      setError(null);
    }
  }

  const displayValue = query || (value ?? "");
  return (
    <div ref={containerRef} className={`w-full min-w-0 relative ${className}`}>
      <Input
        type="text"
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value;
          if (value && !query) onClear?.();
          setQuery(v);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full max-w-full box-border"
        autoComplete="off"
      />
      {searching && (
        <p className="text-xs text-gray-500 mt-1">Buscando…</p>
      )}
      {error && results.length === 0 && !searching && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-[9999] mt-1 w-full border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pickResult(r)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {r.displayName ?? r.display_name ?? ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
