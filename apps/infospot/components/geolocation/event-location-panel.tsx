"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { geocodingStatusLabel } from "@/lib/geolocation/publish-rules";
import type { LocationVisibility } from "@/lib/geolocation/types";
import { parseDisplayNameFallback } from "@/lib/geolocation/parse-display-name";

const EventLocationMap = dynamic(
  () => import("@/components/geolocation/event-location-map"),
  { ssr: false, loading: () => <div className="h-[280px] rounded-xl bg-[var(--is-surface)]" /> },
);

type Suggestion = {
  latitude: number;
  longitude: number;
  displayName: string;
  countryCode: string | null;
  countryName: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  locationName: string | null;
  placeId: string | null;
  precision: string;
  provider: string;
};

export type EventLocationPanelValue = {
  city: string;
  province: string;
  address: string;
  venueName: string;
  postalCode: string;
  countryCode: string;
  countryName: string;
  latitude: number | null;
  longitude: number | null;
  locationVisibility: LocationVisibility;
  geocodingStatus: string | null;
  locationConfirmedAt: string | Date | null;
  geocodingPlaceId: string | null;
  geocodingProvider: string | null;
};

type Props = {
  mode: "redaccion" | "public";
  value: EventLocationPanelValue;
  onChange: (next: Partial<EventLocationPanelValue>) => void;
  onConfirm?: () => Promise<{ ok: boolean; error?: string }>;
  searchEndpoint?: string;
  reverseEndpoint?: string;
  disabled?: boolean;
};

function pickText(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return undefined;
}

/** Completa ciudad, provincia, lugar y dirección desde un resultado de geocoding. */
function fieldsFromSuggestion(
  s: Suggestion,
  current: EventLocationPanelValue,
): Partial<EventLocationPanelValue> {
  const fromDisplay = parseDisplayNameFallback(s.displayName || "");
  return {
    latitude: s.latitude,
    longitude: s.longitude,
    city:
      pickText(s.city, fromDisplay.city, current.city) || "",
    province:
      pickText(s.province, fromDisplay.province, current.province) || "",
    address:
      pickText(s.address, fromDisplay.address, current.address) || "",
    venueName:
      pickText(s.locationName, fromDisplay.venueName, current.venueName) || "",
    postalCode:
      pickText(s.postalCode, fromDisplay.postalCode, current.postalCode) || "",
    countryCode: pickText(s.countryCode, current.countryCode) || "AR",
    countryName: pickText(s.countryName, current.countryName) || "Argentina",
    geocodingPlaceId: s.placeId,
    geocodingProvider: s.provider,
    geocodingStatus: "GEOCODED",
    locationConfirmedAt: null,
  };
}

