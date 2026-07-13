"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EventLocationSearch from "@/components/organizer/EventLocationSearch";
import type {
  MapRadiusSearch,
  PhotographerMapPoint,
} from "@/components/admin/PhotographersArgentinaMap";
import {
  formatPhotographerRadiusResultsForClipboard,
  formatPhotographerWorkLocationParts,
  photographerInstagramHref,
  photographerInstagramLabel,
  photographerWhatsappHref,
} from "@/lib/admin/photographer-contact-links";
import {
  photographersWithinRadiusKm,
  type PhotographerRadiusSearchCenter,
} from "@/lib/admin/photographer-radius-search";

const PhotographersArgentinaMap = dynamic(
  () => import("@/components/admin/PhotographersArgentinaMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#f3f4f6] text-sm text-[#6b7280]">
        Cargando mapa de Argentina…
      </div>
    ),
  }
);

type GeoStats = {
  totalRegistered: number;
  withCoordinates: number;
  withoutCoordinates: number;
  onMapArgentina: number;
  outsideArgentinaBounds: number;
};

const POLL_MS = 30_000;

export default function AdminFotografosMapaPage() {
  const [photographers, setPhotographers] = useState<PhotographerMapPoint[]>([]);
  const [stats, setStats] = useState<GeoStats | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOutside, setShowOutside] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pendingCenter, setPendingCenter] = useState<PhotographerRadiusSearchCenter | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [radiusKmInput, setRadiusKmInput] = useState("25");
  const [radiusSearch, setRadiusSearch] = useState<MapRadiusSearch | null>(null);
  const [radiusSearchError, setRadiusSearchError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/photographers/geo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar las ubicaciones");
      }
      setPhotographers(Array.isArray(data.photographers) ? data.photographers : []);
      setStats(data.stats ?? null);
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const formattedTime = fetchedAt
    ? new Date(fetchedAt).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "medium",
      })
    : "—";

  const basePhotographers = useMemo(
    () => (showOutside ? photographers : photographers.filter((p) => p.inArgentina)),
    [photographers, showOutside]
  );

  const radiusResults = useMemo(() => {
    if (!radiusSearch) return null;
    return photographersWithinRadiusKm(basePhotographers, radiusSearch, radiusSearch.radiusKm);
  }, [basePhotographers, radiusSearch]);

  const mapPhotographers = radiusResults ?? basePhotographers;

  function handleRunRadiusSearch() {
    setRadiusSearchError(null);
    if (!pendingCenter) {
      setRadiusSearchError("Elegí una ubicación de la lista de sugerencias.");
      return;
    }
    const radiusKm = Number(radiusKmInput.replace(",", "."));
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      setRadiusSearchError("Ingresá un radio válido en kilómetros (mayor a 0).");
      return;
    }
    if (radiusKm > 500) {
      setRadiusSearchError("El radio máximo es 500 km.");
      return;
    }
    setRadiusSearch({
      lat: pendingCenter.lat,
      lng: pendingCenter.lng,
      label: pendingCenter.label,
      radiusKm,
    });
  }

  function clearRadiusSearch() {
    setRadiusSearch(null);
    setRadiusSearchError(null);
    setPendingCenter(null);
    setLocationLabel("");
    setShareCopied(false);
  }

  async function copyRadiusResultsToClipboard() {
    if (!radiusSearch || !radiusResults) return;
    const text = formatPhotographerRadiusResultsForClipboard(radiusSearch, radiusResults);
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setRadiusSearchError("No se pudo copiar al portapapeles. Probá de nuevo o copiá manualmente.");
    }
  }

  return (
    <div className="ds-fill-width ds-stack-section">
      <div className="w-full min-w-0">
        <h1 className="text-2xl font-bold text-[#1a1a1a] m-0">Mapa de fotógrafos — Argentina</h1>
        <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted mt-2 text-sm m-0">
          Ubicaciones georeferenciadas de fotógrafos registrados en ComprameLaFoto. Los puntos provienen de la
          ubicación de trabajo configurada en su perfil. Podés buscar por radio desde una dirección o ciudad. El
          mapa se actualiza automáticamente cada 30 segundos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => load()} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar ahora"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-[#4b5563] cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="h-4 w-4 accent-[#c27b3d]"
          />
          Actualización automática (30 s)
        </label>
        <label className="flex items-center gap-2 text-sm text-[#4b5563] cursor-pointer">
          <input
            type="checkbox"
            checked={showOutside}
            onChange={(e) => setShowOutside(e.target.checked)}
            className="h-4 w-4 accent-[#c27b3d]"
          />
          Incluir ubicaciones fuera de Argentina
        </label>
        <span className="text-xs text-[#9ca3af]">Última actualización: {formattedTime}</span>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#1a1a1a] m-0">Buscar fotógrafos por proximidad</h2>
        <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted text-sm mt-2 m-0">
          Indicá un lugar (ciudad, barrio, dirección) y un radio en km. Se listan y marcan en el mapa los
          fotógrafos con ubicación de trabajo dentro de ese radio.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-[#374151] mb-1">Ubicación</label>
            <EventLocationSearch
              value={locationLabel}
              placeholder="Ej: Rosario, Córdoba capital, Palermo Buenos Aires"
              onSelect={(lat, lon, displayName) => {
                setPendingCenter({ lat, lng: lon, label: displayName });
                setLocationLabel(displayName);
                setRadiusSearchError(null);
              }}
              onClear={() => {
                setPendingCenter(null);
                setLocationLabel("");
              }}
            />
          </div>
          <div className="w-full lg:w-32">
            <label htmlFor="radius-km" className="block text-sm font-medium text-[#374151] mb-1">
              Radio (km)
            </label>
            <Input
              id="radius-km"
              type="number"
              min={1}
              max={500}
              step={1}
              value={radiusKmInput}
              onChange={(e) => setRadiusKmInput(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleRunRadiusSearch}>
              Buscar en radio
            </Button>
            {radiusSearch ? (
              <Button variant="secondary" onClick={clearRadiusSearch}>
                Limpiar búsqueda
              </Button>
            ) : null}
          </div>
        </div>
        {radiusSearchError ? (
          <p className="text-sm text-red-600 mt-3 m-0">{radiusSearchError}</p>
        ) : null}
        {radiusSearch ? (
          <p className="text-sm text-[#4b5563] mt-3 m-0">
            <span className="font-medium text-[#1a1a1a]">
              {radiusResults?.length ?? 0} fotógrafo{(radiusResults?.length ?? 0) === 1 ? "" : "s"}
            </span>{" "}
            dentro de {radiusSearch.radiusKm} km de{" "}
            <span className="font-medium">{radiusSearch.label}</span>
          </p>
        ) : null}
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 m-0">{error}</p>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[#6b7280] m-0">Registrados</p>
            <p className="text-2xl font-semibold text-[#1a1a1a] mt-1 m-0">{stats.totalRegistered}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[#6b7280] m-0">Con ubicación</p>
            <p className="text-2xl font-semibold text-[#1a1a1a] mt-1 m-0">{stats.withCoordinates}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[#6b7280] m-0">En el mapa (AR)</p>
            <p className="text-2xl font-semibold text-[#c27b3d] mt-1 m-0">{stats.onMapArgentina}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[#6b7280] m-0">Sin coordenadas</p>
            <p className="text-2xl font-semibold text-[#1a1a1a] mt-1 m-0">{stats.withoutCoordinates}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[#6b7280] m-0">Fuera de AR</p>
            <p className="text-2xl font-semibold text-[#1a1a1a] mt-1 m-0">{stats.outsideArgentinaBounds}</p>
          </Card>
        </div>
      )}

      <PhotographersArgentinaMap
        photographers={mapPhotographers}
        showOutsideArgentina={showOutside}
        radiusSearch={radiusSearch}
        height="min(72vh, 680px)"
      />

      {radiusSearch && radiusResults ? (
        <Card className="p-4 sm:p-5 overflow-x-auto">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-[#1a1a1a] m-0">
              Resultados en el radio ({radiusResults.length})
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyRadiusResultsToClipboard()}
              className="shrink-0 ml-auto"
            >
              {shareCopied ? "¡Copiado!" : "Compartir resultado"}
            </Button>
          </div>
          {radiusResults.length === 0 ? (
            <p className="text-sm text-[#6b7280] m-0">
              No hay fotógrafos con ubicación cargada dentro de {radiusSearch.radiusKm} km de este punto.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[#e5e7eb] text-xs uppercase tracking-wide text-[#6b7280]">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Fotógrafo</th>
                  <th className="py-2 pr-4 font-medium">Ubicación</th>
                  <th className="py-2 pr-4 font-medium">WhatsApp</th>
                  <th className="py-2 pr-4 font-medium">Instagram</th>
                  <th className="py-2 pr-4 font-medium text-right">Distancia</th>
                </tr>
              </thead>
              <tbody>
                {radiusResults.map((p, index) => {
                  const { addressLine, cityLine } = formatPhotographerWorkLocationParts(p);
                  return (
                  <tr key={p.id} className="border-b border-[#f3f4f6]">
                    <td className="py-2.5 pr-4 text-[#6b7280]">{index + 1}</td>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-[#111827]">{p.name || p.companyName || "—"}</div>
                      <div className="text-xs text-[#6b7280]">{p.email}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-[#4b5563] max-w-md">
                      {!addressLine && !cityLine ? (
                        "—"
                      ) : (
                        <div className="space-y-0.5">
                          {addressLine ? <div className="leading-snug">{addressLine}</div> : null}
                          {cityLine ? (
                            <div className={addressLine ? "text-xs text-[#6b7280]" : "leading-snug"}>
                              {cityLine}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-[#4b5563] whitespace-nowrap">
                      {p.whatsapp ? (
                        photographerWhatsappHref(p.whatsapp) ? (
                          <a
                            href={photographerWhatsappHref(p.whatsapp)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c27b3d] font-medium hover:underline"
                          >
                            {p.whatsapp}
                          </a>
                        ) : (
                          p.whatsapp
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-[#4b5563]">
                      {p.instagram ? (
                        photographerInstagramHref(p.instagram) ? (
                          <a
                            href={photographerInstagramHref(p.instagram)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c27b3d] font-medium hover:underline"
                          >
                            {photographerInstagramLabel(p.instagram)}
                          </a>
                        ) : (
                          p.instagram
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium text-[#2563eb] whitespace-nowrap">
                      {p.distanceKm} km
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}

      <Card className="p-4">
        <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted text-sm m-0">
          Los fotógrafos sin punto en el mapa no cargaron dirección en{" "}
          <strong>Configuración → Perfil → Ubicación de trabajo</strong>. Podés revisarlos en{" "}
          <Link href="/admin/usuarios" className="text-[#c27b3d] hover:underline font-medium">
            Usuarios
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
