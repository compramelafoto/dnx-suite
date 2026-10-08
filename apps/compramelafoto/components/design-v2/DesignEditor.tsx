"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TemplateCanvasRenderer, editorThemeStyle, type PhotoOverride } from "@repo/template-editor-ui";
import {
  clientPhotoSlotNumber,
  DEFAULT_PHOTO_CROP,
  imageBlockVariableKey,
  PHOTO_CROP_MAX_ZOOM,
  type PhotoCrop,
} from "@repo/template-editor-core";
import { applyDesignV2Edit, type DesignV2Data, type DesignV2Edit } from "@/lib/design-v2/design-data";
import {
  textVariableLabel,
  type DesignPhotoPayload,
  type DesignTemplatePayload,
} from "@/lib/design-v2/client-payload";

/**
 * Editor de un diseño armado con fotos del cliente. Lo usan la revisión del fotógrafo y el modo
 * "Probar con fotos". No guarda nada por su cuenta: aplica cada cambio y se lo pasa a quien lo
 * usa (`onChange`), que decide si lo persiste.
 *
 * Lo que se ve es lo que se imprime: las fotos se encuadran con la misma cuenta que la
 * exportación (`computeCoverCropRect`, dentro de `TemplateCanvasRenderer`).
 */

type Props = {
  template: DesignTemplatePayload;
  photos: DesignPhotoPayload[];
  data: DesignV2Data;
  onChange: (next: DesignV2Data, edit: DesignV2Edit) => void;
  readOnly?: boolean;
  /** Texto del banco de fotos ("Fotos que eligió el cliente", "Fotos elegidas para la prueba"). */
  photosTitle?: string;
};

