"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/organizer/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg bg-gray-200 h-[200px] flex items-center justify-center text-gray-500 text-sm">
      Cargando mapa…
    </div>
  ),
});

export type GeoResult = {
  lat: number;
  lon: number;
  displayName: string;
  address: Record<string, string>;
};

type AddressGeoSearchProps = {
  address: string;
  city: string;
  province: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  onAddressChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onCoordsChange: (lat: number, lon: number) => void;
  placeholder?: string;
};

function extractAddressParts(addr: Record<string, string>) {
  const city = addr.city || addr.town || addr.village || addr.municipality || "";
  const province = addr.state || addr.province || addr.county || "";
  const country = addr.country || "";
  const road = addr.road || "";
  const house = addr.house_number || "";
  const street = [house, road].filter(Boolean).join(" ");
  const full = [street, city, province, country].filter(Boolean).join(", ");
  return { address: full || "", city, province, country };
}

export default function AddressGeoSearch({
  address,
  city,
  province,
  country,
  latitude,
  longitude,
  onAddressChange,
  onCityChange,
  onProvinceChange,
  onCountryChange,
  onCoordsChange,
  placeholder = "Buscar dirección (ej. Colegio San Martín, Buenos Aires)",
}: AddressGeoSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(r: GeoResult) {
    const { address: addr, city: c, province: p, country: co } = extractAddressParts(r.address);
    onAddressChange(addr || r.displayName);
    onCityChange(c);
    onProvinceChange(p);
    onCountryChange(co);
    onCoordsChange(r.lat, r.lon);
    setQuery(addr || r.displayName);
    setResults([]);
    setOpen(false);
  }

  const hasCoords = latitude != null && longitude != null && (latitude !== 0 || longitude !== 0);

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Dirección (georeferenciada)
        </label>
        <input
          type="text"
          value={query || address}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) {
              onAddressChange("");
              onCityChange("");
              onProvinceChange("");
              onCountryChange("");
            }
          }}
          onFocus={() => query.length >= 3 && setOpen(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
        />
        {loading && (
          <span className="absolute right-3 top-[38px] text-gray-400 text-sm">Buscando…</span>
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <li
                key={i}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                onClick={() => handleSelect(r)}
              >
                {r.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasCoords && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en mapa</label>
          <LocationMap
            latitude={latitude}
            longitude={longitude}
            editable
            onPositionChange={(lat, lng) => onCoordsChange(lat, lng)}
            height="200px"
          />
        </div>
      )}
    </div>
  );
}
