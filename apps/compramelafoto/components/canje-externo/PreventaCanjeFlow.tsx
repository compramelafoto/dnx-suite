"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import type { PreventaPackSnapshotBenefitV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import {
  buildCanjeSlotPlan,
  buildRedeemSelections,
  emptyCanjeFill,
  isCanjeComplete,
  toggleCanjePhoto,
} from "@/lib/preventa-canjeable/preventa-canje-slots";
import ComboFrames from "./ComboFrames";
import CanjeSteps, { type CanjeStepKey } from "./CanjeSteps";
import PhotoPickGrid from "./PhotoPickGrid";

type Paso = "intro" | "elegir" | "revisar" | "listo";

type Props = {
  token: string;
  album: {
    id: number;
    title: string;
    slug: string | null;
    photographerName: string | null;
    scanProtection: boolean;
    selfieSearch: boolean;
    /** La galería vende fotos sueltas: se ofrece comprar más al terminar. */
    sellsSingles: boolean;
  };
  pack: {
    name: string;
    benefits: Array<
      Pick<
        PreventaPackSnapshotBenefitV1,
        "stableKey" | "kind" | "selectionMode" | "includedQuantity" | "requiredPhotoCount" | "sortOrder" | "name"
      >
    >;
    parentName: string | null;
    studentName: string | null;
  };
  photos: Array<{ id: number; sellPrint: boolean; sellDigital: boolean }>;
};

function primerNombre(nombre: string | null): string | null {
  return nombre ? nombre.trim().split(/\s+/)[0] : null;
}

function describirGrupo(g: { kind: string; units: number; photosPerUnit: number }): string {
  const formato = g.kind === "DIGITAL" ? "digital" : "impresa";
  if (g.photosPerUnit > 1) {
    return g.units === 1
      ? `${g.photosPerUnit} fotos distintas · ${formato}`
      : `${g.units} × ${g.photosPerUnit} fotos distintas · ${formato}`;
  }
  return `${g.units} ${g.units === 1 ? "foto" : "fotos"} · ${formato}${g.units === 1 ? "" : "s"}`;
}

/**
 * Canje de un pack de preventa en pasos, con las mismas piezas que el canje de combos
 * cobrados por fuera: casilleros que se llenan, grilla para tocar fotos y un cierre con la
 * descarga. Los casilleros salen de lo que incluye el pack (copia grupal, librito, digitales).
 */
