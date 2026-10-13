"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PAPER_TOKENS, TemplateCanvasRenderer, editorThemeStyle, type PhotoOverride } from "@repo/template-editor-ui";
import {
  clientPhotoSlotNumber,
  computeCoverCropRect,
  DEFAULT_PHOTO_CROP,
  imageBlockVariableKey,
  normalizePhotoCrop,
  PHOTO_CROP_MAX_ZOOM,
  type ClientPhotoSlot,
  type PhotoCrop,
} from "@repo/template-editor-core";
import type { DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import {
  GROUP_PHOTO_MIN_FACES,
  photosForCanjeRole,
  type CanjeSlotPlan,
} from "@/lib/preventa-canjeable/preventa-canje-slots";

/**
 * "Revisá tu librito": la familia ve el diseño armado con las fotos que eligió, antes de
 * confirmar. Puede acomodar cada foto (acercar y mover) y cambiarla por otra de las que ya
 * eligió para su pack: las dos fotos cambian de lugar, así el pack sigue teniendo las mismas
 * fotos y ninguna se repite.
 *
 * No guarda nada por su cuenta: devuelve los lugares y los encuadres a quien la usa, que los
 * manda con el canje. Lo que se ve es lo que se imprime: el encuadre usa la misma cuenta que la
 * exportación (`computeCoverCropRect`).
 */

/** Encuadre de la foto de un lugar del canje. Vale mientras ese lugar tenga esa foto. */
export type CanjeCropEntry = { photoId: number; crop: PhotoCrop };

type Props = {
  plan: CanjeSlotPlan;
  filled: Array<number | null>;
  crops: Record<number, CanjeCropEntry>;
  onChange: (filled: Array<number | null>, crops: Record<number, CanjeCropEntry>) => void;
  designs: Array<{ benefitKey: string; template: DesignTemplatePayload }>;
  values: Record<string, string>;
  photoUrl: (photoId: number) => string;
  photos: Map<number, { sellPrint: boolean; sellDigital: boolean; faces?: number | null }>;
  studentName: string | null;
};

type Libro = {
  key: string;
  title: string;
  template: DesignTemplatePayload;
  /** Lugar del canje que corresponde a cada hueco del diseño (por blockId). */
  placeByBlock: Map<string, number>;
};

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

/** Une cada hueco del diseño con su lugar del canje: la foto `p` de la unidad va al hueco `p`. */
function placesForUnit(slots: ClientPhotoSlot[], slotIndexes: number[], unit: number, perUnit: number) {
  const numbers = [...new Set(slots.map((s) => s.slotNumber))].sort((a, b) => a - b);
  const map = new Map<string, number>();
  for (const s of slots) {
    const order = numbers.indexOf(s.slotNumber);
    if (order < 0 || order >= perUnit) continue;
    const place = slotIndexes[unit * perUnit + order];
    if (place != null) map.set(s.blockId, place);
  }
  return map;
}

function fits(kind: "PHYSICAL" | "DIGITAL", photo: { sellPrint: boolean; sellDigital: boolean } | undefined) {
  if (!photo) return false;
  return kind === "PHYSICAL" ? photo.sellPrint : photo.sellDigital;
}

export default function CanjeLibritoStep({
  plan,
  filled,
  crops,
  onChange,
  designs,
  values,
  photoUrl,
  photos,
  studentName,
}: Props) {
  const libros = useMemo<Libro[]>(() => {
    const out: Libro[] = [];
    for (const d of designs) {
      const g = plan.groups.find((x) => x.benefitKey === d.benefitKey);
      if (!g) continue;
      for (let u = 0; u < g.units; u++) {
        out.push({
          key: `${d.benefitKey}:${u}`,
          title: g.units > 1 ? `${g.label} ${u + 1}` : g.label,
          template: d.template,
          placeByBlock: placesForUnit(d.template.slots, g.slotIndexes, u, g.photosPerUnit),
        });
      }
    }
    return out;
  }, [designs, plan.groups]);

  const [libroIdx, setLibroIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<{ blockId: string; tab: "cambiar" | "acomodar" } | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [deshacer, setDeshacer] = useState<{ texto: string; filled: Array<number | null>; crops: Record<number, CanjeCropEntry> } | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const areaWidth = useWidth(areaRef);

  const libro = libros[Math.min(libroIdx, libros.length - 1)];

  useEffect(() => {
    if (!deshacer) return;
    const t = setTimeout(() => setDeshacer(null), 6000);
    return () => clearTimeout(t);
  }, [deshacer]);

  if (!libro) return null;
  const t = libro.template;
  const canvasW = Number(t.canvas.width) || 1;
  const canvasH = Number(t.canvas.height) || 1;
  const pageCount = Math.max(1, t.pageCount);
  const maxW = Math.min(areaWidth, 420);
  const scale = maxW > 0 ? Math.min(maxW / canvasW, 560 / canvasH) : 0;
  const pageLabel = (i: number) =>
    t.pageLabels[i]?.trim() ||
    (pageCount === 1 ? "Diseño" : i === 0 ? "Tapa" : i === pageCount - 1 ? "Contratapa" : `Página ${i + 1}`);

  const cropFor = (place: number): PhotoCrop => {
    const c = crops[place];
    return c && c.photoId === filled[place] ? c.crop : DEFAULT_PHOTO_CROP;
  };

  // Lo que no llega (un logo que la escuela no cargó) no sale impreso, así que tampoco se muestra.
  const visibleBlocks = t.blocks.filter((b) => {
    if (b.type !== "IMAGE" && b.type !== "PHOTO") return true;
    if (clientPhotoSlotNumber(b) != null) return libro.placeByBlock.has(b.id);
    const key = imageBlockVariableKey(b.configJson);
    return !key || Boolean(values[key]?.trim());
  });

  const overrides: Record<string, PhotoOverride> = {};
  for (const [blockId, place] of libro.placeByBlock) {
    const pid = filled[place];
    if (pid != null) overrides[blockId] = { src: photoUrl(pid), crop: cropFor(place) };
  }

  const slotsOnPage = t.slots.filter((s) => s.pageIndex === page && libro.placeByBlock.has(s.blockId));
  const blockById = new Map(t.blocks.map((b) => [b.id, b]));

  /** Nombre de un lugar para decirle a la familia dónde está una foto. */
  const placeName = (place: number): string => {
    for (const l of libros) {
      for (const [blockId, p] of l.placeByBlock) {
        if (p !== place) continue;
        const slot = l.template.slots.find((s) => s.blockId === blockId);
        const where = slot ? l.template.slots.length > 1 ? slot.label : l.title : l.title;
        return libros.length > 1 ? `${where} · ${l.title}` : where;
      }
    }
    const g = plan.groups.find((x) => x.slotIndexes.includes(place));
    return g?.label ?? "Otra foto";
  };

  function commit(texto: string, nextFilled: Array<number | null>, nextCrops: Record<number, CanjeCropEntry>) {
    setDeshacer({ texto, filled, crops });
    onChange(nextFilled, nextCrops);
  }

  function swapPlaces(a: number, b: number) {
    const pa = filled[a];
    const pb = filled[b];
    if (pa == null || pb == null) return;
    const next = [...filled];
    next[a] = pb;
    next[b] = pa;
    const nextCrops = { ...crops };
    delete nextCrops[a];
    delete nextCrops[b];
    commit(`Cambiaste la foto de ${placeName(a).toLowerCase()}`, next, nextCrops);
  }

  const sheetSlot = sheet ? t.slots.find((s) => s.blockId === sheet.blockId) ?? null : null;
  const sheetPlace = sheet ? libro.placeByBlock.get(sheet.blockId) ?? null : null;
  const sheetBlock = sheet ? blockById.get(sheet.blockId) : undefined;

  return (
    <section className="mx-auto max-w-xl">
      <div className="mb-3">
        <h1 className="m-0 text-2xl font-semibold text-[#1f2328]">
          {studentName ? `Así queda el ${libro.title.toLowerCase()} de ${studentName.split(/\s+/)[0]}` : `Así queda tu ${libro.title.toLowerCase()}`}
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#4b4f56]">
          Mirá cada página. Si querés, tocá <strong>Cambiar</strong> en una foto para acomodarla o ponerle otra de las
          que elegiste.
        </p>
      </div>

      {libros.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Diseños del pack">
          {libros.map((l, i) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={i === libroIdx}
              onClick={() => {
                setLibroIdx(i);
                setPage(0);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
                i === libroIdx ? "bg-[#1f2328] text-white ring-[#1f2328]" : "bg-white text-[#4b4f56] ring-[#e7e1da]"
              }`}
            >
              {l.title}
            </button>
          ))}
        </div>
      ) : null}

      {pageCount > 1 ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex gap-1 rounded-full bg-[#efe9e2] p-1" role="tablist" aria-label="Páginas">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={page === i}
                onClick={() => setPage(i)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  page === i ? "bg-white text-[#1f2328] shadow-sm" : "text-[#4b4f56]"
                }`}
              >
                {pageLabel(i)}
              </button>
            ))}
          </div>
          <span className="whitespace-nowrap rounded-full border border-dashed border-[#cfc5ba] px-2.5 py-1 text-xs font-semibold text-[#6b6f76]">
            Ver en 3D · pronto
          </span>
        </div>
      ) : null}

      <div ref={areaRef} className="flex w-full justify-center">
        {scale > 0 ? (
          <div className="relative" style={{ width: canvasW * scale, height: canvasH * scale }}>
            <div className="absolute inset-0 overflow-hidden rounded-[4px_10px_10px_4px] bg-white shadow-[0_1px_1px_rgba(40,30,20,.08),0_10px_28px_-10px_rgba(40,30,20,.35)]">
              <div
                style={{
                  ...editorThemeStyle(),
                  ...PAPER_TOKENS,
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
                  canvas={t.canvas}
                  blocks={visibleBlocks}
                  resolvedVariables={values}
                  readOnly
                  pageIndex={page}
                  photoOverrides={overrides}
                />
              </div>
            </div>
            {slotsOnPage.map((slot) => {
              const block = blockById.get(slot.blockId);
              if (!block) return null;
              const place = libro.placeByBlock.get(slot.blockId)!;
              const vacio = filled[place] == null;
              return (
                <button
                  key={slot.blockId}
                  type="button"
                  onClick={() => {
                    setVerTodas(false);
                    setSheet({ blockId: slot.blockId, tab: "cambiar" });
                  }}
                  aria-label={`${slot.label}: cambiar o acomodar`}
                  className="group absolute rounded-sm outline-none ring-[#c27b3d] hover:ring-[3px] focus-visible:ring-[3px]"
                  style={{
                    left: block.layout.x * scale,
                    top: block.layout.y * scale,
                    width: block.layout.width * scale,
                    height: block.layout.height * scale,
                    transform: `rotate(${block.layout.rotation ?? 0}deg)`,
                  }}
                >
                  <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#1f2328] shadow-[0_2px_8px_rgba(0,0,0,.25)]">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                    </svg>
                    {vacio ? "Elegir" : "Cambiar"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="aspect-[3/4] w-full max-w-sm animate-pulse rounded-lg bg-[#efe9e2]" />
        )}
      </div>

      <p className="m-0 mt-4 rounded-xl border border-[#e7e1da] bg-white px-4 py-3 text-sm text-[#4b4f56]">
        Lo impreso sale igual a lo que ves acá. Podés cambiar las fotos de lugar tantas veces como quieras antes de
        confirmar.
      </p>

      {sheet && sheetSlot && sheetPlace != null && sheetBlock ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/45" onClick={() => setSheet(null)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sheetSlot.label}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88%] max-w-lg flex-col gap-3 rounded-t-[20px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,.18)]"
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-[#ddd5cc]" />
            <div className="flex items-center gap-3">
              {filled[sheetPlace] != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(filled[sheetPlace]!)} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
              ) : null}
              <div className="min-w-0">
                <h2 className="m-0 text-lg font-semibold text-[#1f2328]">{sheetSlot.label}</h2>
                <p className="m-0 text-[13px] text-[#6b6f76]">{pageLabel(sheetSlot.pageIndex)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label="Cerrar"
                className="ml-auto grid h-9 w-9 flex-none place-items-center rounded-full bg-[#f2ede7]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex gap-1 rounded-xl bg-[#f2ede7] p-1" role="tablist">
              {(["cambiar", "acomodar"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={sheet.tab === tab}
                  disabled={tab === "acomodar" && filled[sheetPlace] == null}
                  onClick={() => setSheet({ ...sheet, tab })}
                  className={`flex-1 rounded-[9px] px-2 py-2 text-sm font-semibold disabled:opacity-40 ${
                    sheet.tab === tab ? "bg-white text-[#1f2328] shadow-sm" : "text-[#4b4f56]"
                  }`}
                >
                  {tab === "cambiar" ? "Cambiar foto" : "Acomodar"}
                </button>
              ))}
            </div>
            <div className="min-h-0 overflow-y-auto">
              {sheet.tab === "cambiar" ? (
                <CambiarFoto
                  place={sheetPlace}
                  role={sheetSlot.role}
                  plan={plan}
                  filled={filled}
                  photos={photos}
                  photoUrl={photoUrl}
                  verTodas={verTodas}
                  onVerTodas={setVerTodas}
                  placeName={placeName}
                  onPick={(other) => {
                    if (other !== sheetPlace) swapPlaces(sheetPlace, other);
                    setSheet({ ...sheet, tab: "acomodar" });
                  }}
                />
              ) : (
                <Acomodar
                  key={`${sheetPlace}:${filled[sheetPlace]}`}
                  src={photoUrl(filled[sheetPlace]!)}
                  width={sheetBlock.layout.width}
                  height={sheetBlock.layout.height}
                  initial={cropFor(sheetPlace)}
                  onDone={(crop) => {
                    const pid = filled[sheetPlace];
                    const prev = cropFor(sheetPlace);
                    setSheet(null);
                    if (pid == null || (prev.zoom === crop.zoom && prev.x === crop.x && prev.y === crop.y)) return;
                    commit(`Acomodaste la foto de ${placeName(sheetPlace).toLowerCase()}`, filled, {
                      ...crops,
                      [sheetPlace]: { photoId: pid, crop },
                    });
                  }}
                />
              )}
            </div>
          </div>
        </>
      ) : null}

      {deshacer ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-4 rounded-xl bg-[#1f2328] py-2.5 pl-4 pr-3 text-sm text-white shadow-lg"
        >
          <span>{deshacer.texto}</span>
          <button
            type="button"
            className="font-bold text-[#f3c79c]"
            onClick={() => {
              onChange(deshacer.filled, deshacer.crops);
              setDeshacer(null);
            }}
          >
            Deshacer
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CambiarFoto({
  place,
  role,
  plan,
  filled,
  photos,
  photoUrl,
  verTodas,
  onVerTodas,
  placeName,
  onPick,
}: {
  place: number;
  role: "individual" | "group" | null;
  plan: CanjeSlotPlan;
  filled: Array<number | null>;
  photos: Props["photos"];
  photoUrl: (id: number) => string;
  verTodas: boolean;
  onVerTodas: (v: boolean) => void;
  placeName: (place: number) => string;
  onPick: (otherPlace: number) => void;
}) {
  const kind = plan.slots[place].kind;
  // Sólo las fotos que ya eligió la familia, y que se puedan cambiar de lugar sin romper el formato.
  const candidatas = filled
    .map((pid, i) => ({ pid, i }))
    .filter((x): x is { pid: number; i: number } => x.pid != null)
    .filter((x) => x.i === place || (fits(kind, photos.get(x.pid)) && fits(plan.slots[x.i].kind, photos.get(filled[place] ?? -1))));
  const facesById = new Map(candidatas.map((c) => [c.pid, photos.get(c.pid)?.faces ?? null]));
  const { ids, filtered } = verTodas
    ? { ids: candidatas.map((c) => c.pid), filtered: false }
    : photosForCanjeRole(candidatas.map((c) => c.pid), facesById, role);
  const lista = candidatas.filter((c) => ids.includes(c.pid));

  return (
    <div className="flex flex-col gap-3 pb-1">
      <p className="m-0 text-sm text-[#4b4f56]">
        Elegí otra de las fotos de tu pack. Las dos cambian de lugar, así no perdés ninguna.
      </p>
      {role === "group" && (filtered || verTodas) ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#e8f3ee] px-3 py-2 text-[13px] text-[#3d4148]">
          <span>
            {filtered ? (
              <>
                Mostramos las <b className="text-[#2f7d5b]">fotos grupales</b> (más de {GROUP_PHOTO_MIN_FACES} personas)
              </>
            ) : (
              "Estás viendo todas tus fotos"
            )}
          </span>
          <button type="button" className="font-semibold text-[#a8652e] underline" onClick={() => onVerTodas(!verTodas)}>
            {filtered ? "Ver todas" : "Sólo grupales"}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {lista.map(({ pid, i }) => {
          const actual = i === place;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              aria-label={actual ? "Foto actual: acomodarla" : `Poner esta foto (ahora está en ${placeName(i)})`}
              className={`relative aspect-square overflow-hidden rounded-lg bg-[#efe9e2] ${actual ? "ring-[3px] ring-inset ring-[#2f7d5b]" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(pid)} alt="" className="h-full w-full object-cover" />
              {actual ? (
                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#2f7d5b] text-xs font-bold text-white">
                  ✓
                </span>
              ) : (
                <span className="absolute left-1.5 top-1.5 max-w-[90%] truncate rounded-md bg-white/95 px-1.5 py-0.5 text-[10.5px] font-bold text-[#1f2328]">
                  En {placeName(i).toLowerCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {lista.length <= 1 ? (
        <p className="m-0 text-sm text-[#6b6f76]">
          No hay otra foto de tu pack que pueda ir en este lugar. Para usar otra, volvé al paso anterior y elegila.
        </p>
      ) : null}
    </div>
  );
}

function Acomodar({
  src,
  width,
  height,
  initial,
  onDone,
}: {
  src: string;
  width: number;
  height: number;
  initial: PhotoCrop;
  onDone: (crop: PhotoCrop) => void;
}) {
  const [crop, setCrop] = useState<PhotoCrop>(initial);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [tocado, setTocado] = useState(false);
  const drag = useRef<{ x: number; y: number; crop: PhotoCrop } | null>(null);
  const aspect = Math.max(0.05, width / Math.max(1, height));
  const frameW = aspect >= 1 ? 320 : Math.round(300 * aspect);
  const frameH = Math.round(frameW / aspect);

  const rect = natural
    ? computeCoverCropRect({ srcWidth: natural.w, srcHeight: natural.h, slotWidth: width, slotHeight: height, crop })
    : null;
  const k = rect ? frameW / rect.width : 1;

  return (
    <div className="flex flex-col gap-3 pb-1">
      <p className="m-0 text-sm text-[#4b4f56]">
        Arrastrá la foto para moverla y usá la barra para acercarla. Lo que queda dentro del recuadro es lo que se
        imprime.
      </p>
      <div className="flex justify-center">
        <div
          className="relative max-w-full cursor-grab touch-none overflow-hidden rounded-xl bg-[#222] active:cursor-grabbing"
          style={{ width: frameW, height: frameH }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, crop };
            setTocado(true);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            // Arrastrar la foto hacia la derecha muestra más de su lado izquierdo.
            const factor = 2 / Math.max(1, d.crop.zoom);
            setCrop(
              normalizePhotoCrop({
                ...d.crop,
                x: d.crop.x - ((e.clientX - d.x) / frameW) * factor,
                y: d.crop.y - ((e.clientY - d.y) / frameH) * factor,
              }),
            );
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="pointer-events-none absolute max-w-none select-none"
            style={
              rect && natural
                ? { left: -rect.left * k, top: -rect.top * k, width: natural.w * k, height: natural.h * k }
                : { inset: 0, width: "100%", height: "100%", objectFit: "cover" }
            }
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(rgba(255,255,255,.35) 0 0) 33.33% 0/1px 100% no-repeat, linear-gradient(rgba(255,255,255,.35) 0 0) 66.66% 0/1px 100% no-repeat, linear-gradient(rgba(255,255,255,.35) 0 0) 0 33.33%/100% 1px no-repeat, linear-gradient(rgba(255,255,255,.35) 0 0) 0 66.66%/100% 1px no-repeat",
            }}
          />
          {!tocado ? (
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-semibold text-white">
              Arrastrá para mover
            </span>
          ) : null}
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm text-[#6b6f76]">
        <span className="sr-only">Acercar</span>
        <span aria-hidden>−</span>
        <input
          type="range"
          min={1}
          max={PHOTO_CROP_MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => {
            setTocado(true);
            setCrop(normalizePhotoCrop({ ...crop, zoom: Number(e.target.value) }));
          }}
          className="flex-1 accent-[#c27b3d]"
        />
        <span aria-hidden>+</span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCrop({ ...DEFAULT_PHOTO_CROP })}
          className="min-h-11 flex-1 rounded-xl border border-[#e7e1da] text-[15px] font-semibold text-[#4b4f56]"
        >
          Volver al centro
        </button>
        <button
          type="button"
          onClick={() => onDone(crop)}
          className="min-h-11 flex-1 rounded-xl bg-[#2f7d5b] text-[15px] font-semibold text-white"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
