"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EDITION_LABELS, EDITIONS, EXHIBITOR_TEXT_LIMITS, EXHIBITOR_WORK_STATUS_LABELS_ORGANIZER, fichaDetail, isExhibitorWorkStatus,
} from "@repo/muestras";
import {
  aprobarObraDeExpositor, corregirObraDeExpositor, pedirCambiosObraDeExpositor, sacarExpositor, sacarObraDeExpositor, type ResultadoRevision,
} from "@/lib/expositores/revision";
import { botonFino, botonLleno, campo, enlace, nota } from "./estilos";

export type ObraParaRevisar = {
  id: string;
  status: string;
  imageUrl: string | null;
  title: string;
  year: number | null;
  technique: string | null;
  imageWidthCm: number | null;
  imageHeightCm: number | null;
  frameWidthCm: number | null;
  frameHeightCm: number | null;
  edition: string | null;
  editionNumber: number | null;
  editionSize: number | null;
  statement: string | null;
  forSale: boolean;
  priceArs: number | null;
  hangingNotes: string | null;
  reviewNote: string | null;
};

export type ExpositorParaRevisar = {
  id: string;
  status: string;
  displayName: string;
  seSumo: string;
  perfil: { slug: string; avatarUrl: string | null; fotosDePortfolio: number } | null;
  obras: ObraParaRevisar[];
};

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
const cm = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

