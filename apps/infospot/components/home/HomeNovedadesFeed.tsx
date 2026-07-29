"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { FeedItemCard } from "@/components/home/FeedItemCard";
import {
  MANUAL_CITY_OPTIONS,
  clearLocationPreference,
  preferenceControlLabel,
  readLocationPreference,
  readPromptState,
  roundCoordinate,
  trackFeedAnalytics,
  writeLocationPreference,
  writePromptState,
  type FeedLocationMode,
  type InfoSpotFeedItemDto,
  type LocationPermissionState,
  type StoredLocationPreference,
} from "@/lib/feed/client";

type FeedResponse = {
  items: InfoSpotFeedItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
  locationMode: FeedLocationMode;
  personalized: boolean;
};

type Props = {
  initialItems: InfoSpotFeedItemDto[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  excludeContentKeys?: string[];
};

function statusMessage(state: LocationPermissionState): string | null {
  switch (state) {
    case "granted":
    case "approximate":
      return "Mostrando novedades cerca de tu ubicación.";
    case "manual":
      return "Mostrando novedades cerca de la ciudad elegida.";
    case "denied":
      return "No pudimos acceder a tu ubicación. Podés elegir una ciudad manualmente.";
    case "unavailable":
      return "No fue posible determinar tu ubicación.";
    case "timeout":
      return "La ubicación está tardando demasiado. Mostramos las novedades generales.";
    case "requesting":
      return "Obteniendo tu ubicación…";
    default:
      return null;
  }
}

async function fetchFeed(params: {
  lat?: number;
  lng?: number;
  cursor?: string | null;
  locationMode: FeedLocationMode;
  excludeContentKeys?: string[];
}): Promise<FeedResponse> {
  const qs = new URLSearchParams();
  qs.set("limit", "12");
  qs.set("locationMode", params.locationMode);
  if (params.lat != null && params.lng != null) {
    qs.set("lat", String(params.lat));
    qs.set("lng", String(params.lng));
  }
  if (params.cursor) qs.set("cursor", params.cursor);
  // exclude se aplica en cliente sobre la primera página SSR; API no lo exige.

  const res = await fetch(`/api/public/feed?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("feed_error");
  }
  return (await res.json()) as FeedResponse;
}

export function HomeNovedadesFeed({
  initialItems,
  initialNextCursor,
  initialHasMore,
  excludeContentKeys = [],
}: Props) {
  const headingId = useId();
  const liveId = useId();
  const excludeSet = useMemo(() => new Set(excludeContentKeys), [excludeContentKeys]);

  const [items, setItems] = useState(() =>
    initialItems.filter((i) => !excludeSet.has(i.contentKey)),
  );
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [preference, setPreference] = useState<StoredLocationPreference | null>(null);
  const [permissionState, setPermissionState] = useState<LocationPermissionState>("idle");
  const [showPrompt, setShowPrompt] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useRef(false);

  const personalized =
    preference?.mode === "gps" || preference?.mode === "manual";

  const subtitle = personalized
    ? "Noticias, eventos y actividades cerca tuyo."
    : "Las últimas novedades de Info Spot.";

  const controlLabel = preferenceControlLabel(preference);

  const applyFeed = useCallback((data: FeedResponse) => {
    const filtered = data.items.filter((i) => !excludeSet.has(i.contentKey));
    setItems(filtered);
    setNextCursor(data.nextCursor);
    setHasMore(data.hasMore);
  }, [excludeSet]);

  const reloadPersonalized = useCallback(
    async (pref: StoredLocationPreference) => {
      if (pref.mode === "none" || pref.mode === "national") {
        setRefreshing(true);
        setError(null);
        try {
          const data = await fetchFeed({ locationMode: pref.mode });
          applyFeed(data);
        } catch {
          setError("No pudimos actualizar el feed. Seguimos con las novedades generales.");
        } finally {
          setRefreshing(false);
        }
        return;
      }
      if (pref.latitude == null || pref.longitude == null) return;
      setRefreshing(true);
      setError(null);
      try {
        const data = await fetchFeed({
          lat: pref.latitude,
          lng: pref.longitude,
          locationMode: pref.mode,
        });
        applyFeed(data);
        trackFeedAnalytics("feed_personalized_loaded", {
          locationMode: pref.mode,
        });
      } catch {
        setError("No pudimos personalizar el feed. Seguimos con las novedades generales.");
      } finally {
        setRefreshing(false);
      }
    },
    [applyFeed],
  );

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const stored = readLocationPreference();
    const prompt = readPromptState();
    setPreference(stored);

    if (stored?.mode === "gps" || stored?.mode === "manual") {
      setPermissionState(stored.permissionState);
      void reloadPersonalized(stored);
      return;
    }

    if (stored?.mode === "national") {
      setPermissionState("idle");
      return;
    }

    const dismissed = Boolean(prompt?.dismissedAt);
    const deniedHard = prompt?.lastOutcome === "denied";
    if (!dismissed && !deniedHard) {
      setShowPrompt(true);
      trackFeedAnalytics("location_prompt_shown");
    }
  }, [reloadPersonalized]);

  const requestGps = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setPermissionState("unavailable");
      setShowCityPicker(true);
      writePromptState({
        v: 1,
        lastOutcome: "unavailable",
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setPermissionState("requesting");
    trackFeedAnalytics("location_permission_requested");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: StoredLocationPreference = {
          v: 1,
          mode: "gps",
          permissionState: "granted",
          latitude: roundCoordinate(pos.coords.latitude),
          longitude: roundCoordinate(pos.coords.longitude),
          label: "Cerca mío",
          updatedAt: new Date().toISOString(),
        };
        writeLocationPreference(next);
        writePromptState({
          v: 1,
          dismissedAt: new Date().toISOString(),
          lastOutcome: "granted",
          updatedAt: new Date().toISOString(),
        });
        setPreference(next);
        setPermissionState("granted");
        setShowPrompt(false);
        trackFeedAnalytics("location_permission_granted", { locationMode: "gps" });
        void reloadPersonalized(next);
      },
      (err) => {
        const state: LocationPermissionState =
          err.code === err.TIMEOUT
            ? "timeout"
            : err.code === err.PERMISSION_DENIED
              ? "denied"
              : "unavailable";
        setPermissionState(state);
        setShowCityPicker(true);
        writePromptState({
          v: 1,
          dismissedAt: new Date().toISOString(),
          lastOutcome: state,
          updatedAt: new Date().toISOString(),
        });
        if (state === "denied") {
          trackFeedAnalytics("location_permission_denied");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [reloadPersonalized]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    writePromptState({
      v: 1,
      dismissedAt: new Date().toISOString(),
      lastOutcome: "idle",
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const selectCity = useCallback(
    (option: (typeof MANUAL_CITY_OPTIONS)[number]) => {
      const next: StoredLocationPreference = {
        v: 1,
        mode: "manual",
        permissionState: "manual",
        latitude: option.lat,
        longitude: option.lng,
        city: option.city,
        province: option.province,
        country: "Argentina",
        label: option.label,
        updatedAt: new Date().toISOString(),
      };
      writeLocationPreference(next);
      setPreference(next);
      setPermissionState("manual");
      setShowCityPicker(false);
      setShowPrompt(false);
      trackFeedAnalytics("manual_location_selected", {
        locationMode: "manual",
        city: option.city,
      });
      void reloadPersonalized(next);
    },
    [reloadPersonalized],
  );

  const setNational = useCallback(() => {
    const next: StoredLocationPreference = {
      v: 1,
      mode: "national",
      permissionState: "idle",
      updatedAt: new Date().toISOString(),
    };
    writeLocationPreference(next);
    setPreference(next);
    setPermissionState("idle");
    setShowCityPicker(false);
    void reloadPersonalized(next);
  }, [reloadPersonalized]);

  const clearPreference = useCallback(() => {
    clearLocationPreference();
    setPreference(null);
    setPermissionState("idle");
    setShowCityPicker(false);
    trackFeedAnalytics("location_preference_cleared");
    startTransition(() => {
      setItems(initialItems.filter((i) => !excludeSet.has(i.contentKey)));
      setNextCursor(initialNextCursor);
      setHasMore(initialHasMore);
    });
  }, [excludeSet, initialHasMore, initialItems, initialNextCursor]);

  const loadMore = useCallback(() => {
    if (!hasMore || !nextCursor || pending) return;
    startTransition(async () => {
      try {
        const data = await fetchFeed({
          lat: preference?.latitude,
          lng: preference?.longitude,
          cursor: nextCursor,
          locationMode: preference?.mode ?? "none",
        });
        const filtered = data.items.filter((i) => !excludeSet.has(i.contentKey));
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.contentKey));
          const merged = [...prev];
          for (const item of filtered) {
            if (!seen.has(item.contentKey)) {
              seen.add(item.contentKey);
              merged.push(item);
            }
          }
          return merged;
        });
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        setError("No pudimos cargar más novedades.");
      }
    });
  }, [excludeSet, hasMore, nextCursor, pending, preference]);

  const liveMessage = statusMessage(permissionState);

  return (
    <section id="novedades" aria-labelledby={headingId} className="space-y-8 md:space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="is-eyebrow">Feed unificado</p>
          <h2 id={headingId} className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl">
            Novedades
          </h2>
          <p className="is-body mt-3 max-w-xl">{subtitle}</p>
          <p className="mt-3 text-sm text-[var(--is-graphite-600)]">
            Info Spot utiliza tu ubicación solamente para ordenar contenido por cercanía.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="text-sm text-[var(--is-graphite-700)]">
            Ubicación: <span className="font-semibold">{controlLabel}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="is-btn is-btn-secondary min-h-11 px-3 text-sm"
              onClick={requestGps}
              disabled={permissionState === "requesting"}
            >
              Cerca mío
            </button>
            <button
              type="button"
              className="is-btn is-btn-ghost min-h-11 px-3 text-sm"
              onClick={() => setShowCityPicker((v) => !v)}
              aria-expanded={showCityPicker}
            >
              Elegir ciudad
            </button>
            <button
              type="button"
              className="is-btn is-btn-ghost min-h-11 px-3 text-sm"
              onClick={setNational}
            >
              Todo el país
            </button>
            {preference ? (
              <button
                type="button"
                className="is-btn is-btn-ghost min-h-11 px-3 text-sm"
                onClick={clearPreference}
              >
                Borrar preferencia
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showPrompt ? (
        <div
          className="border border-[var(--is-graphite-200)] bg-[var(--is-white-0)] p-5 md:p-6"
          role="region"
          aria-label="Personalizar por ubicación"
        >
          <p className="is-h4 text-lg md:text-xl">Descubrí qué está pasando cerca tuyo</p>
          <p className="is-body mt-3 max-w-2xl">
            Permití tu ubicación para ordenar noticias, eventos y actividades por cercanía.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="is-btn is-btn-solid min-h-11 px-4 text-sm"
              onClick={requestGps}
            >
              Ver contenido cerca mío
            </button>
            <button
              type="button"
              className="is-btn is-btn-ghost min-h-11 px-4 text-sm"
              onClick={dismissPrompt}
            >
              Ahora no
            </button>
          </div>
        </div>
      ) : null}

      {showCityPicker ? (
        <div className="border border-[var(--is-graphite-200)] p-5 md:p-6">
          <p className="font-semibold">Elegí una ciudad</p>
          <p className="mt-2 text-sm text-[var(--is-graphite-600)]">
            Usamos un punto aproximado de la ciudad. No guardamos una dirección exacta.
          </p>
          {permissionState === "denied" ? (
            <p className="mt-3 text-sm text-amber-800">
              Si bloqueaste el permiso en el navegador, habilitalo desde el icono de ubicación
              en la barra de direcciones y volvé a intentar «Cerca mío».
            </p>
          ) : null}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {MANUAL_CITY_OPTIONS.map((city) => (
              <li key={city.label}>
                <button
                  type="button"
                  className="is-btn is-btn-secondary w-full min-h-11 justify-start px-3 text-left text-sm"
                  onClick={() => selectCity(city)}
                >
                  {city.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        id={liveId}
        className="min-h-[1.25rem] text-sm text-[var(--is-graphite-700)]"
        aria-live="polite"
      >
        {refreshing ? "Actualizando novedades…" : null}
        {!refreshing && liveMessage ? liveMessage : null}
        {error ? <span className="text-amber-800">{error}</span> : null}
      </div>

      {items.length === 0 ? (
        <p className="is-body">Todavía no hay novedades publicadas para mostrar.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {items.map((item) => (
            <FeedItemCard key={item.contentKey} item={item} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            className="is-btn is-btn-secondary min-h-11 px-5 text-sm"
            onClick={loadMore}
            disabled={pending}
          >
            {pending ? "Cargando…" : "Ver más"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
