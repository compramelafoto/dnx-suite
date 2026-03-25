"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type TemplateRow = {
  id: number;
  name: string;
  imageUrl: string;
  widthCm: number;
  heightCm: number;
  isSystemTemplate: boolean;
  theme: string | null;
  album: { id: number; title: string };
  slots: { id: number }[];
};

type AlbumOption = { id: number; title: string };

export default function AdminPlantillasPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSystem, setFilterSystem] = useState<string>("");
  const [filterTheme, setFilterTheme] = useState("");
  const [patchingId, setPatchingId] = useState<number | null>(null);
  const [themeInputs, setThemeInputs] = useState<Record<number, string>>({});
  const [createAlbumId, setCreateAlbumId] = useState<string>("");

  useEffect(() => {
    loadTemplates();
  }, [filterSystem, filterTheme]);

  useEffect(() => {
    fetch("/api/admin/albums?visibility=public", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { albums: [] }))
      .then((data) => setAlbums(data.albums?.slice(0, 200).map((a: { id: number; title: string }) => ({ id: a.id, title: a.title })) ?? []))
      .catch(() => setAlbums([]));
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSystem === "true") params.set("isSystem", "true");
      if (filterSystem === "false") params.set("isSystem", "false");
      if (filterTheme.trim()) params.set("theme", filterTheme.trim());
      const res = await fetch(`/api/admin/templates?${params.toString()}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSystem(t: TemplateRow) {
    setPatchingId(t.id);
    try {
      const res = await fetch(`/api/admin/templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isSystemTemplate: !t.isSystemTemplate }),
      });
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, isSystemTemplate: !x.isSystemTemplate } : x))
        );
      }
    } finally {
      setPatchingId(null);
    }
  }

  async function saveTheme(t: TemplateRow) {
    const theme = themeInputs[t.id] ?? t.theme ?? "";
    setPatchingId(t.id);
    try {
      const res = await fetch(`/api/admin/templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: theme.trim() || null }),
      });
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, theme: theme.trim() || null } : x))
        );
        setThemeInputs((prev) => ({ ...prev, [t.id]: "" }));
      }
    } finally {
      setPatchingId(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">Plantillas</h1>
      <p className="text-sm text-[#6b7280] mb-6">
        Todas las plantillas de la plataforma. Las marcadas como &quot;del sistema&quot; aparecen en &quot;Plantillas del sistema&quot; para los fotógrafos, agrupadas por temática.
      </p>

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#374151]">Filtrar:</label>
            <select
              className="rounded border border-[#e5e7eb] px-2 py-1.5 text-sm bg-white"
              value={filterSystem}
              onChange={(e) => setFilterSystem(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="true">Solo del sistema</option>
              <option value="false">Solo de usuarios</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#374151]">Temática:</label>
            <input
              type="text"
              className="rounded border border-[#e5e7eb] px-2 py-1.5 text-sm w-40"
              placeholder="ej. Bodas"
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <Link href="/fotografo/diseno/plantillas/nueva?system=1">
              <Button variant="primary" size="sm">
                Crear plantilla pública (sin álbum)
              </Button>
            </Link>
            <span className="text-sm text-[#6b7280]">o en álbum:</span>
            <select
              className="rounded border border-[#e5e7eb] px-2 py-1.5 text-sm bg-white min-w-[180px]"
              value={createAlbumId}
              onChange={(e) => setCreateAlbumId(e.target.value)}
            >
              <option value="">— Elegir álbum —</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} (ID {a.id})
                </option>
              ))}
            </select>
            <Link
              href={createAlbumId ? `/fotografo/diseno/plantillas/nueva?albumId=${createAlbumId}` : "#"}
              className={!createAlbumId ? "pointer-events-none opacity-60" : ""}
            >
              <Button variant="secondary" size="sm" disabled={!createAlbumId}>
                Ir a crear en álbum
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando…</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#6b7280]">No hay plantillas con los filtros elegidos.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-[#6b7280]">
                <th className="pb-2 pr-2">Vista</th>
                <th className="pb-2 pr-2">Nombre</th>
                <th className="pb-2 pr-2">Álbum</th>
                <th className="pb-2 pr-2">Medidas</th>
                <th className="pb-2 pr-2">Del sistema</th>
                <th className="pb-2 pr-2">Temática</th>
                <th className="pb-2 pr-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-[#e5e7eb]">
                  <td className="py-2 pr-2">
                    <div className="w-14 h-10 bg-[#f3f4f6] rounded overflow-hidden">
                      <img src={t.imageUrl} alt="" className="w-full h-full object-contain" />
                    </div>
                  </td>
                  <td className="py-2 pr-2 font-medium text-[#1a1a1a]">{t.name}</td>
                  <td className="py-2 pr-2 text-[#6b7280]">{t.album?.title ?? "—"}</td>
                  <td className="py-2 pr-2 text-[#6b7280]">{t.widthCm}×{t.heightCm} cm</td>
                  <td className="py-2 pr-2">
                    {t.isSystemTemplate ? (
                      <span className="text-green-600 text-xs">Sí</span>
                    ) : (
                      <span className="text-[#6b7280] text-xs">No</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="rounded border border-[#e5e7eb] px-2 py-1 text-xs w-28"
                      placeholder="Temática"
                      value={themeInputs[t.id] ?? t.theme ?? ""}
                      onChange={(e) => setThemeInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="ml-1 text-xs text-[#c27b3d] hover:underline"
                      onClick={() => saveTheme(t)}
                      disabled={patchingId === t.id}
                    >
                      Guardar
                    </button>
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      className="text-xs text-[#c27b3d] hover:underline"
                      onClick={() => toggleSystem(t)}
                      disabled={patchingId === t.id}
                    >
                      {t.isSystemTemplate ? "Quitar del sistema" : "Marcar del sistema"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
