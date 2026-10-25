"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EDITION_LABELS, EDITION_SIZE_MAX, EDITIONS, EXHIBITOR_TEXT_LIMITS, EXHIBITOR_WORK_STATUS_LABELS, fichaDetail, isExhibitorWorkStatus,
} from "@repo/muestras";
import { subirImagen } from "@/components/formulario/subir-imagen";
import {
  borrarObraDeExpositor, enviarObraDeExpositor, guardarObraDeExpositor, retirarObraDeExpositor, type ResultadoObra,
} from "@/lib/expositores/obras";
import { botonFino, botonLleno, campo, nota } from "./estilos";

export type ObraDeExpositor = {
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
  activityWorkId: string | null;
};

const cm = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Una obra de quien expone (spec D5, D7): la foto que se cuelga y sus datos. Se edita en borrador o
 * con cambios pedidos; enviada, se puede retirar; aprobada, queda en lectura.
 */
export function ObraExpositor({ exhibitorId, obra, activo, alGuardar }: {
  exhibitorId: string;
  obra: ObraDeExpositor | null;
  activo: boolean;
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; textos: string[] } | null>(null);
  const [foto, setFoto] = useState<string | null>(obra?.imageUrl ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [edicion, setEdicion] = useState(obra?.edition ?? "");
  const [vender, setVender] = useState(obra?.forSale ?? false);

  const status = obra?.status ?? "DRAFT";
  const editable = activo && (status === "DRAFT" || status === "CHANGES_REQUESTED");

  const correr = (f: () => Promise<ResultadoObra>, listo: string) =>
    empezar(async () => {
      const r = await f();
      setMensaje(r.ok ? { ok: true, textos: [listo] } : { ok: false, textos: r.errores });
      if (r.ok) {
        alGuardar?.();
        router.refresh();
      }
    });

  async function subir(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setMensaje(null);
    try {
      setFoto(await subirImagen(file, "obra"));
    } catch (e) {
      setMensaje({ ok: false, textos: [e instanceof Error ? e.message : "No pudimos subir la foto."] });
    } finally {
      setSubiendo(false);
    }
  }

  const guardar = (fd: FormData) => {
    fd.set("exhibitorId", exhibitorId);
    if (obra) fd.set("id", obra.id);
    fd.set("imageUrl", foto ?? "");
    correr(() => guardarObraDeExpositor(fd), "Guardamos la obra.");
  };

  const aviso = mensaje ? (
    <ul role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? nota : "space-y-1 text-[var(--mf-alerta)]"}>
      {mensaje.textos.map((t) => <li key={t}>{t}</li>)}
    </ul>
  ) : null;

  const etiqueta = isExhibitorWorkStatus(status) ? EXHIBITOR_WORK_STATUS_LABELS[status] : status;

  if (obra && !editable) {
    const detalle = fichaDetail(obra);
    return (
      <article className="grid gap-4 border-b border-[var(--mf-line)] pb-6 sm:grid-cols-[180px_1fr]">
        {obra.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={obra.imageUrl} alt="" className="aspect-square w-full bg-[var(--mf-surface)] object-contain" />
        ) : <span aria-hidden className="aspect-square w-full bg-[var(--mf-surface)]" />}
        <div className="space-y-2">
          <p className={nota}>{status === "APPROVED" ? "Ya está en la muestra" : etiqueta}</p>
          <h3 className="mf-titulo text-xl">{obra.title || "Sin título"}</h3>
          {detalle ? <p className="text-[15px]">{detalle}</p> : null}
          {obra.reviewNote && status === "REMOVED" ? <p className="text-[15px]">{obra.reviewNote}</p> : null}
          {status === "SUBMITTED" && activo ? (
            <p>
              <button type="button" className={botonFino} disabled={pendiente} onClick={() => correr(() => retirarObraDeExpositor(obra.id), "Retiraste el envío: volvió a borrador.")}>
                Retirar el envío
              </button>
            </p>
          ) : null}
          {aviso}
        </div>
      </article>
    );
  }

  return (
    <form action={guardar} className="space-y-5 border-b border-[var(--mf-line)] pb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-lg">{obra ? obra.title || "Obra sin título" : "Obra nueva"}</h3>
        <p className={nota}>{etiqueta}</p>
      </div>
      {obra?.reviewNote && status === "CHANGES_REQUESTED" ? (
        <p className="border-l-2 border-[var(--mf-alerta)] pl-3 text-[15px]">Quien organiza te pidió: {obra.reviewNote}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="aspect-square w-full bg-[var(--mf-surface)] object-contain" />
          ) : <span aria-hidden className="block aspect-square w-full bg-[var(--mf-surface)]" />}
          <label className="block cursor-pointer text-[15px] underline underline-offset-4">
            {subiendo ? "Subiendo…" : foto ? "Cambiar la foto" : "Subir la foto que se cuelga"}
            <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </div>
        <div className="space-y-4">
          <label className="block space-y-1">
            <span>Título</span>
            <input name="title" maxLength={EXHIBITOR_TEXT_LIMITS.title} defaultValue={obra?.title ?? ""} className={campo} />
          </label>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <label className="block space-y-1">
              <span>Año</span>
              <input name="year" inputMode="numeric" defaultValue={obra?.year ?? ""} className={campo} />
            </label>
            <label className="block space-y-1">
              <span>Técnica y soporte</span>
              <input name="technique" maxLength={EXHIBITOR_TEXT_LIMITS.technique} defaultValue={obra?.technique ?? ""} placeholder="Impresión giclée sobre papel algodón" className={campo} />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <span>Medida de la imagen (cm)</span>
          <div className="flex items-center gap-2">
            <input name="imageWidthCm" inputMode="decimal" aria-label="Ancho de la imagen en cm" placeholder="ancho" defaultValue={cm(obra?.imageWidthCm ?? null)} className={campo} />
            <span aria-hidden>×</span>
            <input name="imageHeightCm" inputMode="decimal" aria-label="Alto de la imagen en cm" placeholder="alto" defaultValue={cm(obra?.imageHeightCm ?? null)} className={campo} />
          </div>
        </div>
        <div className="space-y-1">
          <span>Medida con marco (cm)</span>
          <div className="flex items-center gap-2">
            <input name="frameWidthCm" inputMode="decimal" aria-label="Ancho con marco en cm" placeholder="ancho" defaultValue={cm(obra?.frameWidthCm ?? null)} className={campo} />
            <span aria-hidden>×</span>
            <input name="frameHeightCm" inputMode="decimal" aria-label="Alto con marco en cm" placeholder="alto" defaultValue={cm(obra?.frameHeightCm ?? null)} className={campo} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block w-56 space-y-1">
          <span>Edición</span>
          <select name="edition" value={edicion} onChange={(e) => setEdicion(e.target.value)} className={campo}>
            <option value="">Elegí…</option>
            {EDITIONS.map((ed) => <option key={ed} value={ed}>{EDITION_LABELS[ed]}</option>)}
          </select>
        </label>
        {edicion === "LIMITED" ? (
          <>
            <label className="block w-24 space-y-1">
              <span className={nota}>Copia n.º</span>
              <input name="editionNumber" type="number" min={1} max={EDITION_SIZE_MAX} defaultValue={obra?.editionNumber ?? ""} className={campo} />
            </label>
            <label className="block w-24 space-y-1">
              <span className={nota}>De un total de</span>
              <input name="editionSize" type="number" min={1} max={EDITION_SIZE_MAX} defaultValue={obra?.editionSize ?? ""} className={campo} />
            </label>
          </>
        ) : null}
      </div>

      <label className="block space-y-1">
        <span>Texto de la obra (optativo)</span>
        <textarea name="statement" rows={4} maxLength={EXHIBITOR_TEXT_LIMITS.statement} defaultValue={obra?.statement ?? ""} className={campo} />
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="forSale" value="1" checked={vender} onChange={(e) => setVender(e.target.checked)} />
          La quiero vender
        </label>
        {vender ? (
          <label className="block w-56 space-y-1">
            <span className={nota}>Precio en pesos</span>
            <input name="priceArs" inputMode="numeric" defaultValue={obra?.priceArs ?? ""} placeholder="120.000" className={campo} />
          </label>
        ) : null}
        {vender ? <p className={nota}>El precio sólo lo ve quien organiza. Se va a usar cuando la venta esté disponible.</p> : null}
      </div>

      <label className="block space-y-1">
        <span>Notas para el montaje (optativo)</span>
        <span className={`block ${nota}`}>Sólo las ve quien organiza.</span>
        <textarea name="hangingNotes" rows={2} maxLength={EXHIBITOR_TEXT_LIMITS.hangingNotes} defaultValue={obra?.hangingNotes ?? ""} className={campo} />
      </label>

      <p className="flex flex-wrap gap-3">
        <button type="submit" className={botonFino} disabled={pendiente || subiendo}>{pendiente ? "Guardando…" : "Guardar"}</button>
        {obra ? (
          <button
            type="button" className={botonLleno} disabled={pendiente || subiendo}
            onClick={() => correr(() => enviarObraDeExpositor(obra.id), "Enviaste la obra a la organización.")}
          >
            Enviar a la organización
          </button>
        ) : null}
        {obra && (status === "DRAFT" || !obra.activityWorkId) ? (
          <button
            type="button" className={botonFino} disabled={pendiente}
            onClick={() => { if (window.confirm("¿Borrar esta obra?")) correr(() => borrarObraDeExpositor(obra.id), "Borramos la obra."); }}
          >
            Borrar
          </button>
        ) : null}
      </p>
      {obra ? null : <p className={nota}>Guardala y después enviala a la organización.</p>}
      {aviso}
    </form>
  );
}
