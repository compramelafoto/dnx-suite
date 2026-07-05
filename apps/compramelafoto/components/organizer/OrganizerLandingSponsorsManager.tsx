"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import type { OrganizerSponsorDto } from "@/lib/organizer-landing-sponsors";

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function OrganizerLandingSponsorsManager() {
  const [items, setItems] = useState<OrganizerSponsorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const logoInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/landing/sponsors", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los auspiciantes.");
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

  async function createSponsor() {
    const name = newName.trim();
    if (name.length < 2) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/landing/sponsors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo crear el sponsor.");
        return;
      }
      if (data.sponsor) {
        setItems((prev) => [...prev, data.sponsor]);
        setNewName("");
      }
    } catch {
      setError("Error de conexión al crear.");
    } finally {
      setCreating(false);
    }
  }

  async function patchSponsor(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/organizer/landing/sponsors/${id}`, {
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
    if (data.sponsor) {
      setItems((prev) => prev.map((s) => (s.id === id ? data.sponsor : s)));
    }
    return true;
  }

  async function deleteSponsor(id: number) {
    if (!window.confirm("¿Eliminar este sponsor?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/organizer/landing/sponsors/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo eliminar.");
        return;
      }
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Error de conexión al eliminar.");
    }
  }

  async function uploadLogo(id: number, file: File) {
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/organizer/landing/sponsors/${id}/logo`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error subiendo logo.");
        return;
      }
      if (data.sponsor) {
        setItems((prev) => prev.map((s) => (s.id === id ? data.sponsor : s)));
      }
    } catch {
      setError("Error de conexión al subir logo.");
    }
  }

  async function moveSponsor(id: number, direction: "up" | "down") {
    const idx = items.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx];
    const b = items[swapIdx];
    const okA = await patchSponsor(a.id, { sortOrder: b.sortOrder });
    const okB = await patchSponsor(b.id, { sortOrder: a.sortOrder });
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
    <div className="space-y-5">
      <DsInfoPanel title="Auspiciantes en tu página pública">
        <p className="ds-readable-text text-sm text-gray-700 m-0">
          Cargá los auspiciantes o marcas que acompañan tus eventos. En tu página pública se mostrarán como un carrusel con
          link a su web o red social.
        </p>
      </DsInfoPanel>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre del sponsor"
          className="flex-1 w-full min-w-0"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void createSponsor();
            }
          }}
        />
        <Button
          type="button"
          variant="primary"
          disabled={creating || newName.trim().length < 2}
          onClick={() => void createSponsor()}
          className="shrink-0 whitespace-nowrap"
        >
          {creating ? "Agregando…" : "Agregar sponsor"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red-700 m-0" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 m-0">Cargando auspiciantes…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 m-0">Todavía no hay auspiciantes. Agregá el primero arriba.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 m-0 p-0 list-none">
          {items.map((sponsor, index) => (
            <li
              key={sponsor.id}
              className={`ds-card rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row gap-4 ${
                sponsor.isActive ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-80"
              }`}
            >
              <div className="flex items-center justify-center w-full sm:w-28 h-20 sm:h-24 rounded-lg border border-gray-100 bg-white flex-shrink-0">
                {sponsor.logoUrl ? (
                  <img
                    src={sponsor.logoUrl}
                    alt=""
                    className="max-h-16 max-w-[100px] object-contain px-2"
                  />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-2">Sin logo</span>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <Input
                    defaultValue={sponsor.name}
                    className="w-full"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== sponsor.name) void patchSponsor(sponsor.id, { name: v });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Link (opcional)</label>
                  <Input
                    defaultValue={sponsor.url ?? ""}
                    placeholder="https://…"
                    className="w-full"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      const current = sponsor.url ?? "";
                      if (v !== current) void patchSponsor(sponsor.id, { url: v || null });
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-row sm:flex-col gap-2 sm:items-end justify-between sm:justify-start flex-shrink-0">
                <input
                  ref={(el) => {
                    logoInputs.current[sponsor.id] = el;
                  }}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  aria-hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(sponsor.id, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs whitespace-nowrap"
                  onClick={() => logoInputs.current[sponsor.id]?.click()}
                >
                  {sponsor.logoUrl ? "Cambiar logo" : "Subir logo"}
                </Button>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sponsor.isActive}
                    onChange={(e) => void patchSponsor(sponsor.id, { isActive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Activo
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    disabled={index === 0}
                    onClick={() => void moveSponsor(sponsor.id, "up")}
                    aria-label="Subir orden"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    disabled={index === items.length - 1}
                    onClick={() => void moveSponsor(sponsor.id, "down")}
                    aria-label="Bajar orden"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-700 underline hover:no-underline"
                  onClick={() => void deleteSponsor(sponsor.id)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
