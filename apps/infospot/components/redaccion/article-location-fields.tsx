"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GEOGRAPHIC_SCOPES,
  geographicScopeLabel,
  type GeographicScope,
} from "@/lib/editorial/article-location";

const EventLocationMap = dynamic(
  () => import("@/components/geolocation/event-location-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-[var(--is-border)] bg-[var(--is-bg-secondary)] text-sm text-[var(--is-muted)]">
        Cargando mapa…
      </div>
    ),
  },
);

export type ArticleLocationValue = {
  geographicScope: GeographicScope | "";
  countryCode: string;
  countryName: string;
  province: string;
  city: string;
  placeName: string;
  address: string;
  formattedAddress: string;
  latitude: string;
  longitude: string;
};

type GeocodeHit = {
  latitude: number;
  longitude: number;
  city?: string | null;
  province?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  displayName?: string | null;
  locationName?: string | null;
  address?: string | null;
  placeId?: string | null;
};

type Props = {
  value: ArticleLocationValue;
  onChange: (next: ArticleLocationValue, meta?: { cleared?: boolean }) => void;
};

const fieldClass = "is-input mt-2";
const labelClass = "is-input-label";

export function defaultArticleLocationValue(
  partial?: Partial<ArticleLocationValue> | null,
): ArticleLocationValue {
  return {
    geographicScope: (partial?.geographicScope as GeographicScope | "") || "",
    countryCode: partial?.countryCode || "AR",
    countryName: partial?.countryName || "Argentina",
    province: partial?.province || "",
    city: partial?.city || "",
    placeName: partial?.placeName || "",
    address: partial?.address || "",
    formattedAddress: partial?.formattedAddress || "",
    latitude:
      partial?.latitude != null && String(partial.latitude) !== ""
        ? String(partial.latitude)
        : "",
    longitude:
      partial?.longitude != null && String(partial.longitude) !== ""
        ? String(partial.longitude)
        : "",
  };
}