export default function PreventaCanjeFlow({ token, album, pack, photos }: Props) {
  const plan = useMemo(() => buildCanjeSlotPlan(pack.benefits), [pack.benefits]);
  const [paso, setPaso] = useState<Paso>("intro");
  const [filled, setFilled] = useState<Array<number | null>>(() => emptyCanjeFill(plan));
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomId, setZoomId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<number[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ pedido: number; downloadUrl: string | null } | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const total = plan.slots.length;
  const elegidas = filled.filter((x) => x != null) as number[];
  const completo = isCanjeComplete(filled);
  const alumno = pack.studentName;
  const alumnoCorto = primerNombre(alumno);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const thumbUrl = useCallback(
    (id: number) => `/api/photos/${id}/view?albumId=${album.id}&mode=thumb`,
    [album.id]
  );
  const visibles = useMemo(
    () => (filtro ? photos.filter((p) => filtro.includes(p.id)) : photos).map((p) => p.id),
    [photos, filtro]
  );
  const hayImpresas = plan.groups.some((g) => g.kind === "PHYSICAL");
  const impresas = plan.slots.filter((s) => s.kind === "PHYSICAL").length;
  const entregaImpresas = `${impresas === 1 ? "La foto impresa te la entrega" : "Las fotos impresas te las entrega"} ${album.photographerName ?? "el fotógrafo"}.`;
  const stepKey: CanjeStepKey = paso === "intro" || paso === "elegir" ? "combo" : paso === "revisar" ? "extras" : "confirmar";

  const irA = (p: Paso) => {
    setAviso(null);
    setError(null);
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function tocar(id: number) {
    setAviso(null);
    const r = toggleCanjePhoto(plan, filled, id, byId.get(id));
    if (r.ok) {
      setFilled(r.filled);
      return;
    }
    setAviso(
      r.reason === "lleno"
        ? `Ya elegiste las ${total} fotos de tu pack. Para cambiar una, sacala tocándola.`
        : "Esta foto no se puede usar en los lugares que te quedan (no se vende en ese formato). Elegí otra."
    );
  }

  async function buscarConSelfie(file: File) {
    setBuscando(true);
    setAviso(null);
    try {
      try {
        sessionStorage.setItem("faceConsentSession", "1");
      } catch {
        /* sin almacenamiento, la búsqueda sigue */
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/albums/${album.id}/search/face`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos buscar con esa foto.");
      const ids: number[] = (Array.isArray(data?.items) ? data.items : [])
        .map((it: { id: unknown }) => Number(it.id))
        .filter((id: number) => byId.has(id));
      if (ids.length === 0) {
        setAviso("No encontramos fotos con esa cara. Probá con otra foto con buena luz, o mirá la galería completa.");
        setFiltro(null);
      } else {
        setFiltro(ids);
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No pudimos buscar con esa foto.");
    } finally {
      setBuscando(false);
      if (selfieInputRef.current) selfieInputRef.current.value = "";
    }
  }

  async function confirmar() {
    if (enviando || !completo) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/pack/${encodeURIComponent(token)}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: buildRedeemSelections(plan, filled) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos confirmar el canje.");
      setResultado({
        pedido: Number(data.redemptionOrderId),
        downloadUrl: typeof data.downloadUrl === "string" ? data.downloadUrl : null,
      });
      irA("listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos confirmar el canje.");
    } finally {
      setEnviando(false);
    }
  }

  const casilleros = (size: "lg" | "md" | "sm", editable: boolean) => (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-4">
      {plan.groups.map((g) => (
        <div key={g.benefitKey} className="text-center">
          <ComboFrames
            slots={g.slotIndexes.length}
            photoIds={g.slotIndexes.map((i) => filled[i]) as number[]}
            thumbUrl={thumbUrl}
            onRemove={editable ? tocar : undefined}
            size={size}
          />
          <p className="m-0 mt-2 text-sm font-medium text-[#1f2328]">{g.label}</p>
          <p className="m-0 text-xs text-[#6b6f76]">{describirGrupo(g)}</p>
        </div>
      ))}
    </div>
  );

  const viewerPhotos = useMemo(
    () =>
      visibles.map((id) => ({
        id: String(id),
        src: `/api/photos/${id}/view?mode=preview&albumId=${album.id}`,
        alt: "Foto del álbum",
        selected: filled.includes(id),
      })),
    [visibles, album.id, filled]
  );

  const galeriaHref = album.slug ? `/album/${album.slug}` : `/a/${album.id}`;

  return (
    <div className="min-h-screen bg-[#f7f5f2] pb-36">
      <header className="border-b border-[#e7e1da] bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4">
          <p className="m-0 text-sm text-[#6b6f76]">
            {album.title}
            {album.photographerName ? ` — ${album.photographerName}` : ""}
          </p>
          <CanjeSteps current={stepKey} labels={{ combo: "Tu pack", extras: "Revisá", confirmar: "Listo" }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {paso === "intro" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            <h1 className="m-0 text-2xl font-semibold text-[#1f2328] sm:text-3xl">
              {pack.parentName ? `Hola, ${primerNombre(pack.parentName)}` : "Hola"}
            </h1>
            <p className="m-0 mt-2 text-lg text-[#2f7d5b]">
              {alumno ? `El pack de ${alumno} ya está pago` : "Tu pack ya está pago"}
            </p>
            <p className="m-0 mt-1 text-sm text-[#6b6f76]">{pack.name}</p>
            <div className="my-7">{casilleros("md", false)}</div>
            <p className="m-0 text-left text-[15px] leading-relaxed text-[#3d4148]">
              <strong>
                Elegí {total === 1 ? "la foto" : `las ${total} fotos`} de tu pack.
              </strong>{" "}
              {total === 1 ? "Ya está paga: no vas a pagar nada por ella." : "Ya están pagas: no vas a pagar nada por ellas."}
              {hayImpresas ? ` ${entregaImpresas}` : ""}
            </p>
            <button
              type="button"
              onClick={() => irA("elegir")}
              className="mt-8 min-h-12 w-full rounded-xl bg-[#c27b3d] px-6 text-base font-semibold text-white hover:bg-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] sm:w-auto"
            >
              {total === 1 ? "Elegir mi foto" : `Elegir mis ${total} fotos`}
            </button>
          </section>
        ) : null}

        {paso === "elegir" ? (
          <section>
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[#e7e1da] bg-[#f7f5f2]/95 px-4 py-3 backdrop-blur">
              <h1 className="m-0 text-lg font-semibold text-[#1f2328]">
                Elegí {total === 1 ? "la foto" : `las ${total} fotos`} de tu pack
              </h1>
              <p className="m-0 mb-3 text-sm text-[#2f7d5b]">
                {completo
                  ? total === 1
                    ? "¡Listo! Ya está elegida"
                    : "¡Listo! Ya están todas"
                  : `${elegidas.length} de ${total} elegidas · te ${total - elegidas.length === 1 ? "falta" : "faltan"} ${total - elegidas.length}`}
              </p>
              {casilleros("sm", true)}
            </div>
            {album.selfieSearch ? (
              <div className="mb-4 rounded-xl border border-[#e7e1da] bg-white p-4">
                {filtro ? (
                  <p className="m-0 text-sm text-[#1f2328]">
                    Mostrando {filtro.length} {filtro.length === 1 ? "foto" : "fotos"}
                    {alumnoCorto ? ` donde aparece ${alumnoCorto}` : " de la búsqueda"}.{" "}
                    <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => setFiltro(null)}>
                      Ver todas las fotos
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="m-0 text-sm text-[#4b4f56]">
                      ¿Son muchas fotos? Cargá una foto de la cara de {alumnoCorto ?? "tu hija o hijo"} y te
                      mostramos sólo las suyas. La usamos sólo para buscar.
                    </p>
                    <button
                      type="button"
                      disabled={buscando}
                      onClick={() => selfieInputRef.current?.click()}
                      className="min-h-11 shrink-0 rounded-lg border border-[#c27b3d] px-4 text-sm font-semibold text-[#a8652e] disabled:opacity-60"
                    >
                      {buscando ? "Buscando…" : "Buscar con una foto"}
                    </button>
                  </div>
                )}
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void buscarConSelfie(f);
                  }}
                />
              </div>
            ) : null}
            <PhotoPickGrid
              photoIds={visibles}
              selected={elegidas}
              onToggle={tocar}
              onZoom={setZoomId}
              thumbUrl={thumbUrl}
              full={completo}
              accent="combo"
            />
          </section>
        ) : null}

        {paso === "revisar" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            {casilleros("lg", false)}
            <h1 className="m-0 mt-6 text-2xl font-semibold text-[#1f2328]">
              {total === 1 ? "¿Es esta?" : "¿Son estas?"}
            </h1>
            <p className="m-0 mt-2 text-[#4b4f56]">
              Al confirmar {total === 1 ? "queda pedida y no se puede cambiar" : "quedan pedidas y no se pueden cambiar"}.
              No vas a pagar nada.
            </p>
            <button
              type="button"
              onClick={() => irA("elegir")}
              className="mt-5 text-sm font-medium text-[#6b6f76] underline"
            >
              Cambiar fotos
            </button>
          </section>
        ) : null}

        {paso === "listo" && resultado ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            {casilleros("lg", false)}
            <h1 className="m-0 mt-6 text-2xl font-semibold text-[#1f2328]">¡Listo! Tu pack quedó canjeado</h1>
            <p className="m-0 mt-1 text-sm text-[#6b6f76]">Pedido #{resultado.pedido}</p>
            {resultado.downloadUrl ? (
              <>
                <a
                  href={resultado.downloadUrl}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2f7d5b] px-6 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7d5b] sm:w-auto"
                >
                  Descargar mis fotos digitales
                </a>
                <p className="m-0 mt-3 text-sm text-[#4b4f56]">
                  Si todavía se están preparando, esa página te avisa y se actualiza sola. También te llega el
                  link por correo.
                </p>
              </>
            ) : null}
            {hayImpresas ? (
              <p className="m-0 mt-5 text-[15px] text-[#3d4148]">{entregaImpresas}</p>
            ) : null}
            {album.sellsSingles ? (
              <div className="mt-7 border-t border-[#efeae4] pt-6">
                <p className="m-0 text-[15px] text-[#3d4148]">¿Querés más fotos? Las podés comprar en la galería.</p>
                <a
                  href={galeriaHref}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[#c27b3d] px-5 text-sm font-semibold text-[#a8652e]"
                >
                  Comprar más fotos
                </a>
              </div>
            ) : (
              <a href={galeriaHref} className="mt-6 inline-block text-sm font-medium text-[#a8652e] underline">
                Volver a la galería
              </a>
            )}
          </section>
        ) : null}

        {aviso ? (
          <p role="status" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4a12]">
            {aviso}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#fdecec] px-4 py-3 text-sm text-[#9b1c1c]">
            {error}
          </p>
        ) : null}
      </main>

      {paso === "elegir" || paso === "revisar" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e1da] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => irA(paso === "elegir" ? "intro" : "elegir")}
              className="min-h-12 px-2 text-sm font-medium text-[#6b6f76] underline"
            >
              Volver
            </button>
            {paso === "elegir" ? (
              <button
                type="button"
                disabled={!completo}
                onClick={() => irA("revisar")}
                className="min-h-12 flex-1 rounded-xl bg-[#2f7d5b] px-5 text-base font-semibold text-white disabled:bg-[#c9c3bc] sm:flex-none"
              >
                {completo
                  ? total === 1
                    ? "Listo, es esta"
                    : `Listo, son mis ${total} fotos`
                  : `Elegí ${total - elegidas.length} más`}
              </button>
            ) : (
              <button
                type="button"
                disabled={enviando}
                onClick={() => void confirmar()}
                className="min-h-12 flex-1 rounded-xl bg-[#c27b3d] px-5 text-base font-semibold text-white hover:bg-[#a8652e] disabled:bg-[#c9c3bc] sm:flex-none"
              >
                {enviando ? "Confirmando…" : "Confirmar mi pack"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {zoomId != null ? (
        <PhotoSlideViewer
          photos={viewerPhotos}
          initialIndex={Math.max(0, visibles.indexOf(zoomId))}
          onClose={() => setZoomId(null)}
          onPhotoSelect={(id) => tocar(Number(id))}
          protectUnpurchased={album.scanProtection}
        />
      ) : null}
    </div>
  );
}
