"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SlotTransform } from "@/lib/school-design/types";

function parseBboxNorm(bbox: unknown): { left: string; top: string; width: string; height: string } | null {
  if (!bbox || typeof bbox !== "object") return null;
  const o = bbox as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.width);
  const h = Number(o.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  const norm = Math.max(x, y, w, h) <= 1.0001;
  if (norm) {
    return {
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: `${w * 100}%`,
      height: `${h * 100}%`,
    };
  }
  return null;
}

const defaultTf = (): SlotTransform => ({
  fitMode: "COVER",
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
});

type EditorBundle = {
  assignments: Record<string, { slotId: number; pageIndex: number; photoId: number }>;
  slotTransforms: Record<string, SlotTransform>;
  textOverrides: Record<string, string>;
  textFieldIds: string[];
};

type ContextResponse = {
  designProject: {
    id: number;
    status: string;
    previewUrl: string | null;
    previewVersion: number;
    previewStatus: string;
    previewDirty: boolean;
    previewError: string | null;
    exportUrlJpg: string | null;
    exportVersion: number;
    exportError: string | null;
  };
  template: {
    imageUrl: string;
    widthCm: number;
    heightCm: number;
    textElementsJson?: unknown;
  };
  slots: Array<{ id: number; pageIndex: number; index: number; bbox: unknown; role: string | null }>;
  revision: { id: number; dataJson: unknown };
  selectionPhotos: Array<{ photoId: number; previewUrl: string; inUse: boolean; position: number | null }>;
  editor: EditorBundle;
};

type Props = {
  albumId: number;
  designProjectId: number;
  ctx: ContextResponse;
  previewSrc: string | null;
  load: () => Promise<void>;
  run: (path: string, init?: RequestInit) => Promise<void>;
  busy: boolean;
};