function parseCoord(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function ArticleLocationFields({ value, onChange }: Props) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  // Valor optimista del select: un remount RSC con props vacías no debe
  // borrar lo que el redactor acaba de elegir hasta que el padre confirme.
  const [scopeUi, setScopeUi] = useState(value.geographicScope);
  const searchSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.geographicScope) setScopeUi(value.geographicScope);
  }, [value.geographicScope]);

  function patch(next: Partial<ArticleLocationValue>, meta?: { cleared?: boolean }) {
    if (meta?.cleared) setScopeUi("");
    else if (next.geographicScope !== undefined) setScopeUi(next.geographicScope);
    onChange({ ...value, ...next }, meta);
  }

  function applyHit(hit: GeocodeHit) {
    const nextScope =
      (scopeUi || value.geographicScope || "LOCAL") as GeographicScope;
    patch({
      latitude: String(hit.latitude),
      longitude: String(hit.longitude),
      city: hit.city || value.city,
      province: hit.province || value.province,
      countryCode: hit.countryCode || value.countryCode,
      countryName: hit.countryName || value.countryName,
      placeName: hit.locationName || value.placeName,
      address: hit.address || value.address,
      formattedAddress: hit.displayName || value.formattedAddress,
      geographicScope: nextScope,
    });
    setSuggestions([]);
    setSearchError(null);
    if (hit.displayName) setQuery(hit.displayName);
  }

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const q = rawQuery.trim();
      if (q.length < 3) {
        setSuggestions([]);
        setSearchError(q.length > 0 ? "Escribí al menos 3 caracteres." : null);
        setSearching(false);
        return;
      }

      const seq = ++searchSeq.current;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(
          `/api/redaccion/geocode?q=${encodeURIComponent(q)}`,
          { method: "GET" },
        );
        const data = (await res.json()) as {
          results?: GeocodeHit[];
          error?: string;
        };
        if (seq !== searchSeq.current) return;
        if (!res.ok) {
          setSuggestions([]);
          setSearchError(data.error || "No se pudo buscar. Usá el mapa.");
          return;
        }
        const results = data.results || [];
        setSuggestions(results);
        if (!results.length) {
          setSearchError("Sin resultados. Probá otra búsqueda o marcá el punto en el mapa.");
        }
      } catch {
        if (seq !== searchSeq.current) return;
        setSuggestions([]);
        setSearchError("Error de red al buscar. Usá el mapa manualmente.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    },
    [],
  );

  function onQueryChange(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 3) {
      setSuggestions([]);
      setSearchError(next.trim().length > 0 ? "Escribí al menos 3 caracteres." : null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      void runSearch(next);
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function onMarkerMove(lat: number, lng: number) {
    const nextScope =
      (scopeUi || value.geographicScope || "LOCAL") as GeographicScope;
    patch({
      latitude: String(lat),
      longitude: String(lng),
      geographicScope: nextScope,
    });
    try {
      const res = await fetch(
        `/api/redaccion/geocode?mode=reverse&lat=${lat}&lon=${lng}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { result?: GeocodeHit | null };
      const r = data.result;
      if (!r) return;
      patch({
        latitude: String(lat),
        longitude: String(lng),
        city: r.city || value.city,
        province: r.province || value.province,
        countryCode: r.countryCode || value.countryCode,
        countryName: r.countryName || value.countryName,
        placeName: r.locationName || value.placeName,
        address: r.address || value.address,
        formattedAddress: r.displayName || value.formattedAddress,
        geographicScope: nextScope,
      });
    } catch {
      /* reverse opcional */
    }
  }

  function clearLocation() {
    patch(
      {
        geographicScope: "",
        province: "",
        city: "",
        placeName: "",
        address: "",
        formattedAddress: "",
        latitude: "",
        longitude: "",
        countryCode: "AR",
        countryName: "Argentina",
      },
      { cleared: true },
    );
    setQuery("");
    setSuggestions([]);
    setSearchError(null);
  }

  const scope = scopeUi || value.geographicScope;
  const needsCoords = !scope || scope === "LOCAL";
  const needsCity = !scope || scope === "LOCAL";
  const needsProvince = !scope || scope === "LOCAL" || scope === "PROVINCIAL";
  const needsCountry =
    !scope || scope === "LOCAL" || scope === "PROVINCIAL" || scope === "NATIONAL";
  const showPlaceDetails = scope !== "UNSPECIFIED";
  const latNum = parseCoord(value.latitude);
  const lngNum = parseCoord(value.longitude);
  const hasCoords = latNum != null && lngNum != null && !(latNum === 0 && lngNum === 0);

  return (
    <section
      className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-4"
      aria-labelledby="article-location-title"
    >
      <div>
        <h2 id="article-location-title" className="text-base font-semibold tracking-tight">
          Ubicación y alcance
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--is-muted)]">
          Independiente de ComprameLaFoto. Sirve para el Home cercano y los listados. No uses
          «Sin ubicación específica» como atajo para omitir campos.
        </p>
      </div>

      {/* geographicScope va en el <select name="…"> visible (evita duplicar name). */}
      <input type="hidden" name="countryCode" value={value.countryCode} />
      <input type="hidden" name="countryName" value={value.countryName} />
      <input type="hidden" name="province" value={value.province} />
      <input type="hidden" name="city" value={value.city} />
      <input type="hidden" name="placeName" value={value.placeName} />
      <input type="hidden" name="address" value={value.address} />
      <input type="hidden" name="formattedAddress" value={value.formattedAddress} />
      <input type="hidden" name="latitude" value={value.latitude} />
      <input type="hidden" name="longitude" value={value.longitude} />

      <div>
        <label className={labelClass} htmlFor="geographicScopeSelect">
          Alcance *
        </label>
        <select
          id="geographicScopeSelect"
          name="geographicScope"
          value={scopeUi}
          onChange={(e) => {
            const next = e.target.value as GeographicScope | "";
            setScopeUi(next);
            patch({ geographicScope: next });
          }}
          className={fieldClass}
        >
          <option value="">Elegí un alcance…</option>
          {GEOGRAPHIC_SCOPES.map((s) => (
            <option key={s} value={s}>
              {geographicScopeLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {scope === "UNSPECIFIED" ? (
        <p className="text-sm leading-relaxed text-[var(--is-muted)]">
          Esta nota no se priorizará por cercanía en el Home. Solo usá esta opción si
          genuinamente no corresponde a un lugar.
        </p>
      ) : null}

      {showPlaceDetails ? (
        <div className="space-y-4 rounded-[var(--is-radius-sm)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)] p-4">
          <div>
            <p className="text-sm font-semibold">Ubicación georreferenciada</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--is-muted)]">
              Escribí un lugar: aparecen sugerencias abajo. Después podés ajustar el punto en el
              mapa. Si todavía no elegiste alcance, al elegir un resultado se sugiere «Local».
            </p>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="articleLocationSearch">
              Buscar lugar
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="articleLocationSearch"
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    void runSearch(query);
                  }
                }}
                className="is-input mt-0 min-w-[12rem] flex-1"
                placeholder="Ej: Municipalidad de Rosario"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls="article-location-suggestions"
                aria-expanded={suggestions.length > 0}
              />
              <button
                type="button"
                disabled={searching}
                onClick={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  void runSearch(query);
                }}
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {searching ? "Buscando…" : "Buscar"}
              </button>
            </div>
            {searchError ? (
              <p className="text-sm text-red-700" role="status">
                {searchError}
              </p>
            ) : null}
            {suggestions.length > 0 ? (
              <ul
                id="article-location-suggestions"
                role="listbox"
                className="divide-y divide-[var(--is-border)] overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)]"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.placeId || s.displayName || "hit"}-${s.latitude}-${s.longitude}-${i}`}
                    role="option"
                  >
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm leading-relaxed hover:bg-[var(--is-bg-secondary)]"
                      onClick={() => applyHit(s)}
                    >
                      {s.displayName ||
                        `${s.locationName || "Lugar"} · ${s.city || ""} ${s.province || ""}`.trim()}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Mapa</p>
            <p className="text-xs leading-relaxed text-[var(--is-muted)]">
              Arrastrá el marcador o hacé clic para corregir la ubicación.
            </p>
            <EventLocationMap
              latitude={hasCoords ? latNum! : 0}
              longitude={hasCoords ? lngNum! : 0}
              editable
              onPositionChange={(lat, lng) => {
                void onMarkerMove(lat, lng);
              }}
              height="280px"
            />
            {hasCoords ? (
              <p className="font-mono text-xs text-[var(--is-muted)]">
                {latNum!.toFixed(5)}, {lngNum!.toFixed(5)}
                {value.formattedAddress ? ` · ${value.formattedAddress}` : ""}
              </p>
            ) : (
              <p className="text-xs text-[var(--is-muted)]">
                Todavía sin punto. Buscá un lugar o marcá en el mapa.
              </p>
            )}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--is-muted)] hover:text-[var(--is-fg)]">
              Coordenadas manuales {needsCoords ? "(obligatorias para alcance local)" : ""}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="articleLat">
                  Latitud {needsCoords ? "*" : ""}
                </label>
                <input
                  id="articleLat"
                  value={value.latitude}
                  onChange={(e) => patch({ latitude: e.target.value })}
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="-32.94"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="articleLng">
                  Longitud {needsCoords ? "*" : ""}
                </label>
                <input
                  id="articleLng"
                  value={value.longitude}
                  onChange={(e) => patch({ longitude: e.target.value })}
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="-60.65"
                />
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {showPlaceDetails ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="articleCountry">
                País {needsCountry ? "*" : "(opcional)"}
              </label>
              <input
                id="articleCountry"
                value={value.countryName}
                onChange={(e) => patch({ countryName: e.target.value })}
                className={fieldClass}
                placeholder="Argentina"
              />
            </div>
            {needsProvince || scope === "INTERNATIONAL" || !scope ? (
              <div>
                <label className={labelClass} htmlFor="articleProvince">
                  Provincia / región {needsProvince ? "*" : ""}
                </label>
                <input
                  id="articleProvince"
                  value={value.province}
                  onChange={(e) => patch({ province: e.target.value })}
                  className={fieldClass}
                />
              </div>
            ) : null}
          </div>

          {needsCity || scope === "INTERNATIONAL" || scope === "PROVINCIAL" || !scope ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="articleCity">
                  Ciudad {needsCity ? "*" : "(opcional)"}
                </label>
                <input
                  id="articleCity"
                  value={value.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="articlePlace">
                  Lugar / referencia
                </label>
                <input
                  id="articlePlace"
                  value={value.placeName}
                  onChange={(e) => patch({ placeName: e.target.value })}
                  className={fieldClass}
                  placeholder="Estadio, museo, barrio…"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelClass} htmlFor="articleAddress">
              Dirección editorial
            </label>
            <input
              id="articleAddress"
              value={value.address}
              onChange={(e) => patch({ address: e.target.value })}
              className={fieldClass}
            />
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={clearLocation}
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--is-accent)] hover:underline"
      >
        Limpiar ubicación
      </button>
    </section>
  );
}