function useAccion() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = (f: () => Promise<ResultadoRevision>, listo: string, alTerminar?: () => void) =>
    empezar(async () => {
      const r = await f();
      setMensaje(r.ok ? { ok: true, texto: r.aviso ?? listo } : { ok: false, texto: r.errores.join(" ") });
      if (r.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  const aviso = mensaje ? <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? nota : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null;
  return { pendiente, correr, aviso };
}

/** Una obra con todo lo que cargó quien expone (la organización ve el precio) y sus acciones. */
function Obra({ o, autor }: { o: ObraParaRevisar; autor: string }) {
  const { pendiente, correr, aviso } = useAccion();
  const [modo, setModo] = useState<"nada" | "cambios" | "corregir">("nada");
  const [edicion, setEdicion] = useState(o.edition ?? "");
  const detalle = fichaDetail(o);
  const marco = o.frameWidthCm != null && o.frameHeightCm != null ? `${cm(o.frameWidthCm)} × ${cm(o.frameHeightCm)} cm con marco` : null;
  const estado = isExhibitorWorkStatus(o.status) ? EXHIBITOR_WORK_STATUS_LABELS_ORGANIZER[o.status] : o.status;
  const activa = o.status !== "REMOVED" && o.status !== "DRAFT";

  const pedir = (fd: FormData) => correr(() => pedirCambiosObraDeExpositor(o.id, String(fd.get("nota") ?? "")), "Le pediste cambios.", () => setModo("nada"));
  const corregir = (fd: FormData) => {
    fd.set("id", o.id);
    correr(() => corregirObraDeExpositor(fd), "Corregiste los datos.", () => setModo("nada"));
  };

  return (
    <article className="grid gap-4 border-b border-[var(--mf-line)] py-6 sm:grid-cols-[minmax(0,240px)_1fr]">
      {o.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.imageUrl} alt="" className="aspect-square w-full bg-[var(--mf-surface)] object-contain" />
      ) : <span aria-hidden className="block aspect-square w-full bg-[var(--mf-surface)]" />}
      <div className="min-w-0 space-y-2">
        <p className={nota}>{estado}</p>
        <h3 className="mf-titulo text-xl">{o.title || "Sin título"}</h3>
        <p className="text-[15px]">{autor}</p>
        {detalle ? <p className="text-[15px]">{detalle}</p> : null}
        {marco ? <p className={nota}>{marco}</p> : null}
        {o.statement ? <p className="whitespace-pre-line text-[15px]">{o.statement}</p> : null}
        {o.forSale ? <p className="text-[15px]">A la venta{o.priceArs != null ? `: ${pesos(o.priceArs)}` : ""}</p> : null}
        {o.hangingNotes ? <p className="text-[15px]">Para el montaje: {o.hangingNotes}</p> : null}
        {o.reviewNote && o.status === "CHANGES_REQUESTED" ? <p className={nota}>Le pediste: {o.reviewNote}</p> : null}

        {activa ? (
          <p className="flex flex-wrap gap-2 pt-2">
            {o.status === "SUBMITTED" ? (
              <button type="button" className={botonLleno} disabled={pendiente} onClick={() => correr(() => aprobarObraDeExpositor(o.id), "Aprobada: ya está en la muestra.")}>
                Aprobar
              </button>
            ) : null}
            {o.status === "SUBMITTED" || o.status === "APPROVED" ? (
              <button type="button" className={botonFino} disabled={pendiente} onClick={() => setModo(modo === "cambios" ? "nada" : "cambios")}>Pedir cambios</button>
            ) : null}
            <button type="button" className={botonFino} disabled={pendiente} onClick={() => setModo(modo === "corregir" ? "nada" : "corregir")}>Corregir datos</button>
            <button
              type="button" className={botonFino} disabled={pendiente}
              onClick={() => {
                if (window.confirm("La obra deja de estar en la muestra, en las fichas y en el plano.")) correr(() => sacarObraDeExpositor(o.id), "La sacaste de la muestra.");
              }}
            >
              Sacar de la muestra
            </button>
          </p>
        ) : null}

        {modo === "cambios" ? (
          <form action={pedir} className="space-y-2">
            <label className="block space-y-1">
              <span className={nota}>Qué hay que cambiar (lo lee quien expone)</span>
              <textarea name="nota" rows={3} required maxLength={EXHIBITOR_TEXT_LIMITS.reviewNote} className={campo} />
            </label>
            {o.status === "APPROVED" ? <p className={nota}>Mientras tanto, la obra sigue en la muestra con los datos de ahora.</p> : null}
            <p><button type="submit" className={botonFino} disabled={pendiente}>Pedir los cambios</button></p>
          </form>
        ) : null}

        {modo === "corregir" ? (
          <form action={corregir} className="space-y-3">
            <label className="block space-y-1"><span className={nota}>Título</span><input name="title" defaultValue={o.title} maxLength={EXHIBITOR_TEXT_LIMITS.title} className={campo} /></label>
            <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
              <label className="block space-y-1"><span className={nota}>Año</span><input name="year" inputMode="numeric" defaultValue={o.year ?? ""} className={campo} /></label>
              <label className="block space-y-1"><span className={nota}>Técnica y soporte</span><input name="technique" defaultValue={o.technique ?? ""} maxLength={EXHIBITOR_TEXT_LIMITS.technique} className={campo} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block space-y-1"><span className={nota}>Imagen: ancho</span><input name="imageWidthCm" inputMode="decimal" defaultValue={cm(o.imageWidthCm)} className={campo} /></label>
              <label className="block space-y-1"><span className={nota}>Imagen: alto</span><input name="imageHeightCm" inputMode="decimal" defaultValue={cm(o.imageHeightCm)} className={campo} /></label>
              <label className="block space-y-1"><span className={nota}>Marco: ancho</span><input name="frameWidthCm" inputMode="decimal" defaultValue={cm(o.frameWidthCm)} className={campo} /></label>
              <label className="block space-y-1"><span className={nota}>Marco: alto</span><input name="frameHeightCm" inputMode="decimal" defaultValue={cm(o.frameHeightCm)} className={campo} /></label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-52 space-y-1">
                <span className={nota}>Edición</span>
                <select name="edition" value={edicion} onChange={(e) => setEdicion(e.target.value)} className={campo}>
                  <option value="">Elegí…</option>
                  {EDITIONS.map((ed) => <option key={ed} value={ed}>{EDITION_LABELS[ed]}</option>)}
                </select>
              </label>
              {edicion === "LIMITED" ? (
                <>
                  <label className="block w-24 space-y-1"><span className={nota}>Copia n.º</span><input name="editionNumber" type="number" min={1} defaultValue={o.editionNumber ?? ""} className={campo} /></label>
                  <label className="block w-24 space-y-1"><span className={nota}>Total</span><input name="editionSize" type="number" min={1} defaultValue={o.editionSize ?? ""} className={campo} /></label>
                </>
              ) : null}
            </div>
            <label className="block space-y-1"><span className={nota}>Texto de la obra</span><textarea name="statement" rows={3} defaultValue={o.statement ?? ""} maxLength={EXHIBITOR_TEXT_LIMITS.statement} className={campo} /></label>
            <label className="block space-y-1"><span className={nota}>Notas para el montaje</span><textarea name="hangingNotes" rows={2} defaultValue={o.hangingNotes ?? ""} maxLength={EXHIBITOR_TEXT_LIMITS.hangingNotes} className={campo} /></label>
            <p className={nota}>La foto, la venta y el precio los cambia quien expone.</p>
            <p><button type="submit" className={botonFino} disabled={pendiente}>Guardar la corrección</button></p>
          </form>
        ) : null}
        {aviso}
      </div>
    </article>
  );
}

