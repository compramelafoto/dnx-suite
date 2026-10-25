"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EDITION_KIND_LABELS, LIMITED_EDITION_MAX, LIMITED_EDITION_MIN, MAX_OFFERS_PER_WORK, MAX_PROOFS, OFFER_FORMAT_LABELS, OFFER_STATUS_LABELS, PAPER_MAX,
  PRICE_MIN_ARS, SALE_EDITION_DECLARATION, SALE_PRICE_MAX_ARS, isEditionKind, isOfferFormat, isOfferStatus,
} from "@repo/muestras";
import { aceptarReparto, cambiarPrecio, guardarOferta, pedirPruebaDeAutor, proponerOferta, retirarOferta } from "@/lib/ventas/autor";
import type { VentaDelAutor } from "@/lib/ventas/consultas";
import { alerta, botonChico, botonFino, botonLleno, campo, etiqueta, nota } from "./estilos";

type Obra = VentaDelAutor["obras"][number];
type Oferta = Obra["ofertas"][number];
type Resultado = { ok: true } | { ok: false; errores: string[] };

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

function useAccion() {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const correr = (fn: () => Promise<Resultado>, despues?: () => void) => {
    setErrores([]);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErrores(r.errores);
      despues?.();
      router.refresh();
    });
  };
  return { pendiente, errores, correr };
}