export function SchoolDesignVisualEditor(props: Props) {
  const { albumId, designProjectId, ctx, previewSrc, load, run, busy } = props;
  const base = `/api/dashboard/albums/${albumId}/design-projects/${designProjectId}`;

  const slotsP0 = useMemo(
    () =>
      [...ctx.slots]
        .filter((s) => s.pageIndex === 0)
        .sort((a, b) => a.index - b.index || a.id - b.id),
    [ctx.slots]
  );

  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [localTf, setLocalTf] = useState<Record<string, SlotTransform>>(() => ({ ...ctx.editor.slotTransforms }));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Pan: posición inicial del pointer + base x/y al empezar el gesto */
  const panDragRef = useRef<{
    key: string;
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const localTfRef = useRef(localTf);
  useEffect(() => {
    localTfRef.current = localTf;
  }, [localTf]);

  useEffect(() => {
    setLocalTf({ ...ctx.editor.slotTransforms });
  }, [ctx.revision.id, ctx.editor.slotTransforms]);

  useEffect(() => {
    if (selectedSlotId == null && slotsP0.length > 0) {
      setSelectedSlotId(slotsP0[0]!.id);
    }
  }, [selectedSlotId, slotsP0]);

  const photoUrlById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of ctx.selectionPhotos) {
      m.set(p.photoId, p.previewUrl);
    }
    return m;
  }, [ctx.selectionPhotos]);

  const flushSave = useCallback(
    async (slotId: number, patch: Partial<SlotTransform>) => {
      const r = await fetch(`${base}/editor/slot-transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, patch }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Error al guardar transform");
      }
      await load();
    },
    [base, load]
  );

  const scheduleSave = useCallback(
    (slotId: number, patch: Partial<SlotTransform>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void flushSave(slotId, patch).catch(() => {});
      }, 220);
    },
    [flushSave]
  );

  const updateTf = useCallback(
    (slotId: number, patch: Partial<SlotTransform>, opts?: { immediate?: boolean }) => {
      const k = String(slotId);
      setLocalTf((prev) => {
        const cur = { ...defaultTf(), ...prev[k], ...patch };
        return { ...prev, [k]: cur };
      });
      if (opts?.immediate) {
        void flushSave(slotId, patch);
      } else {
        scheduleSave(slotId, patch);
      }
    },
    [flushSave, scheduleSave]
  );

  const selectedTf = selectedSlotId != null ? { ...defaultTf(), ...localTf[String(selectedSlotId)] } : defaultTf();

  const replacePhoto = (slotId: number, photoId: number) => {
    void run(`${base}/editor/replace-photo`, {
      method: "POST",
      body: JSON.stringify({ slotId, photoId }),
    });
  };

  const swapSlots = (a: number, b: number) => {
    void run(`${base}/editor/swap-slots`, {
      method: "POST",
      body: JSON.stringify({ slotIdA: a, slotIdB: b }),
    });
  };

  const resetSlot = (slotId: number) => {
    void run(`${base}/editor/reset-slot-transform`, {
      method: "POST",
      body: JSON.stringify({ slotId }),
    });
  };

  const saveText = (textId: string, value: string) => {
    void run(`${base}/editor/text-override`, {
      method: "POST",
      body: JSON.stringify({ textId, value }),
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Canvas central */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#1a1a1a]">Edición visual · Página 1</h2>
          <p className="text-xs text-[#6b7280] max-w-xl">
            Tocá un recuadro para activarlo. Arrastrá la foto dentro del recuadro para encuadrar; usá la rueda para zoom.
            Arrastrá un recuadro sobre otro para intercambiar fotos.
          </p>
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border border-[#e7e5e4] bg-[#f4f4f5] shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ctx.template.imageUrl} alt="" className="block h-auto w-full select-none" draggable={false} />

          {slotsP0.map((s) => {
            const box = parseBboxNorm(s.bbox);
            if (!box) return null;
            const k = String(s.id);
            const asg = ctx.editor.assignments[k];
            const photoId = asg?.photoId;
            const tf = { ...defaultTf(), ...localTf[k] };
            const selected = selectedSlotId === s.id;
            const url = photoId ? photoUrlById.get(photoId) : undefined;

            return (
              <div
                key={s.id}
                className={`absolute box-border transition-shadow ${
                  selected
                    ? "ring-2 ring-[#c27b3d] ring-offset-2 ring-offset-transparent z-10"
                    : "ring-1 ring-[#c27b3d]/40 hover:ring-[#c27b3d]/70 z-[1]"
                }`}
                style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                onClick={() => setSelectedSlotId(s.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const pid = parseInt(e.dataTransfer.getData("text/plain"), 10);
                  if (Number.isInteger(pid)) replacePhoto(s.id, pid);
                  const fromSlot = e.dataTransfer.getData("application/x-school-slot");
                  if (fromSlot && fromSlot !== String(s.id)) {
                    swapSlots(parseInt(fromSlot, 10), s.id);
                  }
                }}
              >
                <div
                  role="presentation"
                  className="relative h-full w-full cursor-pointer overflow-hidden bg-black/5"
                  onWheel={(e) => {
                    if (!selected) return;
                    e.preventDefault();
                    setLocalTf((prev) => {
                      const cur = { ...defaultTf(), ...prev[k] };
                      const nextS = Math.max(0.35, Math.min(4, cur.scale - e.deltaY * 0.0015));
                      scheduleSave(s.id, { scale: nextS });
                      return { ...prev, [k]: { ...cur, scale: nextS } };
                    });
                  }}
                  onPointerDown={(e) => {
                    if (!photoId || e.button !== 0) return;
                    setSelectedSlotId(s.id);
                    const cur = { ...defaultTf(), ...localTfRef.current[k] };
                    panDragRef.current = {
                      key: k,
                      baseX: cur.x,
                      baseY: cur.y,
                      startX: e.clientX,
                      startY: e.clientY,
                    };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = panDragRef.current;
                    if (!d || d.key !== k) return;
                    const dx = (e.clientX - d.startX) / 200;
                    const dy = (e.clientY - d.startY) / 200;
                    const nx = Math.max(-1, Math.min(1, d.baseX + dx));
                    const ny = Math.max(-1, Math.min(1, d.baseY + dy));
                    setLocalTf((prev) => ({
                      ...prev,
                      [k]: { ...defaultTf(), ...prev[k], x: nx, y: ny },
                    }));
                    scheduleSave(s.id, { x: nx, y: ny });
                  }}
                  onPointerUp={(e) => {
                    if (panDragRef.current?.key === k) {
                      panDragRef.current = null;
                      try {
                        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                      } catch {
                        /* noop */
                      }
                    }
                  }}
                  onPointerCancel={(e) => {
                    panDragRef.current = null;
                    try {
                      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    } catch {
                      /* noop */
                    }
                  }}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      draggable={false}
                      className="h-full w-full select-none object-cover"
                      style={{
                        transform: `translate(${tf.x * 35}%, ${tf.y * 35}%) scale(${tf.scale}) rotate(${tf.rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[#c27b3d]/10 text-xs text-[#78716c]">
                      Sin foto
                    </div>
                  )}
                </div>

                <div
                  className="absolute -top-2 left-0 flex items-center gap-1 rounded bg-[#c27b3d] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow cursor-grab active:cursor-grabbing"
                  draggable
                  onPointerDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData("application/x-school-slot", String(s.id));
                    e.dataTransfer.setData("text/plain", "");
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  title="Arrastrá esta etiqueta a otro recuadro para intercambiar fotos"
                >
                  Slot {s.index + 1}
                </div>
              </div>
            );
          })}
        </div>

        {previewSrc ? (
          <div className="rounded-lg border border-[#e7e5e4] bg-white p-3">
            <p className="text-xs font-medium text-[#57534e] mb-2">Último render (preview)</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc} alt="Preview renderizada" className="max-h-48 w-auto rounded border border-[#e7e5e4]" />
            <p className="text-[11px] text-[#9ca3af] mt-2">
              Regenerá el preview para ver aquí los cambios de encuadre y texto en baja resolución.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#78716c]">
            Todavía no hay preview generada. Usá «Regenerar preview» cuando termines ajustes importantes.
          </p>
        )}
      </div>

      {/* Panel lateral */}
      <aside className="w-full shrink-0 space-y-5 lg:w-80">
        <div className="rounded-xl border border-[#e7e5e4] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Slot activo</h3>
          {selectedSlotId == null ? (
            <p className="text-sm text-[#6b7280]">Seleccioná un recuadro en la plantilla.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#6b7280]">
                Slot #{selectedSlotId}
                {ctx.slots.find((x) => x.id === selectedSlotId)?.role
                  ? ` · rol ${ctx.slots.find((x) => x.id === selectedSlotId)?.role}`
                  : ""}
              </p>

              <label className="block text-xs font-medium text-[#44403c]">
                Rotación ({Math.round(selectedTf.rotation)}°)
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  disabled={busy}
                  value={selectedTf.rotation}
                  onChange={(e) => updateTf(selectedSlotId, { rotation: Number(e.target.value) })}
                  className="mt-1 w-full accent-[#c27b3d]"
                />
              </label>

              <label className="block text-xs font-medium text-[#44403c]">
                Zoom ({selectedTf.scale.toFixed(2)}×)
                <input
                  type="range"
                  min={0.4}
                  max={3.5}
                  step={0.02}
                  disabled={busy}
                  value={selectedTf.scale}
                  onChange={(e) => updateTf(selectedSlotId, { scale: Number(e.target.value) })}
                  className="mt-1 w-full accent-[#c27b3d]"
                />
              </label>

              <p className="text-[11px] leading-relaxed text-[#78716c]">
                Pan: hacé clic y arrastrá dentro del recuadro activo. Zoom: rueda del mouse sobre el recuadro o este control.
              </p>

              <button
                type="button"
                disabled={busy}
                className="w-full rounded-lg border border-[#d6d3d1] py-2 text-sm font-medium text-[#44403c] hover:bg-[#fafaf9] disabled:opacity-50"
                onClick={() => resetSlot(selectedSlotId)}
              >
                Restablecer encuadre de este slot
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#e7e5e4] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1a1a1a] mb-2">Fotos disponibles</h3>
          <p className="text-[11px] text-[#78716c] mb-3">
            Clic en una foto para asignarla al slot activo, o arrastrá al recuadro.
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ctx.selectionPhotos.map((p) => (
              <li key={p.photoId}>
                <button
                  type="button"
                  disabled={busy || selectedSlotId == null}
                  className={`relative aspect-square w-full overflow-hidden rounded-lg border text-left transition ${
                    p.inUse ? "border-[#c27b3d] ring-1 ring-[#c27b3d]/30" : "border-[#e7e5e4]"
                  } ${busy || selectedSlotId == null ? "opacity-50" : "hover:border-[#c27b3d] cursor-pointer"}`}
                  onClick={() => selectedSlotId != null && replacePhoto(selectedSlotId, p.photoId)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(p.photoId));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[10px] text-white truncate">
                    #{p.photoId}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {ctx.editor.textFieldIds.length > 0 ? (
          <div className="rounded-xl border border-[#e7e5e4] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Textos</h3>
            <div className="space-y-3">
              {ctx.editor.textFieldIds.map((tid) => (
                <label key={tid} className="block text-xs font-medium text-[#44403c]">
                  {tid}
                  <input
                    type="text"
                    disabled={busy}
                    defaultValue={ctx.editor.textOverrides[tid] ?? ""}
                    key={`${tid}-${ctx.revision.id}`}
                    className="mt-1 w-full rounded-lg border border-[#d6d3d1] px-3 py-2 text-sm text-[#1a1a1a] focus:border-[#c27b3d] focus:outline-none focus:ring-1 focus:ring-[#c27b3d]"
                    onBlur={(e) => saveText(tid, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