function SacarPersona({ exhibitorId }: { exhibitorId: string }) {
  const { pendiente, correr, aviso } = useAccion();
  return (
    <div className="space-y-2 pt-4">
      <button
        type="button" className={`text-[15px] ${enlace}`} disabled={pendiente}
        onClick={() => {
          if (window.confirm("Esta persona y todas sus obras dejan de estar en la muestra, en las fichas y en el plano.")) {
            correr(() => sacarExpositor(exhibitorId), "La sacaste de la muestra.");
          }
        }}
      >
        Sacar a esta persona de la muestra
      </button>
      {aviso}
    </div>
  );
}

/** Revisión de la organización (spec D2, D7, D8): primero lo que espera, después cada expositor. */
export function RevisionExpositores({ expositores }: { expositores: ExpositorParaRevisar[] }) {
  const activos = expositores.filter((e) => e.status === "ACTIVE");
  const todas = activos.flatMap((e) => e.obras.map((o) => ({ o, autor: e.displayName })));
  const paraRevisar = todas.filter((x) => x.o.status === "SUBMITTED");
  const enLaMuestra = todas.filter((x) => x.o.status === "APPROVED").length;
  const conCambios = todas.filter((x) => x.o.status === "CHANGES_REQUESTED").length;
  if (!expositores.length) {
    return <p className="border-t border-[var(--mf-line)] pt-6 text-[15px]">Todavía no se sumó nadie. Cuando alguien se sume con el enlace, lo vas a ver acá.</p>;
  }
  return (
    <div className="space-y-10">
      <p className="border-t border-[var(--mf-line)] pt-6 text-[15px]">
        {activos.length === 1 ? "1 expositor" : `${activos.length} expositores`} · {enLaMuestra === 1 ? "1 obra" : `${enLaMuestra} obras`} en la muestra ·{" "}
        {paraRevisar.length} para revisar · {conCambios} con cambios pedidos
      </p>

      <section className="space-y-2">
        <h2 className="text-xl">Para revisar ({paraRevisar.length})</h2>
        {paraRevisar.length ? paraRevisar.map(({ o, autor }) => <Obra key={o.id} o={o} autor={autor} />) : <p className={nota}>No hay obras esperando revisión.</p>}
      </section>

      {expositores.map((e) => (
        <section key={e.id} className="space-y-2 border-t border-[var(--mf-ink)] pt-6">
          <div className="flex items-center gap-4">
            {e.perfil?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.perfil.avatarUrl} alt="" className="size-14 rounded-full object-cover" />
            ) : <span aria-hidden className="size-14 rounded-full bg-[var(--mf-surface)]" />}
            <div className="min-w-0">
              <h2 className="text-lg">
                {e.perfil ? <Link href={`/fotografos/${e.perfil.slug}`} className={enlace}>{e.displayName}</Link> : e.displayName}
              </h2>
              <p className={nota}>
                Se sumó el {e.seSumo}
                {e.perfil ? ` · Portfolio: ${e.perfil.fotosDePortfolio === 1 ? "1 foto" : `${e.perfil.fotosDePortfolio} fotos`}` : ""}
                {e.status !== "ACTIVE" ? " · Fuera de la muestra" : ""}
              </p>
            </div>
          </div>
          {e.obras.filter((o) => o.status !== "SUBMITTED" || e.status !== "ACTIVE").map((o) => <Obra key={o.id} o={o} autor={e.displayName} />)}
          {e.obras.length === 0 ? <p className={nota}>Todavía no cargó obras.</p> : null}
          {e.status === "ACTIVE" ? <SacarPersona exhibitorId={e.id} /> : null}
        </section>
      ))}
    </div>
  );
}