const Errores = ({ errores }: { errores: string[] }) =>
  errores.length ? <ul role="alert" className={`space-y-1 ${alerta}`}>{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null;

/** "Acepto este reparto" (D8). */
export function AceptarReparto({ activityId, splitVersion }: { activityId: string; splitVersion: number }) {
  const { pendiente, errores, correr } = useAccion();
  return (
    <form className="space-y-2" action={(fd) => correr(() => aceptarReparto(fd))}>
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="splitVersion" value={splitVersion} />
      <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Guardando…" : "Acepto este reparto"}</button>
      <Errores errores={errores} />
    </form>
  );
}

function FormularioOferta({ obra, oferta, alTerminar }: { obra: Obra; oferta?: Oferta; alTerminar: () => void }) {
  const { pendiente, errores, correr } = useAccion();
  const [formato, setFormato] = useState(oferta?.format ?? "PRINT");
  const [edicion, setEdicion] = useState(oferta?.editionKind ?? "UNIQUE");
  const sugerido = oferta?.priceArs ?? (obra.ofertas.length === 0 ? obra.precioSugerido : null);
  return (
    <form
      className="space-y-4 border-l-2 border-[var(--mf-line)] pl-4"
      action={(fd) => correr(() => guardarOferta(fd), alTerminar)}
    >
      <input type="hidden" name="activityWorkId" value={obra.activityWorkId} />
      {oferta ? <input type="hidden" name="id" value={oferta.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={etiqueta}>
          <span>Formato</span>
          <select name="formato" value={formato} onChange={(e) => setFormato(e.target.value)} className={campo}>
            <option value="PRINT">{OFFER_FORMAT_LABELS.PRINT}</option>
            <option value="DIGITAL">{OFFER_FORMAT_LABELS.DIGITAL}</option>
          </select>
        </label>
        <label className={etiqueta}>
          <span>Edición</span>
          <select name="edicion" value={edicion} onChange={(e) => setEdicion(e.target.value)} className={campo}>
            <option value="UNIQUE">{EDITION_KIND_LABELS.UNIQUE}</option>
            <option value="LIMITED">{EDITION_KIND_LABELS.LIMITED}</option>
          </select>
        </label>
        {edicion === "LIMITED" ? (
          <label className={etiqueta}>
            <span>Cantidad de copias (N)</span>
            <input name="copias" type="number" min={LIMITED_EDITION_MIN} max={LIMITED_EDITION_MAX} required defaultValue={oferta?.editionSize ?? 10} className={campo} />
          </label>
        ) : null}
        <label className={etiqueta}>
          <span>Pruebas de autor (P/A, optativas)</span>
          <input name="pruebas" type="number" min={0} max={MAX_PROOFS} defaultValue={oferta?.proofCount ?? 0} className={campo} />
        </label>
        {formato === "PRINT" ? (
          <>
            <label className={`${etiqueta} sm:col-span-2`}>
              <span>Papel</span>
              <input name="papel" maxLength={PAPER_MAX} required defaultValue={oferta?.paper ?? ""} placeholder="Hahnemühle Photo Rag 308 g" className={campo} />
            </label>
            <label className={etiqueta}>
              <span>Ancho de la imagen (cm)</span>
              <input name="ancho" inputMode="decimal" required defaultValue={oferta?.widthCm ?? ""} className={campo} />
            </label>
            <label className={etiqueta}>
              <span>Alto de la imagen (cm)</span>
              <input name="alto" inputMode="decimal" required defaultValue={oferta?.heightCm ?? ""} className={campo} />
            </label>
          </>
        ) : null}
        <label className={etiqueta}>
          <span>Precio en pesos</span>
          <span className={`block ${nota}`}>De {pesos(PRICE_MIN_ARS)} a {pesos(SALE_PRICE_MAX_ARS)}.</span>
          <input name="precio" inputMode="numeric" required defaultValue={sugerido ?? ""} className={campo} />
        </label>
      </div>
      {edicion === "LIMITED" ? (
        <label className="flex items-start gap-2 text-[15px]">
          <input type="checkbox" name="declaracion" required className="mt-1" />
          <span>{SALE_EDITION_DECLARATION}</span>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar formato"}</button>
        <button type="button" className={botonFino} disabled={pendiente} onClick={alTerminar}>Cancelar</button>
      </div>
      <Errores errores={errores} />
    </form>
  );
}

function FilaOferta({ obra, o }: { obra: Obra; o: Oferta }) {
  const { pendiente, errores, correr } = useAccion();
  const [editando, setEditando] = useState(false);
  const [precio, setPrecio] = useState<string | null>(null);
  const borrador = o.status === "DRAFT" || o.status === "CHANGES_REQUESTED";
  return (
    <li className="space-y-2 border-b border-[var(--mf-line)] py-4 text-[15px]">
      <p>
        <strong>{isOfferFormat(o.format) ? OFFER_FORMAT_LABELS[o.format] : o.format}</strong> ·{" "}
        {isEditionKind(o.editionKind) ? EDITION_KIND_LABELS[o.editionKind] : o.editionKind}
        {o.editionKind === "LIMITED" ? ` de ${o.editionSize}` : ""}
        {o.proofCount ? ` + ${o.proofCount} P/A` : ""}
        {o.format === "PRINT" ? ` · ${o.paper ?? ""}, ${o.widthCm} × ${o.heightCm} cm` : ""}
      </p>
      <p>
        {pesos(o.priceArs)}
        {o.approvedPriceArs != null && o.approvedPriceArs !== o.priceArs ? ` (se vende a ${pesos(o.approvedPriceArs)} hasta que se apruebe el cambio)` : ""} ·{" "}
        {isOfferStatus(o.status) ? OFFER_STATUS_LABELS[o.status] : o.status} · {o.evaluacion.vendidas} vendidas, quedan {o.evaluacion.quedan}
      </p>
      {o.reviewNote ? <p className={nota}>Nota: {o.reviewNote}</p> : null}
      {!o.evaluacion.comprable.ok && o.status !== "WITHDRAWN" && o.status !== "DRAFT" ? (
        <p className={nota}>Todavía no se puede comprar: {o.evaluacion.comprable.reasons.join("; ")}.</p>
      ) : null}
      {editando ? (
        <FormularioOferta obra={obra} oferta={o} alTerminar={() => setEditando(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {borrador ? <button type="button" className={botonChico} disabled={pendiente} onClick={() => setEditando(true)}>Editar</button> : null}
          {borrador ? <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => proponerOferta(o.id))}>Enviar a la organización</button> : null}
          {o.status !== "WITHDRAWN" && o.status !== "PAUSED" ? (
            precio == null ? (
              <button type="button" className={botonChico} disabled={pendiente} onClick={() => setPrecio(String(o.priceArs))}>Cambiar el precio</button>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="numeric" aria-label="Precio nuevo" className={`${campo} w-36`} />
                <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => cambiarPrecio(o.id, Number(precio.replace(/\./g, ""))), () => setPrecio(null))}>Guardar precio</button>
                <button type="button" className={botonChico} onClick={() => setPrecio(null)}>Cancelar</button>
              </span>
            )
          ) : null}
          {o.proofCount > 0 && (o.status === "APPROVED" || o.status === "PAUSED") ? (
            <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => pedirPruebaDeAutor(o.id))}>Pedir mis P/A</button>
          ) : null}
          {o.status !== "WITHDRAWN" ? <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => retirarOferta(o.id))}>Retirar</button> : null}
        </div>
      )}
      <Errores errores={errores} />
    </li>
  );
}

/** Los formatos de una obra y "Agregar formato" (D9, D10). */
export function OfertasDeObra({ obra }: { obra: Obra }) {
  const [agregando, setAgregando] = useState(false);
  const activas = obra.ofertas.filter((o) => o.status !== "WITHDRAWN").length;
  return (
    <div className="space-y-3">
      {obra.ofertas.length ? <ul className="border-t border-[var(--mf-line)]">{obra.ofertas.map((o) => <FilaOferta key={o.id} obra={obra} o={o} />)}</ul> : <p className={nota}>Todavía no propusiste formatos para esta obra.</p>}
      {agregando ? (
        <FormularioOferta obra={obra} alTerminar={() => setAgregando(false)} />
      ) : activas < MAX_OFFERS_PER_WORK ? (
        <button type="button" className={botonFino} onClick={() => setAgregando(true)}>Agregar formato</button>
      ) : null}
    </div>
  );
}
