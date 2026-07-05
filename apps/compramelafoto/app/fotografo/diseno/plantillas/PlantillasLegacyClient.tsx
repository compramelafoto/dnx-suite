"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Album = {
  id: number;
  title: string;
};

type TemplateSlot = {
  id: number;
  index: number;
  bbox: { x: number; y: number; width: number; height: number };
};

type Template = {
  id: number;
  name: string;
  imageUrl: string;
  widthCm: number;
  heightCm: number;
  theme?: string | null;
  slots: TemplateSlot[];
};

type Tab = "mine" | "system";

export default function PlantillasLegacyClient() {
  const [tab, setTab] = useState<Tab>("mine");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [libraryTemplates, setLibraryTemplates] = useState<Template[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<Template[]>([]);
  const [systemThemeFilter, setSystemThemeFilter] = useState<string>("");
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [submitTemplateId, setSubmitTemplateId] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fotografo/diseno/productos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => {
        const list: Album[] = (data.albums ?? []).map((a: { id: number; title: string }) => ({
          id: a.id,
          title: a.title,
        }));
        setAlbums(list);
        if (list.length > 0) {
          setSelectedAlbumId((prev) => prev ?? list[0].id);
        }
      })
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAlbumId) {
      setLibraryTemplates([]);
      return;
    }
    setLoadingLibrary(true);
    fetch(`/api/dashboard/albums/${selectedAlbumId}/templates`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => setLibraryTemplates(data.templates ?? []))
      .catch(() => setLibraryTemplates([]))
      .finally(() => setLoadingLibrary(false));
  }, [selectedAlbumId]);

  useEffect(() => {
    if (tab !== "system") return;
    setLoadingSystem(true);
    const params = systemThemeFilter.trim() ? `?theme=${encodeURIComponent(systemThemeFilter.trim())}` : "";
    fetch(`/api/dashboard/templates/system${params}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => setSystemTemplates(data.templates ?? []))
      .catch(() => setSystemTemplates([]))
      .finally(() => setLoadingSystem(false));
  }, [tab, systemThemeFilter]);

  const selectedAlbum = albums.find((a) => a.id === selectedAlbumId);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-[#6b7280]">Cargando…</p>
      </div>
    );
  }

  const systemThemes = Array.from(new Set(systemTemplates.map((t) => t.theme).filter(Boolean))) as string[];

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-1">Plantillas de diseño</h1>
      <p className="text-sm text-[#6b7280] mb-4">
        {tab === "mine"
          ? "Biblioteca de plantillas por álbum. Para la preventa con packs, vinculá cada plantilla al beneficio correspondiente en el álbum (pestaña Pre-venta → packs)."
          : "Plantillas listas para usar, organizadas por temática. Podés recrearlas en tu biblioteca del álbum."}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "mine" ? "bg-[#1a1a1a] text-white" : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]"
          }`}
        >
          Mis plantillas
        </button>
        <button
          type="button"
          onClick={() => setTab("system")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "system" ? "bg-[#1a1a1a] text-white" : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]"
          }`}
        >
          Plantillas del sistema
        </button>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-[#374151]">
              Podés enviar una plantilla propia a revisión y explorar la librería pública desde acá.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/fotografo/diseno/plantillas/v2">
                <Button variant="primary">Ir a plantillas</Button>
              </Link>
              <Link href="/fotografo/diseno/plantillas/publicas">
                <Button variant="secondary" size="sm">Ver plantillas públicas</Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={submitTemplateId}
              onChange={(e) => setSubmitTemplateId(e.target.value)}
              placeholder="ID de plantilla"
              className="rounded border border-[#e5e7eb] px-3 py-2 text-sm min-w-[260px]"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={submittingReview || submitTemplateId.trim() === ""}
              onClick={async () => {
                const id = submitTemplateId.trim();
                if (!id) return;
                setSubmittingReview(true);
                setSubmitMessage(null);
                try {
                  const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(id)}/submit-for-review`, {
                    method: "POST",
                    credentials: "include",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.ok) {
                    setSubmitMessage("Plantilla enviada a revisión.");
                  } else {
                    setSubmitMessage(data?.error || "No se pudo enviar a revisión.");
                  }
                } catch {
                  setSubmitMessage("Error de red.");
                } finally {
                  setSubmittingReview(false);
                }
              }}
            >
              {submittingReview ? "Enviando..." : "Enviar a revisión"}
            </Button>
          </div>
          {submitMessage ? <p className="text-xs text-[#6b7280]">{submitMessage}</p> : null}
        </div>
      </Card>

      {tab === "system" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-sm text-[#374151]">Temática:</label>
            <select
              className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-sm bg-white"
              value={systemThemeFilter}
              onChange={(e) => setSystemThemeFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {systemThemes.map((th) => (
                <option key={th} value={th ?? ""}>
                  {th}
                </option>
              ))}
            </select>
          </div>
          {loadingSystem ? (
            <p className="text-sm text-[#6b7280]">Cargando plantillas del sistema…</p>
          ) : systemTemplates.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[#6b7280]">No hay plantillas del sistema con esta temática.</p>
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {systemTemplates.map((t) => (
                <li key={t.id}>
                  <Card className="p-0 overflow-hidden">
                    <div className="aspect-[4/3] bg-[#f3f4f6] relative">
                      <img src={t.imageUrl} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-[#1a1a1a]">{t.name}</p>
                      <p className="text-xs text-[#6b7280]">
                        {t.widthCm} × {t.heightCm} cm · {t.slots.length} recuadro{t.slots.length !== 1 ? "s" : ""}
                        {t.theme ? ` · ${t.theme}` : ""}
                      </p>
                      <p className="text-xs text-[#6b7280] mt-1">
                        Creá una plantilla similar en la biblioteca de tu álbum y asignala al beneficio del pack en Pre-venta.
                      </p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "mine" && albums.length === 0 ? (
        <Card className="p-6">
          <p className="text-[#6b7280] mb-4">
            No tenés álbumes. Creá un álbum y luego volvé acá para crear plantillas.
          </p>
          <Link href="/dashboard/albums">
            <Button variant="primary">Ir a álbumes</Button>
          </Link>
        </Card>
      ) : tab === "mine" ? (
        <>
          <Card className="p-4 mb-6">
            <label className="block text-sm font-medium text-[#374151] mb-2">Álbum</label>
            <select
              className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#1a1a1a] bg-white"
              value={selectedAlbumId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setSelectedAlbumId(Number.isFinite(id) ? id : null);
              }}
            >
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </Card>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-[#1a1a1a]">
                Biblioteca del álbum {selectedAlbum ? `(${selectedAlbum.title})` : ""}
              </h2>
              {selectedAlbumId && (
                <Link href={`/fotografo/diseno/plantillas/nueva?albumId=${selectedAlbumId}`}>
                  <Button variant="primary">
                    Crear plantilla
                  </Button>
                </Link>
              )}
            </div>
            <p className="text-sm text-[#6b7280] mb-3">
              Las plantillas quedan en la biblioteca del álbum. En preventa por packs, elegí la plantilla en cada beneficio
              (Álbum → Pre-venta → packs → beneficios).
            </p>
            {loadingLibrary ? (
              <p className="text-sm text-[#6b7280]">Cargando…</p>
            ) : libraryTemplates.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-[#6b7280] mb-4">
                  Aún no hay plantillas en la biblioteca. Creá una con el botón de arriba.
                </p>
                {selectedAlbumId && (
                  <Link href={`/fotografo/diseno/plantillas/nueva?albumId=${selectedAlbumId}`}>
                    <Button variant="primary">Crear primera plantilla</Button>
                  </Link>
                )}
              </Card>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {libraryTemplates.map((t) => (
                  <li key={t.id}>
                    <Card className="p-0 overflow-hidden">
                      <div className="aspect-[4/3] bg-[#f3f4f6] relative">
                        <img src={t.imageUrl} alt="" className="w-full h-full object-contain" />
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-[#1a1a1a]">{t.name}</p>
                        <p className="text-xs text-[#6b7280]">
                          {t.widthCm} × {t.heightCm} cm · {t.slots.length} recuadro{t.slots.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
