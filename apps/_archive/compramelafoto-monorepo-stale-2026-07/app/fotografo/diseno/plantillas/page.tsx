"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Album = {
  id: number;
  title: string;
  albumProducts: {
    id: number;
    name: string;
    requiresDesign: boolean;
    _count: { templates: number };
  }[];
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

export default function PlantillasPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [libraryTemplates, setLibraryTemplates] = useState<Template[]>([]);
  const [productTemplates, setProductTemplates] = useState<Template[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<Template[]>([]);
  const [systemThemeFilter, setSystemThemeFilter] = useState<string>("");
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [systemTemplatesForAssign, setSystemTemplatesForAssign] = useState<Template[]>([]);
  const [loadingSystemForAssign, setLoadingSystemForAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetch("/api/fotografo/diseno/productos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => {
        setAlbums(data.albums ?? []);
        if ((data.albums?.length ?? 0) > 0 && !selectedAlbumId) {
          setSelectedAlbumId(data.albums[0].id);
          const firstProduct = data.albums[0].albumProducts?.[0];
          setSelectedProductId(firstProduct?.id ?? null);
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
    if (!selectedAlbumId || !selectedProductId) {
      setProductTemplates([]);
      return;
    }
    setLoadingProduct(true);
    fetch(
      `/api/dashboard/albums/${selectedAlbumId}/precompra-products/${selectedProductId}/templates`,
      { credentials: "include" }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => setProductTemplates(data.templates ?? []))
      .catch(() => setProductTemplates([]))
      .finally(() => setLoadingProduct(false));
  }, [selectedAlbumId, selectedProductId]);

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

  useEffect(() => {
    if (!selectedAlbumId || !selectedProductId) {
      setSystemTemplatesForAssign([]);
      return;
    }
    setLoadingSystemForAssign(true);
    fetch("/api/dashboard/templates/system", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => setSystemTemplatesForAssign(data.templates ?? []))
      .catch(() => setSystemTemplatesForAssign([]))
      .finally(() => setLoadingSystemForAssign(false));
  }, [selectedAlbumId, selectedProductId]);

  const selectedAlbum = albums.find((a) => a.id === selectedAlbumId);
  const selectedProduct = selectedAlbum?.albumProducts.find((p) => p.id === selectedProductId);

  const handleAssignToProduct = async (templateId: number) => {
    if (!selectedAlbumId || !selectedProductId) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/dashboard/albums/${selectedAlbumId}/precompra-products/${selectedProductId}/templates/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ templateId }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al asignar");
      setProductTemplates((prev) => [...prev, data.template]);
    } catch (_e) {
      // could set error state
    } finally {
      setAssigning(false);
    }
  };

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
          ? "Creá plantillas en la biblioteca del álbum y asignálas a los productos que requieran diseño."
          : "Plantillas listas para usar, organizadas por temática. Podés copiarlas a tu álbum desde la biblioteca."}
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
                <option key={th} value={th ?? ""}>{th}</option>
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
                        Para usar esta plantilla, creá una en tu álbum y asignala a tu producto, o pedí al administrador que la comparta.
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
            <div className="flex flex-wrap gap-3">
              <select
                className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#1a1a1a] bg-white"
                value={selectedAlbumId ?? ""}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  setSelectedAlbumId(id);
                  const album = albums.find((a) => a.id === id);
                  const first = album?.albumProducts?.[0];
                  setSelectedProductId(first?.id ?? null);
                }}
              >
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
              {selectedAlbum && selectedAlbum.albumProducts.length > 0 && (
                <>
                  <span className="text-[#6b7280] self-center text-sm">Producto (opcional):</span>
                  <select
                    className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#1a1a1a] bg-white"
                    value={selectedProductId ?? ""}
                    onChange={(e) => setSelectedProductId(parseInt(e.target.value, 10) || null)}
                  >
                    <option value="">— Ver solo biblioteca —</option>
                    {selectedAlbum.albumProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p._count.templates} asignadas)
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </Card>

          {/* Biblioteca del álbum: plantillas guardadas primero */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-[#1a1a1a]">
                Biblioteca del álbum {selectedAlbum ? `(${selectedAlbum.title})` : ""}
              </h2>
              {selectedAlbumId && (
                <Link href={`/fotografo/diseno/plantillas/nueva?albumId=${selectedAlbumId}`}>
                  <Button variant="primary" size="sm">
                    Crear plantilla
                  </Button>
                </Link>
              )}
            </div>
            <p className="text-sm text-[#6b7280] mb-3">
              Las plantillas que crees acá quedan en la biblioteca. Luego podés asignarlas a cualquier producto del álbum que requiera diseño.
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

          {/* Plantillas asignadas a este producto */}
          {selectedAlbumId && selectedProductId && selectedProduct && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-medium text-[#1a1a1a]">
                  Plantillas asignadas a «{selectedProduct.name}»
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {libraryTemplates.length > 0 && (
                    <select
                      className="rounded-md border border-[#e5e7eb] px-2 py-1.5 text-sm bg-white"
                      defaultValue=""
                      onChange={(e) => {
                        const id = parseInt(e.target.value, 10);
                        if (Number.isInteger(id)) handleAssignToProduct(id);
                        e.target.value = "";
                      }}
                      disabled={assigning}
                    >
                      <option value="">Asignar desde biblioteca…</option>
                      {libraryTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {systemTemplatesForAssign.length > 0 && (
                    <select
                      className="rounded-md border border-[#e5e7eb] px-2 py-1.5 text-sm bg-white"
                      defaultValue=""
                      onChange={(e) => {
                        const id = parseInt(e.target.value, 10);
                        if (Number.isInteger(id)) handleAssignToProduct(id);
                        e.target.value = "";
                      }}
                      disabled={assigning || loadingSystemForAssign}
                    >
                      <option value="">Asignar desde plantillas del sistema…</option>
                      {systemTemplatesForAssign.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.theme ? ` (${t.theme})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <Link href={`/fotografo/diseno/plantillas/nueva?albumId=${selectedAlbumId}&productId=${selectedProductId}`}>
                    <Button variant="secondary" size="sm">
                      Crear plantilla para este producto
                    </Button>
                  </Link>
                </div>
              </div>
              {loadingProduct ? (
                <p className="text-sm text-[#6b7280]">Cargando…</p>
              ) : productTemplates.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-[#6b7280]">
                    Este producto aún no tiene plantillas. Asigná una desde la biblioteca de arriba o creá una para este producto.
                  </p>
                </Card>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {productTemplates.map((t) => (
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
          )}
        </>
      ) : null}
    </div>
  );
}
