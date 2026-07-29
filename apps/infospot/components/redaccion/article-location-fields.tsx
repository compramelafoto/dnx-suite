"use client";

import { useEffect, useState } from "react";
import {
  GEOGRAPHIC_SCOPES,
  geographicScopeLabel,
  type GeographicScope,
} from "@/lib/editorial/article-location";

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

export function ArticleLocationFields({ value, onChange }: Props) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Valor optimista del select: un remount RSC con props vacías no debe
  // borrar lo que el redactor acaba de elegir hasta que el padre confirme.
  const [scopeUi, setScopeUi] = useState(value.geographicScope);

  useEffect(() => {
    if (value.geographicScope) setScopeUi(value.geographicScope);
  }, [value.geographicScope]);

  function patch(next: Partial<ArticleLocationValue>, meta?: { cleared?: boolean }) {
    if (meta?.cleared) setScopeUi("");
    else if (next.geographicScope !== undefined) setScopeUi(next.geographicScope);
    onChange({ ...value, ...next }, meta);
  }

  async function searchPlace() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/redaccion/geocode?q=${encodeURIComponent(q)}`,
        { method: "GET" },
      );
      const data = (await res.json()) as {
        results?: Array<{
          latitude: number;
          longitude: number;
          city?: string | null;
          province?: string | null;
          countryCode?: string | null;
          countryName?: string | null;
          displayName?: string | null;
          locationName?: string | null;
          address?: string | null;
        }>;
        error?: string;
      };
      if (!res.ok || !data.results?.length) {
        throw new Error(data.error || "No se encontró el lugar");
      }
      const hit = data.results[0]!;
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
        formattedAddress: hit.displayName || q,
        geographicScope: nextScope,
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Error de geocodificación");
    } finally {
      setSearching(false);
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
  }

  const scope = scopeUi || value.geographicScope;
  const needsCoords = !scope || scope === "LOCAL";
  const needsCity = !scope || scope === "LOCAL";
  const needsProvince = !scope || scope === "LOCAL" || scope === "PROVINCIAL";
  const needsCountry =
    !scope || scope === "LOCAL" || scope === "PROVINCIAL" || scope === "NATIONAL";
  const showPlaceDetails = scope !== "UNSPECIFIED";

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

      {/* Georreferencia siempre visible (no depende de haber elegido alcance). */}
      {showPlaceDetails ? (
        <div className="rounded-[var(--is-radius-sm)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)] p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Ubicación georreferenciada</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--is-muted)]">
              Buscá un lugar o cargá latitud/longitud. Si todavía no elegiste alcance, al
              encontrar un punto se sugiere «Local».
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchPlace();
                }
              }}
              className="is-input min-w-[12rem] flex-1"
              placeholder="Ej: Parque Independencia, Rosario"
              aria-label="Buscar lugar georreferenciado"
            />
            <button
              type="button"
              disabled={searching}
              onClick={() => void searchPlace()}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {searchError ? <p className="text-sm text-red-700">{searchError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
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
          {value.latitude && value.longitude ? (
            <p className="text-xs text-[var(--is-muted)]">
              Punto: {value.latitude}, {value.longitude}
              {value.formattedAddress ? ` · ${value.formattedAddress}` : ""}
            </p>
          ) : null}
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