export function EventLocationPanel({
  mode,
  value,
  onChange,
  onConfirm,
  searchEndpoint = "/api/redaccion/geocode",
  reverseEndpoint = "/api/redaccion/geocode?mode=reverse",
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const statusLabel = useMemo(
    () => geocodingStatusLabel(value.geocodingStatus as never),
    [value.geocodingStatus],
  );

  const confirmed = Boolean(value.locationConfirmedAt);
  const hasCoords =
    value.latitude != null &&
    value.longitude != null &&
    !(value.latitude === 0 && value.longitude === 0);

  const runSearch = useCallback(() => {
    const q = query.trim();
    if (q.length < 3) {
      setMessage("Escribí al menos 3 caracteres.");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch(
          `${searchEndpoint}?q=${encodeURIComponent(q)}&city=${encodeURIComponent(valueRef.current.city || "")}`,
          { method: "GET" },
        );
        if (!res.ok) {
          setMessage("No se pudo buscar. Podés marcar el punto en el mapa.");
          setSuggestions([]);
          return;
        }
        const data = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(data.results || []);
        if (!(data.results || []).length) {
          setMessage("Sin resultados. Ajustá la búsqueda o usá el mapa.");
        }
      } catch {
        setMessage("Error de red al buscar. Usá el mapa manualmente.");
        setSuggestions([]);
      }
    });
  }, [query, searchEndpoint]);

  const applySuggestion = (s: Suggestion) => {
    const patch = fieldsFromSuggestion(s, valueRef.current);
    onChange(patch);
    valueRef.current = { ...valueRef.current, ...patch };
    setSuggestions([]);
    setQuery(s.displayName || query);
    setMessage(
      patch.city && patch.province
        ? "Datos completados. Confirmá la ubicación antes de enviar."
        : "Ubicación encontrada. Completá ciudad y provincia si faltan, y confirmá.",
    );
  };

  const onMarkerMove = (lat: number, lng: number) => {
    onChange({
      latitude: lat,
      longitude: lng,
      geocodingStatus:
        valueRef.current.geocodingStatus === "CONFIRMED"
          ? "GEOCODED"
          : valueRef.current.geocodingStatus || "GEOCODED",
      locationConfirmedAt: null,
      geocodingProvider: valueRef.current.geocodingProvider || "manual",
    });
    startTransition(async () => {
      try {
        const url = `${reverseEndpoint}${reverseEndpoint.includes("?") ? "&" : "?"}lat=${lat}&lon=${lng}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { result?: Suggestion | null };
        const r = data.result;
        if (!r) return;
        const patch = fieldsFromSuggestion(
          { ...r, latitude: lat, longitude: lng },
          valueRef.current,
        );
        onChange(patch);
        valueRef.current = { ...valueRef.current, ...patch };
        if (r.displayName) setQuery(r.displayName);
        setMessage("Ubicación actualizada desde el mapa.");
      } catch {
        /* reverse opcional */
      }
    });
  };

  const handleConfirm = () => {
    if (!onConfirm) {
      if (!hasCoords || !value.city.trim() || !value.province.trim()) {
        setMessage("Completá ciudad, provincia y punto en el mapa.");
        return;
      }
      onChange({
        geocodingStatus: "CONFIRMED",
        locationConfirmedAt: new Date().toISOString(),
      });
      setMessage("Ubicación confirmada.");
      return;
    }
    startTransition(async () => {
      const result = await onConfirm();
      setMessage(result.ok ? "Ubicación confirmada." : result.error || "No se pudo confirmar.");
    });
  };

  return (
    <section className="space-y-6 rounded-2xl border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">Ubicación del evento</h3>
        <p className="text-sm text-[var(--is-muted)]">
          Estado: <strong className="text-[var(--is-fg)]">{statusLabel}</strong>
          {confirmed ? " · confirmada" : ""}
        </p>
        {mode === "redaccion" && !confirmed ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Este evento no puede publicarse hasta confirmar su ubicación.
          </p>
        ) : null}
        {mode === "public" && !confirmed ? (
          <p className="text-sm text-[var(--is-muted)]">
            Si no confirmás el punto, la redacción lo revisará antes de publicar.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          disabled={disabled || pending}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Buscar dirección o lugar…"
          className="min-h-11 flex-1 rounded-xl border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
        />
        <button
          type="button"
          disabled={disabled || pending}
          onClick={runSearch}
          className="is-btn is-btn-outline min-h-11 px-5 text-sm"
        >
          Buscar
        </button>
      </div>

      {suggestions.length > 0 ? (
        <ul className="divide-y divide-[var(--is-border)] overflow-hidden rounded-xl border border-[var(--is-border)]">
          {suggestions.map((s) => (
            <li key={`${s.placeId || s.displayName}-${s.latitude}`}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--is-bg)]"
                onClick={() => applySuggestion(s)}
              >
                <span className="block font-medium text-[var(--is-fg)]">
                  {s.locationName || s.displayName.split(",")[0]}
                </span>
                <span className="mt-1 block text-xs text-[var(--is-muted)]">
                  {[s.city, s.province].filter(Boolean).join(", ") || s.displayName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <EventLocationMap
        latitude={value.latitude ?? 0}
        longitude={value.longitude ?? 0}
        editable={!disabled}
        onPositionChange={onMarkerMove}
      />

      {hasCoords ? (
        <p className="font-mono text-xs text-[var(--is-muted)]">
          {value.latitude?.toFixed(5)}, {value.longitude?.toFixed(5)}
        </p>
      ) : (
        <p className="text-sm text-[var(--is-muted)]">Falta georreferenciar el evento</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Ciudad</span>
          <input
            value={value.city}
            disabled={disabled}
            onChange={(e) => onChange({ city: e.target.value, locationConfirmedAt: null })}
            className="min-h-11 w-full rounded-xl border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
            placeholder="Ej. Rosario"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Provincia</span>
          <input
            value={value.province}
            disabled={disabled}
            onChange={(e) => onChange({ province: e.target.value, locationConfirmedAt: null })}
            className="min-h-11 w-full rounded-xl border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
            placeholder="Ej. Santa Fe"
          />
        </label>
        <label className="block space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Nombre del lugar</span>
          <input
            value={value.venueName}
            disabled={disabled}
            onChange={(e) => onChange({ venueName: e.target.value })}
            className="min-h-11 w-full rounded-xl border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
            placeholder="Ej. Autódromo Juan Manuel Fangio"
          />
        </label>
        <label className="block space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Dirección</span>
          <input
            value={value.address}
            disabled={disabled}
            onChange={(e) => onChange({ address: e.target.value, locationConfirmedAt: null })}
            className="min-h-11 w-full rounded-xl border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
            placeholder="Calle y número"
          />
        </label>
        <label className="block space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Visibilidad pública de la ubicación</span>
          <select
            value={value.locationVisibility}
            disabled={disabled}
            onChange={(e) =>
              onChange({ locationVisibility: e.target.value as LocationVisibility })
            }
            className="min-h-11 w-full rounded-xl border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
          >
            <option value="CITY_ONLY">Solo ciudad</option>
            <option value="APPROXIMATE">Aproximada (sin número)</option>
            <option value="EXACT">Exacta</option>
            <option value="HIDDEN">Oculta</option>
          </select>
        </label>
      </div>

      {/* Campos ocultos para submit de formularios server */}
      <input type="hidden" name="city" value={value.city} />
      <input type="hidden" name="province" value={value.province} />
      <input type="hidden" name="address" value={value.address} />
      <input type="hidden" name="venueName" value={value.venueName} />
      <input type="hidden" name="postalCode" value={value.postalCode} />
      <input type="hidden" name="countryCode" value={value.countryCode || "AR"} />
      <input type="hidden" name="countryName" value={value.countryName || "Argentina"} />
      <input type="hidden" name="latitude" value={value.latitude ?? ""} />
      <input type="hidden" name="longitude" value={value.longitude ?? ""} />
      <input type="hidden" name="locationVisibility" value={value.locationVisibility} />
      <input type="hidden" name="geocodingPlaceId" value={value.geocodingPlaceId ?? ""} />
      <input type="hidden" name="geocodingProvider" value={value.geocodingProvider ?? ""} />
      <input
        type="hidden"
        name="locationConfirmed"
        value={confirmed || value.geocodingStatus === "CONFIRMED" ? "1" : ""}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || pending || !hasCoords}
          onClick={handleConfirm}
          className="is-btn is-btn-solid min-h-11 px-5 text-sm"
        >
          Confirmar ubicación
        </button>
        {message ? <p className="text-sm text-[var(--is-muted)]">{message}</p> : null}
      </div>
    </section>
  );
}