const DRAG_SLOT = "application/x-design-slot";
const DRAG_PHOTO = "application/x-design-photo";

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export default function DesignEditor({ template, photos, data, onChange, readOnly = false, photosTitle }: Props) {
  const [page, setPage] = useState(() => template.slots[0]?.pageIndex ?? 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const areaWidth = useWidth(areaRef);
  const pan = useRef<{ id: string; x0: number; y0: number; crop: PhotoCrop; w: number; h: number } | null>(null);

  const photoUrlById = useMemo(() => new Map(photos.map((p) => [p.id, p.url])), [photos]);
  const blockById = useMemo(() => new Map(template.blocks.map((b) => [b.id, b])), [template.blocks]);
  const slotsOnPage = template.slots.filter((s) => s.pageIndex === page);
  const selected = selectedId ? template.slots.find((s) => s.blockId === selectedId) ?? null : null;
  const selectedAssignment = selectedId ? data.slots[selectedId] : undefined;
  const usedPhotoIds = new Set(Object.values(data.slots).map((s) => s.photoId).filter((id) => id != null));

  const canvasW = Number(template.canvas.width) || 1;
  const canvasH = Number(template.canvas.height) || 1;
  const scale = areaWidth > 0 ? Math.min(1, areaWidth / canvasW) : 0;

  /*
   * Lo que se ve tiene que ser lo que se imprime: una imagen atada a un dato que no llegó (el logo
   * de la escuela, si la escuela no lo cargó) no sale en el archivo final, así que tampoco se
   * muestra acá como recuadro gris.
   */
  const visibleBlocks = useMemo(
    () =>
      template.blocks.filter((b) => {
        if (b.type !== "IMAGE" && b.type !== "PHOTO") return true;
        if (clientPhotoSlotNumber(b) != null) return true;
        const key = imageBlockVariableKey(b.configJson);
        return !key || Boolean(data.values[key]?.trim());
      }),
    [template.blocks, data.values],
  );

  const overrides = useMemo(() => {
    const result: Record<string, PhotoOverride> = {};
    for (const [blockId, s] of Object.entries(data.slots)) {
      const url = s.photoId != null ? photoUrlById.get(s.photoId) : null;
      if (url) result[blockId] = { src: url, crop: s.crop };
    }
    return result;
  }, [data.slots, photoUrlById]);

  function apply(edit: DesignV2Edit) {
    if (readOnly) return;
    const result = applyDesignV2Edit(data, edit);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.data, edit);
  }

  function setCrop(blockId: string, crop: PhotoCrop) {
    apply({ kind: "set-crop", blockId, crop });
  }

  function assignPhoto(photoId: number) {
    if (!selectedId) {
      setError("Primero tocá un hueco del diseño y después la foto que querés poner.");
      return;
    }
    apply({ kind: "set-photo", blockId: selectedId, photoId });
  }

  function onSlotPointerDown(e: React.PointerEvent<HTMLDivElement>, blockId: string) {
    if (readOnly || selectedId !== blockId) return;
    const slot = data.slots[blockId];
    const block = blockById.get(blockId);
    if (!slot || slot.photoId == null || !block) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = {
      id: blockId,
      x0: e.clientX,
      y0: e.clientY,
      crop: slot.crop,
      w: block.layout.width * scale,
      h: block.layout.height * scale,
    };
  }

  function onSlotPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pan.current;
    if (!p) return;
    // Arrastrar la foto hacia la derecha muestra más de su lado izquierdo.
    const factor = 2 / Math.max(1, p.crop.zoom);
    const x = p.crop.x - ((e.clientX - p.x0) / Math.max(1, p.w)) * factor;
    const y = p.crop.y - ((e.clientY - p.y0) / Math.max(1, p.h)) * factor;
    setCrop(p.id, { ...p.crop, x, y });
  }

  function onSlotPointerUp() {
    pan.current = null;
  }

  const pageLabel = (i: number) => template.pageLabels[i]?.trim() || `Cara ${i + 1}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {template.pageCount > 1 ? (
          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Caras del diseño">
            {Array.from({ length: template.pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={page === i}
                onClick={() => {
                  setPage(i);
                  setSelectedId(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  page === i ? "bg-[#111827] text-white ring-[#111827]" : "bg-white text-[#374151] ring-[#e5e7eb] hover:bg-[#f9fafb]"
                }`}
              >
                {pageLabel(i)}
              </button>
            ))}
          </div>
        ) : null}

        <div ref={areaRef} className="w-full">
          {scale > 0 ? (
            <div
              className="relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#e5e7eb]"
              style={{ width: canvasW * scale, height: canvasH * scale }}
            >
              <div
                style={{
                  ...editorThemeStyle(),
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: canvasW,
                  height: canvasH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <TemplateCanvasRenderer
                  canvas={template.canvas}
                  blocks={visibleBlocks}
                  resolvedVariables={data.values}
                  readOnly
                  pageIndex={page}
                  photoOverrides={overrides}
                />
                {slotsOnPage.map((slot) => {
                  const block = blockById.get(slot.blockId);
                  if (!block) return null;
                  const assignment = data.slots[slot.blockId];
                  const isSelected = selectedId === slot.blockId;
                  const isEmpty = !assignment || assignment.photoId == null;
                  const isDrop = dropTarget === slot.blockId;
                  const lineW = Math.max(2, 3 / Math.max(scale, 0.05));
                  return (
                    <div
                      key={slot.blockId}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slot.label}${isEmpty ? " (vacío)" : ""}`}
                      aria-pressed={isSelected}
                      draggable={!readOnly && !isSelected && !isEmpty}
                      onClick={() => setSelectedId(isSelected ? null : slot.blockId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(isSelected ? null : slot.blockId);
                        }
                      }}
                      onDragStart={(e) => e.dataTransfer.setData(DRAG_SLOT, slot.blockId)}
                      onDragOver={(e) => {
                        if (readOnly) return;
                        e.preventDefault();
                        setDropTarget(slot.blockId);
                      }}
                      onDragLeave={() => setDropTarget((t) => (t === slot.blockId ? null : t))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropTarget(null);
                        const fromSlot = e.dataTransfer.getData(DRAG_SLOT);
                        const fromPhoto = e.dataTransfer.getData(DRAG_PHOTO);
                        if (fromSlot && fromSlot !== slot.blockId) {
                          apply({ kind: "swap", blockIdA: fromSlot, blockIdB: slot.blockId });
                        } else if (fromPhoto) {
                          apply({ kind: "set-photo", blockId: slot.blockId, photoId: Number(fromPhoto) });
                        }
                        setSelectedId(slot.blockId);
                      }}
                      onPointerDown={(e) => onSlotPointerDown(e, slot.blockId)}
                      onPointerMove={onSlotPointerMove}
                      onPointerUp={onSlotPointerUp}
                      onPointerCancel={onSlotPointerUp}
                      style={{
                        position: "absolute",
                        left: block.layout.x,
                        top: block.layout.y,
                        width: block.layout.width,
                        height: block.layout.height,
                        transform: `rotate(${block.layout.rotation ?? 0}deg)`,
                        zIndex: 10_000,
                        cursor: readOnly ? "default" : isSelected && !isEmpty ? "grab" : "pointer",
                        outline: isSelected
                          ? `${lineW}px solid #c27b3d`
                          : isDrop
                            ? `${lineW}px solid #2563eb`
                            : isEmpty
                              ? `${lineW}px dashed #dc2626`
                              : "none",
                        outlineOffset: -lineW,
                        background: isEmpty ? "rgba(220,38,38,0.06)" : undefined,
                        touchAction: isSelected ? "none" : undefined,
                      }}
                    >
                      {isEmpty ? (
                        <span
                          style={{ fontSize: Math.max(14, 16 / Math.max(scale, 0.05)) }}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-2 py-1 font-semibold text-red-700"
                        >
                          {slot.label}: sin foto
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="aspect-[3/2] w-full animate-pulse rounded-lg bg-[#f3f4f6]" />
          )}
        </div>
        {!readOnly ? (
          <p className="mt-2 text-xs text-[#6b7280]">
            Tocá un hueco para elegirlo. Arrastrá un hueco sobre otro para intercambiar las fotos, o una foto de la
            lista sobre un hueco para cambiarla. Con el hueco elegido, arrastrá la foto para encuadrarla.
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <aside className="space-y-5">
        {selected && selectedAssignment ? (
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#111827]">{selected.label}</h3>
            {selectedAssignment.photoId == null ? (
              <p className="mt-1 text-xs text-[#6b7280]">Este hueco no tiene foto. Elegí una de la lista.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <CropSlider
                  label="Acercar"
                  min={1}
                  max={PHOTO_CROP_MAX_ZOOM}
                  step={0.01}
                  value={selectedAssignment.crop.zoom}
                  disabled={readOnly}
                  onChange={(zoom) => setCrop(selected.blockId, { ...selectedAssignment.crop, zoom })}
                />
                <CropSlider
                  label="Mover a los costados"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={selectedAssignment.crop.x}
                  disabled={readOnly}
                  onChange={(x) => setCrop(selected.blockId, { ...selectedAssignment.crop, x })}
                />
                <CropSlider
                  label="Mover arriba y abajo"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={selectedAssignment.crop.y}
                  disabled={readOnly}
                  onChange={(y) => setCrop(selected.blockId, { ...selectedAssignment.crop, y })}
                />
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCrop(selected.blockId, { ...DEFAULT_PHOTO_CROP })}
                      className="rounded-full px-3 py-1 text-xs font-medium text-[#374151] ring-1 ring-[#e5e7eb] hover:bg-[#f9fafb]"
                    >
                      Centrar
                    </button>
                    <button
                      type="button"
                      onClick={() => apply({ kind: "set-photo", blockId: selected.blockId, photoId: null })}
                      className="rounded-full px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                    >
                      Quitar foto
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#111827]">{photosTitle ?? "Fotos que eligió el cliente"}</h3>
          {photos.length === 0 ? (
            <p className="mt-1 text-xs text-[#6b7280]">No hay fotos.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={readOnly}
                    draggable={!readOnly}
                    onDragStart={(e) => e.dataTransfer.setData(DRAG_PHOTO, String(p.id))}
                    onClick={() => assignPhoto(p.id)}
                    title={selected ? `Poner en "${selected.label}"` : "Elegí un hueco primero"}
                    className="group relative block aspect-square w-full overflow-hidden rounded-md bg-[#f3f4f6] ring-1 ring-[#e5e7eb] hover:ring-[#c27b3d] disabled:cursor-default"
                  >
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <span className="text-[10px] text-[#9ca3af]">Sin vista</span>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                      {i + 1}
                    </span>
                    {usedPhotoIds.has(p.id) ? (
                      <span className="absolute bottom-1 right-1 rounded bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                        En uso
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                apply({ kind: "reset", slots: template.slots });
                setSelectedId(null);
              }}
              className="mt-3 text-xs font-medium text-[#6b7280] underline hover:text-[#111827]"
            >
              Volver al armado automático
            </button>
          ) : null}
        </section>

        {template.textVariables.length > 0 ? (
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#111827]">Textos</h3>
            <div className="mt-3 space-y-3">
              {template.textVariables.map((key) => (
                <TextValueField
                  key={`${key}:${data.values[key] ?? ""}`}
                  label={textVariableLabel(key)}
                  value={data.values[key] ?? ""}
                  disabled={readOnly}
                  onCommit={(value) => apply({ kind: "set-value", key, value })}
                />
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function CropSlider({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#374151]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#c27b3d]"
      />
    </label>
  );
}

function TextValueField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onCommit: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#374151]">{label}</span>
      <input
        type="text"
        value={draft}
        disabled={disabled}
        maxLength={500}
        placeholder="Usa el texto de la plantilla"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft.trim() ? draft : null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-lg border border-[#d1d5db] px-3 py-1.5 text-sm text-[#111827] focus:border-[#c27b3d] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/20"
      />
    </label>
  );
}
