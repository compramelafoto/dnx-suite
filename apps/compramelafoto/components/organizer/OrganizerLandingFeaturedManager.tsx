"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsField } from "@/components/ui/DsField";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import {
  FEATURED_LIST_SORT_OPTIONS,
  filterFeaturedGalleryItems,
  sortFeaturedGalleryItems,
  type FeaturedListSortKey,
  type OrganizerFeaturedGalleryDto,
} from "@/lib/organizer-landing-featured";

type SearchResult = {
  events: Array<{
    id: number;
    title: string;
    city: string;
    startsAt: string;
    coverUrl: string | null;
    isPublic: boolean;
    joinUrl: string | null;
    alreadyFeatured: boolean;
  }>;
  albums: Array<{
    id: number;
    title: string;
    city: string | null;
    eventTitle: string | null;
    coverUrl: string | null;
    albumUrl: string;
    alreadyFeatured: boolean;
  }>;
};

const TZ = "America/Argentina/Buenos_Aires";

function formatEventDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: TZ,
    });
  } catch {
    return null;
  }
}

function itemMetaLine(item: OrganizerFeaturedGalleryDto): string {
  const parts: string[] = [];
  if (item.city) parts.push(item.city);
  const date = formatEventDate(item.eventStartsAt);
  if (date) parts.push(date);
  if (item.photographerLabel) parts.push(item.photographerLabel);
  return parts.join(" · ");
}

