"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import type { OrganizerOfficialPhotographerDto } from "@/lib/organizer-landing-official-photographers";

type SearchPhotographer = {
  id: number;
  name?: string;
  email: string;
  companyName?: string;
  city?: string;
};

export default function OrganizerLandingOfficialPhotographersManager() {
  const [items, setItems] = useState<OrganizerOfficialPhotographerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchPhotographer[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);

  const listedIds = useMemo(() => new Set(items.map((i) => i.photographerUserId)), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/landing/official-photographers", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los fotógrafos oficiales.");
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
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await fetch(
            `/api/organizer/photographers/search?q=${encodeURIComponent(q)}&limit=12`,
            { credentials: "include" }
          );
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setResults(Array.isArray(data.photographers) ? data.photographers : []);
          }
        } finally {
          setSearching(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  async function addPhotographer(photographerUserId: number) {
    setAddingId(photographerUserId);
    setError(null);
    try {
      const res = await fetch("/api/organizer/landing/official-photographers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photographerUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo agregar el fotógrafo.");
        return;
      }
      if (data.item) {
        setItems((prev) => [...prev, data.item].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));
      }
    } catch {
      setError("Error de conexión al agregar.");
    } finally {
      setAddingId(null);
    }
  }

  async function patchItem(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/organizer/landing/official-photographers/${id}`, {
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
    if (data.item) {
      setItems((prev) =>
        prev
          .map((item) => (item.id === id ? data.item : item))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      );
    }
    return true;
  }

  async function removeItem(id: number) {
    if (!window.confirm("¿Quitar este fotógrafo de tu listado oficial?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/organizer/landing/official-photographers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo quitar.");
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setError("Error de conexión al quitar.");
    }
  }

  async function moveItem(id: number, direction: "up" | "down") {
    const idx = items.findIndex((item) => item.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx];
    const b = items[swapIdx];
    const okA = await patchItem(a.id, { sortOrder: b.sortOrder });
    const okB = await patchItem(b.id, { sortOrder: a.sortOrder });
    if (okA && okB) {
      setItems((prev) => {
        const next = [...prev];
        next[idx] = { ...b, sortOrder: a.sortOrder };
        next[swapIdx] = { ...a, sortOrder: b.sortOrder };
        return next.sort((x, y) => x.sortOrder - y.sortOrder || x.id - y.id);
      });
    }
  }

  return (
    <div className="ds-stack-section">
      <DsInfoPanel title="Fotógrafos oficiales en tu página pública">
        <p className="ds-readable-text text-sm text-gray-700 m-0">
          Elegí manualmente quiénes querés mostrar como fotógrafos oficiales. Si no agregás ninguno, la
          página seguirá usando el listado automático basado en tus eventos.
        </p>
      </DsInfoPanel>

      <DsField
        label="Buscar fotógrafo para agregar"
        hint="Nombre, empresa, email o ciudad (mínimo 2 caracteres)."
        htmlFor="official-photographer-search"
      >
        <Input
          id="official-photographer-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en la plataforma…"
        />
      </DsField>

      {searching ? <p className="ds-admin-text text-xs text-gray-500 m-0">Buscando…</p> : null}

      {results.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 m-0 p-0 list-none">
          {results.map((photographer) => {
            const label =
              photographer.companyName || photographer.name || photographer.email.split("@")[0];
            const alreadyListed = listedIds.has(photographer.id);
            return (
              <li
                key={photographer.id}
                className="ds-card flex gap-3 p-3 rounded-xl border border-gray-200 bg-white items-center min-w-0"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-lg">
                  📷
                </div>
                <div className="flex-1 min-w-0 ds-content-container">
                  <p className="font-medium text-sm text-gray-900 m-0 truncate">{label}</p>
                  <p className="text-xs text-gray-500 m-0 truncate">
                    {[photographer.city, photographer.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs shrink-0 whitespace-nowrap"
                  disabled={alreadyListed || addingId === photographer.id}
                  onClick={() => void addPhotographer(photographer.id)}
                >
                  {alreadyListed ? "Agregado" : addingId === photographer.id ? "Agregando…" : "Agregar"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p className="ds-admin-text text-sm text-red-700 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ds-stack-section">
        <p className="text-sm font-semibold text-gray-900 m-0">
          En tu página pública ({items.length})
        </p>
        <p className="ds-admin-text text-xs text-gray-500 m-0">
          Las flechas ↑ ↓ definen el orden visible en la sección &quot;Fotógrafos oficiales&quot;.
        </p>

        {loading ? (
          <p className="text-sm text-gray-500 m-0">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 m-0">
            Todavía no elegiste fotógrafos oficiales. Buscá arriba y agregá los que quieras destacar.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 m-0 p-0 list-none w-full">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`ds-card rounded-xl border p-4 flex flex-col sm:flex-row gap-4 w-full min-w-0 ${
                  item.isActive ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-75"
                }`}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt="" className="max-h-16 max-w-[72px] object-contain" />
                  ) : (
                    <span className="text-2xl" aria-hidden>
                      📷
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 ds-content-container">
                  <p className="font-semibold text-gray-900 m-0">{item.name}</p>
                  {item.city ? <p className="text-sm text-gray-500 m-0 mt-1">{item.city}</p> : null}
                  <p className="text-xs text-gray-400 m-0 mt-1">
                    {item.eventsWithOrganizer > 0
                      ? `${item.eventsWithOrganizer} evento${item.eventsWithOrganizer === 1 ? "" : "s"} contigo`
                      : "Sin eventos previos registrados"}
                    {item.profileUrl ? " · Perfil público disponible" : ""}
                  </p>
                </div>
                <div className="flex flex-row sm:flex-col gap-2 sm:items-end justify-between shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(e) => void patchItem(item.id, { isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Activo
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                      disabled={index === 0}
                      onClick={() => void moveItem(item.id, "up")}
                      aria-label="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                      disabled={index === items.length - 1}
                      onClick={() => void moveItem(item.id, "down")}
                      aria-label="Bajar"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-700 underline whitespace-nowrap"
                    onClick={() => void removeItem(item.id)}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
