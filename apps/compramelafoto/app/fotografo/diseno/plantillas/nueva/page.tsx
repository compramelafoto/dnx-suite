"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TemplateSlotsCanvas, { type TemplateSlot } from "@/components/fotolibros/TemplateSlotsCanvas";

type Slot = { index: number; bbox: { x: number; y: number; width: number; height: number } };

type TemplateTextElement = {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
};

type PageState = {
  imageUrl: string | null;
  widthCm: number;
  heightCm: number;
  slots: Slot[];
  textElements: TemplateTextElement[];
  previewUrl: string | null;
  imageFile: File | null;
  imgSize: { w: number; h: number };
};

const emptyPage = (): PageState => ({
  imageUrl: null,
  widthCm: 20,
  heightCm: 20,
  slots: [],
  textElements: [],
  previewUrl: null,
  imageFile: null,
  imgSize: { w: 0, h: 0 },
});

export default function NuevaPlantillaPage() {
  const searchParams = useSearchParams();
  const albumId = searchParams.get("albumId");
  const productId = searchParams.get("productId");
  const systemMode = searchParams.get("system") === "1";

  const [userRole, setUserRole] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pages, setPages] = useState<PageState[]>([emptyPage()]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const page = pages[activePageIndex];
  const widthCm = page?.widthCm ?? 20;
  const heightCm = page?.heightCm ?? 20;
  const imageUrl = page?.imageUrl ?? null;
  const previewUrl = page?.previewUrl ?? null;
  const slots = page?.slots ?? [];
  const textElements = page?.textElements ?? [];
  const imgSize = page?.imgSize ?? { w: 0, h: 0 };

  const setPage = (updater: (p: PageState) => PageState) => {
    setPages((prev) =>
      prev.map((p, i) => (i === activePageIndex ? updater(p) : p))
    );
  };
  const setWidthCm = (v: number) => setPage((p) => ({ ...p, widthCm: v }));
  const setHeightCm = (v: number) => setPage((p) => ({ ...p, heightCm: v }));
  const setSlots = (v: Slot[] | ((prev: Slot[]) => Slot[])) => {
    setPage((p) => ({ ...p, slots: typeof v === "function" ? v(p.slots) : v }));
  };
  const setTextElements = (v: TemplateTextElement[] | ((prev: TemplateTextElement[]) => TemplateTextElement[])) => {
    setPage((p) => ({ ...p, textElements: typeof v === "function" ? v(p.textElements) : v }));
  };
  const setImgSize = (v: { w: number; h: number }) => setPage((p) => ({ ...p, imgSize: v }));
  const setPreviewUrl = (v: string | null) => setPage((p) => ({ ...p, previewUrl: v }));
  const setImageUrl = (v: string | null) => setPage((p) => ({ ...p, imageUrl: v }));
  const setImageFile = (v: File | null) => setPage((p) => ({ ...p, imageFile: v }));

  const addPage = () => {
    setPages((prev) => [...prev, emptyPage()]);
    setActivePageIndex(pages.length);
    setSelectedSlotIndex(null);
  };
  const removePage = (index: number) => {
    if (pages.length <= 1) return;
    setPages((prev) => prev.filter((_, i) => i !== index));
    setActivePageIndex((prev) => (prev >= index && prev > 0 ? prev - 1 : prev));
    setSelectedSlotIndex(null);
  };

  useEffect(() => {
    if (!systemMode) return;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => setUserRole(data?.user?.role ?? null))
      .catch(() => setUserRole(null));
  }, [systemMode]);

  const isAdminSystem = systemMode && userRole === "ADMIN";
  const canCreateWithoutAlbum = systemMode && isAdminSystem;

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth) {
      setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  }, [previewUrl, activePageIndex]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl(null);
    setSlots([]);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!page?.imageFile) return;
    if (!canCreateWithoutAlbum && !albumId) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", page.imageFile);
      const url = canCreateWithoutAlbum
        ? "/api/admin/template-image/upload"
        : `/api/dashboard/albums/${albumId}/template-image/upload`;
      const res = await fetch(url, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al subir");
      setImageUrl(data.imageUrl);
      setPreviewUrl(data.imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const addSlot = () => {
    const w = imgSize.w || 700;
    const h = imgSize.h || 500;
    const slotW = Math.min(200, w * 0.3);
    const slotH = Math.min(200, h * 0.3);
    setSlots((prev) => [
      ...prev,
      {
        index: prev.length,
        bbox: {
          x: Math.round((w - slotW) / 2),
          y: Math.round((h - slotH) / 2),
          width: Math.round(slotW),
          height: Math.round(slotH),
        },
      },
    ]);
  };

  const removeSlot = (i: number) => {
    setSlots((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, index: idx })));
    setSelectedSlotIndex(null);
  };

  const addTextElement = () => {
    const w = imgSize.w || 700;
    const h = imgSize.h || 500;
    setTextElements((prev) => [
      ...prev,
      {
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: Math.round(w * 0.2),
        y: Math.round(h * 0.2),
        text: "Texto",
        fontSize: 24,
        fontFamily: "Inter",
        fill: "#000000",
      },
    ]);
  };

  const updateTextElement = (id: string, next: Partial<TemplateTextElement>) => {
    setTextElements((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)));
  };

  const removeTextElement = (id: string) => {
    setTextElements((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Nombre requerido");
      return;
    }
    const first = pages[0];
    if (!first?.imageUrl) {
      setError("Subí la imagen de la primera hoja a la nube (botón «Subir a la nube») antes de guardar.");
      return;
    }
    if (!canCreateWithoutAlbum && !albumId) {
      setError("Falta el álbum.");
      return;
    }
    for (let i = 1; i < pages.length; i++) {
      if (!pages[i]?.imageUrl) {
        setError(`La hoja ${i + 1} debe tener su imagen subida a la nube.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const main = pages[0]!;
      const payload = {
        name: name.trim(),
        imageUrl: main.imageUrl,
        widthCm: Number(main.widthCm) || 20,
        heightCm: Number(main.heightCm) || 20,
        slots: main.slots.map((s, i) => ({ index: i, bbox: s.bbox })),
        textElements: main.textElements.length > 0 ? main.textElements : undefined,
        pagesJson:
          pages.length > 1
            ? pages.slice(1).map((p) => ({
                imageUrl: p.imageUrl,
                widthCm: Number(p.widthCm) || 20,
                heightCm: Number(p.heightCm) || 20,
                slots: p.slots.map((s, i) => ({ index: i, bbox: s.bbox })),
                textElements: p.textElements.length > 0 ? p.textElements : undefined,
              }))
            : undefined,
      };
      const url = canCreateWithoutAlbum
        ? "/api/admin/templates"
        : productId
          ? `/api/dashboard/albums/${albumId}/precompra-products/${productId}/templates`
          : `/api/dashboard/albums/${albumId}/templates`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      const redirect = canCreateWithoutAlbum
        ? "/admin/plantillas"
        : productId
          ? `/fotografo/diseno/plantillas?albumId=${albumId}&productId=${productId}`
          : `/fotografo/diseno/plantillas?albumId=${albumId}`;
      window.location.href = redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!albumId && !canCreateWithoutAlbum) {
    if (systemMode && userRole !== null && userRole !== "ADMIN") {
      return (
        <div className="p-6">
          <p className="text-[#6b7280] mb-4">Solo administradores pueden crear plantillas públicas del sistema.</p>
          <Link href="/fotografo/diseno/plantillas">
            <Button variant="secondary">Ir a Plantillas</Button>
          </Link>
        </div>
      );
    }
    if (!systemMode) {
      return (
        <div className="p-6">
          <p className="text-[#6b7280] mb-4">Falta el álbum. Volvé a Plantillas y elegí un álbum.</p>
          <Link href="/fotografo/diseno/plantillas">
            <Button variant="secondary">Ir a Plantillas</Button>
          </Link>
        </div>
      );
    }
    if (systemMode && userRole === null) {
      return (
        <div className="p-6">
          <p className="text-[#6b7280] mb-4">Cargando…</p>
        </div>
      );
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f1f5f9]">
      <header className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-[#e2e8f0]">
        <Link
          href={canCreateWithoutAlbum ? "/admin/plantillas" : "/fotografo/diseno/plantillas"}
          className="text-[#64748b] hover:text-[#1a1a1a] text-sm"
        >
          {canCreateWithoutAlbum ? "← Admin Plantillas" : "← Plantillas"}
        </Link>
        <div className="flex-1 font-semibold text-[#1a1a1a]">
          {canCreateWithoutAlbum ? "Nueva plantilla pública (sin álbum)" : "Nueva plantilla"}
        </div>
        <div className="flex items-center gap-2">
          <Link href={canCreateWithoutAlbum ? "/admin/plantillas" : "/fotografo/diseno/plantillas"}>
            <Button type="button" variant="secondary" size="sm">
              Cancelar
            </Button>
          </Link>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim() || !imageUrl}
          >
            {saving ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </div>
      </header>

      {error && (
        <div className="shrink-0 mx-3 mt-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-0 lg:gap-3 p-3 overflow-hidden">
        {/* Panel izquierdo: hojas, imagen, datos (igual que diseñador: controles) */}
        <div className="min-h-0 min-w-0 flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">
            <div>
              <p className="text-sm font-medium text-[#1a1a1a] mb-2">Hojas</p>
              <div className="flex flex-wrap items-center gap-2">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setActivePageIndex(i); setSelectedSlotIndex(null); }}
                    className={`min-w-[72px] rounded-md border px-3 py-2 text-left text-xs font-medium ${
                      activePageIndex === i
                        ? "border-[#c27b3d] bg-[#fff7ee] text-[#1a1a1a]"
                        : "border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9fafb]"
                    }`}
                  >
                    Hoja {i + 1}
                  </button>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={addPage}>
                  Agregar hoja
                </Button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePage(activePageIndex)}
                    className="text-xs text-[#c27b3d] hover:underline"
                  >
                    Quitar esta hoja
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[#1a1a1a] mb-2">Fondo de la plantilla</p>
              <p className="text-xs text-[#6b7280] mb-2">
                Subí la imagen del diseño. Luego &quot;Subir a la nube&quot; para usarla. El fondo no se deforma en el editor.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="text-sm rounded-md border border-[#e5e7eb] px-2 py-1.5 file:mr-2 file:rounded-md file:border-0 file:bg-[#f3f4f6] file:px-2 file:py-1 file:text-xs"
                />
                {page?.imageFile && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? "Subiendo…" : "Subir a la nube"}
                  </Button>
                )}
              </div>
            </div>

            {(previewUrl || imageUrl) && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[#1a1a1a]">Datos de la plantilla</p>
                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Nombre</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej. Díptico 4 fotos"
                    className="rounded-md border border-[#e5e7eb] px-2 py-2 text-sm w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-[#6b7280] mb-1">Ancho (cm)</label>
                    <Input
                      type="number"
                      min={1}
                      step={0.5}
                      value={widthCm}
                      onChange={(e) => setWidthCm(Math.max(1, Number(e.target.value) || 1))}
                      className="rounded-md border border-[#e5e7eb] px-2 py-2 text-sm w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-[#6b7280] mb-1">Alto (cm)</label>
                    <Input
                      type="number"
                      min={1}
                      step={0.5}
                      value={heightCm}
                      onChange={(e) => setHeightCm(Math.max(1, Number(e.target.value) || 1))}
                      className="rounded-md border border-[#e5e7eb] px-2 py-2 text-sm w-full"
                    />
                  </div>
                </div>
                <p className="text-xs text-[#64748b]">Proporción {widthCm} × {heightCm} cm en tiempo real.</p>
              </div>
            )}
          </div>
        </div>

        {/* Centro: canvas o mensaje */}
        {!(previewUrl || imageUrl) ? (
          <div className="min-h-0 min-w-0 flex flex-col items-center justify-center p-8 rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
            <p className="text-sm text-[#64748b] text-center">
              Subí una imagen en el panel izquierdo y usá «Subir a la nube» para continuar. Luego agregá recuadros en el editor (igual que en el diseñador de fotolibros).
            </p>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex flex-col gap-2 overflow-hidden">
            <Card className="shrink-0 px-3 py-2">
              <p className="text-xs text-[#1a1a1a]">
                <span className="font-medium">Recuadros para las fotos.</span> Arrastrá y redimensioná sobre la imagen (igual que en el diseñador de fotolibros). Clic para seleccionar y usar los tiradores.
              </p>
            </Card>
            <div
              className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm"
              style={{
                aspectRatio: widthCm >= 1 && heightCm >= 1 ? `${widthCm} / ${heightCm}` : undefined,
                minHeight: 360,
              }}
            >
              <div className="flex-1 min-h-[340px] w-full overflow-hidden">
                <TemplateSlotsCanvas
                  imageUrl={previewUrl ?? imageUrl ?? ""}
                  imageSize={imgSize}
                  slots={slots as TemplateSlot[]}
                  onSlotsChange={(next) => setSlots(next.map((s, idx) => ({ ...s, index: idx })))}
                  selectedIndex={selectedSlotIndex}
                  onSelectIndex={setSelectedSlotIndex}
                />
              </div>
              <img
                ref={imgRef}
                src={previewUrl ?? imageUrl ?? ""}
                alt=""
                className="hidden"
                onLoad={() => {
                  if (imgRef.current) {
                    setImgSize({
                      w: imgRef.current.naturalWidth,
                      h: imgRef.current.naturalHeight,
                    });
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Panel derecho: Inspector */}
        {(previewUrl || imageUrl) ? (
          <div className="min-h-0 min-w-0 flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
            <div className="shrink-0 px-3 py-2 border-b border-[#e2e8f0] text-sm font-medium text-[#1a1a1a]">
              Inspector
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">
              <div>
                <p className="text-xs font-medium text-[#1a1a1a] mb-2">Recuadros</p>
                <p className="text-xs text-[#6b7280] mb-2">
                  Cada recuadro es un espacio fijo donde el cliente pondrá una foto en el diseño.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addSlot}
                  className="w-full"
                >
                  Agregar recuadro
                </Button>
                <div className="mt-2 space-y-1">
                  {slots.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-2 text-sm ${
                        selectedSlotIndex === i ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb] bg-white"
                      }`}
                    >
                      <span className="font-medium text-[#1a1a1a]">Recuadro {i + 1}</span>
                      <Button type="button" variant="secondary" size="sm" onClick={() => removeSlot(i)}>
                        Quitar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#e2e8f0] pt-3">
                <p className="text-xs font-medium text-[#1a1a1a] mb-2">Texto</p>
                <p className="text-xs text-[#6b7280] mb-2">
                  Cuadros de texto editables en el diseño.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addTextElement}
                  className="w-full"
                >
                  Agregar texto
                </Button>
                {textElements.map((t) => (
                  <div key={t.id} className="mt-2 flex flex-col gap-1 rounded-md border border-[#e5e7eb] bg-[#fafafa] p-2">
                    <Input
                      value={t.text}
                      onChange={(e) => updateTextElement(t.id, { text: e.target.value })}
                      placeholder="Texto"
                      className="rounded-md border border-[#e5e7eb] px-2 py-1.5 text-sm w-full"
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={() => removeTextElement(t.id)}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 rounded-lg border border-[#e2e8f0] bg-white shadow-sm flex items-center justify-center p-6">
            <p className="text-xs text-[#64748b] text-center">Subí una imagen para ver el inspector.</p>
          </div>
        )}
      </div>
    </div>
  );
}