export default function OrganizerLandingFeaturedManager() {
  const [items, setItems] = useState<OrganizerFeaturedGalleryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [listFilter, setListFilter] = useState("");
  const [listSort, setListSort] = useState<FeaturedListSortKey>("manual");
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState<SearchResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/landing/featured", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los destacados.");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await fetch(
            `/api/organizer/landing/featured/search?q=${encodeURIComponent(addQuery)}`,
            { credentials: "include" }
          );
          const data = await res.json().catch(() => ({}));
          if (res.ok) setSearch(data);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [addQuery]);

  const displayedItems = useMemo(() => {
    const filtered = filterFeaturedGalleryItems(items, listFilter);
    return sortFeaturedGalleryItems(filtered, listSort);
  }, [items, listFilter, listSort]);

  const manualSort = listSort === "manual";

  async function addFeatured(payload: { albumId?: number; eventId?: number }) {
    setError(null);
    try {
      const res = await fetch("/api/organizer/landing/featured", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo agregar.");
        return;
      }
      if (data.item) setItems((prev) => [...prev, data.item]);
    } catch {
      setError("Error de conexión.");
    }
  }

  async function patchFeatured(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/organizer/landing/featured/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar.");
      return false;
    }
    if (data.item) setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
    return true;
  }

  async function removeFeatured(id: number) {
    if (!window.confirm("¿Quitar de destacados?")) return;
    const res = await fetch(`/api/organizer/landing/featured/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo eliminar.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function move(id: number, direction: "up" | "down") {
    const ordered = sortFeaturedGalleryItems(items, "manual");
    const idx = ordered.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    const okA = await patchFeatured(a.id, { sortOrder: b.sortOrder });
    const okB = await patchFeatured(b.id, { sortOrder: a.sortOrder });
    if (okA && okB) {
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.id === a.id) return { ...item, sortOrder: b.sortOrder };
          if (item.id === b.id) return { ...item, sortOrder: a.sortOrder };
          return item;
        });
        return sortFeaturedGalleryItems(next, "manual");
      });
    }
  }

  return (
    <div className="ds-stack-section">
      <DsInfoPanel title="Galerías destacadas en tu página pública">
        <p className="ds-readable-text text-sm text-gray-700 m-0">
          Elegí álbumes o eventos propios para mostrarlos en la portada pública. Solo se listan contenidos
          públicos.
        </p>
      </DsInfoPanel>

      <DsField label="Buscar álbum o evento para agregar" hint="Nombre, ciudad, evento…">
        <Input
          value={addQuery}
          onChange={(e) => setAddQuery(e.target.value)}
          placeholder="Escribí para buscar y agregar…"
        />
      </DsField>
      {searching ? <p className="ds-admin-text text-xs text-gray-500 m-0">Buscando…</p> : null}

      {search && (search.events.length > 0 || search.albums.length > 0) ? (
        <div className="ds-stack-section">
          {search.events.length > 0 ? (
            <div className="ds-stack-section">
              <p className="text-sm font-medium text-gray-800 m-0">Eventos</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 m-0 p-0 list-none">
                {search.events.map((ev) => (
                  <li
                    key={`ev-${ev.id}`}
                    className="ds-card flex gap-3 p-3 rounded-xl border border-gray-200 bg-white items-center min-w-0"
                  >
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {ev.coverUrl ? (
                        <img src={ev.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0 ds-content-container">
                      <p className="font-medium text-sm text-gray-900 m-0 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-500 m-0 truncate">
                        {[ev.city, formatEventDate(ev.startsAt)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs shrink-0 whitespace-nowrap"
                      disabled={ev.alreadyFeatured || !ev.isPublic}
                      onClick={() => void addFeatured({ eventId: ev.id })}
                    >
                      {ev.alreadyFeatured ? "Agregado" : "Agregar"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {search.albums.length > 0 ? (
            <div className="ds-stack-section">
              <p className="text-sm font-medium text-gray-800 m-0">Álbumes</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 m-0 p-0 list-none">
                {search.albums.map((alb) => (
                  <li
                    key={`alb-${alb.id}`}
                    className="ds-card flex gap-3 p-3 rounded-xl border border-gray-200 bg-white items-center min-w-0"
                  >
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {alb.coverUrl ? (
                        <img src={alb.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0 ds-content-container">
                      <p className="font-medium text-sm text-gray-900 m-0 truncate">{alb.title}</p>
                      <p className="text-xs text-gray-500 m-0 truncate">
                        {[alb.eventTitle, alb.city].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs shrink-0 whitespace-nowrap"
                      disabled={alb.alreadyFeatured}
                      onClick={() => void addFeatured({ albumId: alb.id })}
                    >
                      {alb.alreadyFeatured ? "Agregado" : "Agregar"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="ds-admin-text text-sm text-red-700 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ds-stack-section">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm font-semibold text-gray-900 m-0">
            En tu página pública ({items.length})
            {listFilter.trim() ? (
              <span className="font-normal text-gray-500">
                {" "}
                · {displayedItems.length} coincidencia{displayedItems.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
        </div>

        <div className="ds-form-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_min(16rem,100%)] gap-3 w-full max-w-3xl">
          <DsField
            label="Filtrar listado"
            hint="Nombre, ciudad, fotógrafo, tipo (evento/álbum)…"
            htmlFor="featured-list-filter"
          >
            <Input
              id="featured-list-filter"
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder="Buscar en tus destacados…"
            />
          </DsField>
          <DsField label="Ordenar por" htmlFor="featured-list-sort">
            <Select
              id="featured-list-sort"
              value={listSort}
              onChange={(e) => setListSort(e.target.value as FeaturedListSortKey)}
            >
              {FEATURED_LIST_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </DsField>
        </div>

        {manualSort ? (
          <p className="ds-admin-text text-xs text-gray-500 m-0">
            Las flechas ↑ ↓ definen el orden visible en tu página pública.
          </p>
        ) : (
          <p className="ds-admin-text text-xs text-gray-500 m-0">
            Vista ordenada por criterio seleccionado. Elegí &quot;Orden manual&quot; para reordenar la página
            pública.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 m-0">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 m-0">Todavía no hay destacados.</p>
        ) : displayedItems.length === 0 ? (
          <p className="text-sm text-gray-500 m-0">Ningún destacado coincide con el filtro.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 m-0 p-0 list-none w-full">
            {displayedItems.map((item) => {
              const manualIndex = manualSort
                ? sortFeaturedGalleryItems(items, "manual").findIndex((i) => i.id === item.id)
                : -1;
              const meta = itemMetaLine(item);

              return (
                <li
                  key={item.id}
                  className={`ds-card rounded-xl border p-4 flex flex-col sm:flex-row gap-4 w-full min-w-0 ${
                    item.isActive ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-75"
                  }`}
                >
                  <div className="w-full sm:w-32 h-24 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        Sin portada
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 ds-content-container">
                    <p className="font-semibold text-gray-900 m-0">{item.title}</p>
                    {meta ? (
                      <p className="text-sm text-gray-500 m-0 mt-1 ds-readable-text ds-readable-text--fluid">
                        {meta}
                      </p>
                    ) : item.subtitle ? (
                      <p className="text-sm text-gray-500 m-0 mt-1">{item.subtitle}</p>
                    ) : null}
                    <p className="text-xs text-gray-400 m-0 mt-1">
                      {item.kind === "event" ? "Evento" : "Álbum"}
                    </p>
                  </div>
                  <div className="flex flex-row sm:flex-col gap-2 sm:items-end justify-between shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={(e) => void patchFeatured(item.id, { isActive: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      Activo
                    </label>
                    {manualSort ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                          disabled={manualIndex <= 0}
                          onClick={() => void move(item.id, "up")}
                          aria-label="Subir"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                          disabled={manualIndex < 0 || manualIndex >= items.length - 1}
                          onClick={() => void move(item.id, "down")}
                          aria-label="Bajar"
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs text-red-700 underline whitespace-nowrap"
                      onClick={() => void removeFeatured(item.id)}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
