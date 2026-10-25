"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EDITION_KIND_LABELS, OFFER_FORMAT_LABELS, REVIEW_NOTE_MAX, isEditionKind, isOfferFormat } from "@repo/muestras";
import { aprobarOferta, emitirPruebaDeAutor, pausarOferta, pedirCambiosOferta, reanudarOferta } from "@/lib/ventas/revision";
import { alerta, botonChico, botonFino, botonLleno, campo, nota } from "./estilos";

type Resultado = { ok: true; aviso?: string } | { ok: false; errores: string[] };

export type FormatoParaRevisar = {
  id: string;
  imageUrl: string;
  title: string;
  authorName: string;
  format: string;
  editionKind: string;
  editionSize: number;
  proofCount: number;
  paper: string | null;
  widthCm: number | null;
  heightCm: number | null;
  priceArs: number;
  approvedPriceArs: number | null;
  firstSoldAt: Date | null;
};

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

function useAccion() {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [hecho, setHecho] = useState<string | null>(null);
  const correr = (fn: () => Promise<Resultado>, despues?: () => void) => {
    setErrores([]);
    setHecho(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErrores(r.errores);
      setHecho(r.aviso ?? null);
      despues?.();
      router.refresh();
    });
  };
  return { pendiente, errores, hecho, correr };
}

function Mensajes({ errores, hecho }: { errores: string[]; hecho: string | null }) {
  return (
    <>
      {errores.length ? <ul role="alert" className={`space-y-1 ${alerta}`}>{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {hecho ? <p role="status" className={nota}>{hecho}</p> : null}
    </>
  );
}

function describir(f: FormatoParaRevisar): string {
  const formato = isOfferFormat(f.format) ? OFFER_FORMAT_LABELS[f.format] : f.format;
  const edicion = `${isEditionKind(f.editionKind) ? EDITION_KIND_LABELS[f.editionKind] : f.editionKind}${f.editionKind === "LIMITED" ? ` de ${f.editionSize}` : ""}${f.proofCount ? ` + ${f.proofCount} P/A` : ""}`;
  const papel = f.format === "PRINT" ? ` · ${f.paper ?? ""}, ${f.widthCm} × ${f.heightCm} cm` : "";
  return `${formato} · ${edicion}${papel}`;
}

function Pendiente({ f }: { f: FormatoParaRevisar }) {
  const { pendiente, errores, hecho, correr } = useAccion();
  const [nota_, setNota] = useState<string | null>(null);
  const cambioDePrecio = f.approvedPriceArs != null && f.approvedPriceArs !== f.priceArs;
  return (
    <li className="grid gap-4 border-b border-[var(--mf-line)] py-5 sm:grid-cols-[8rem_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.imageUrl} alt={f.title} className="aspect-square w-32 bg-[var(--mf-surface)] object-contain" />
      <div className="space-y-2 text-[15px]">
        <p className="mf-titulo text-lg">{f.title}</p>
        <p className={nota}>{f.authorName}</p>
        <p>{describir(f)}</p>
        <p>{cambioDePrecio ? `Antes ${pesos(f.approvedPriceArs!)}, ahora ${pesos(f.priceArs)}` : `Precio propuesto: ${pesos(f.priceArs)}`}</p>
        {nota_ == null ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botonLleno} disabled={pendiente} onClick={() => correr(() => aprobarOferta(f.id))}>Aprobar</button>
            <button type="button" className={botonFino} disabled={pendiente} onClick={() => setNota("")}>Pedir cambios</button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea value={nota_} onChange={(e) => setNota(e.target.value)} maxLength={REVIEW_NOTE_MAX} rows={3} placeholder="Qué hay que cambiar" aria-label="Qué hay que cambiar" className={campo} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botonLleno} disabled={pendiente} onClick={() => correr(() => pedirCambiosOferta(f.id, nota_), () => setNota(null))}>Enviar al autor</button>
              <button type="button" className={botonFino} disabled={pendiente} onClick={() => setNota(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <Mensajes errores={errores} hecho={hecho} />
      </div>
    </li>
  );
}

/** "N formatos para revisar" (D10). */
export function RevisionOfertas({ formatos }: { formatos: FormatoParaRevisar[] }) {
  if (formatos.length === 0) return null;
  return (
    <section className="space-y-3 border-t border-[var(--mf-line)] pt-6">
      <h2 className="mf-titulo text-2xl">{formatos.length === 1 ? "Un formato para revisar" : `${formatos.length} formatos para revisar`}</h2>
      <ul className="border-t border-[var(--mf-line)]">{formatos.map((f) => <Pendiente key={f.id} f={f} />)}</ul>
    </section>
  );
}

/** Pausar, reanudar y emitir P/A de un formato ya revisado. */
export function AccionesDeFormato({ id, status, proofCount, pidioPA }: { id: string; status: string; proofCount: number; pidioPA: boolean }) {
  const { pendiente, errores, hecho, correr } = useAccion();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {status === "APPROVED" ? <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => pausarOferta(id))}>Pausar</button> : null}
        {status === "PAUSED" ? <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => reanudarOferta(id))}>Reanudar</button> : null}
        {proofCount > 0 && (status === "APPROVED" || status === "PAUSED") ? (
          <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => emitirPruebaDeAutor(id))}>
            {pidioPA ? "Emitir la P/A que pidió el autor" : "Emitir una P/A"}
          </button>
        ) : null}
      </div>
      <Mensajes errores={errores} hecho={hecho} />
    </div>
  );
}
