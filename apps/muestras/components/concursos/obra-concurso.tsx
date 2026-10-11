"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarOpcionesDeObra, marcarAutorizacionEscrita, sacarObraDelConcurso } from "@/lib/concursos/acciones";
import type { PanelDelConcurso } from "@/lib/concursos/consultas";
import { alerta, botonChico, nota } from "./estilos";

type Obra = PanelDelConcurso["obras"][number];

/** El permiso en palabras (D14, D16, D22). */
function estadoDelPermiso(o: Obra): string {
  if (o.exhibitConsent === "ACCEPTED") {
    if (o.consentBy === "RULES") return "Las bases lo autorizan";
    if (o.consentBy === "ORGANIZER") return "Autorización por escrito";
    return "Aceptó";
  }
  if (o.exhibitConsent === "DECLINED") return "Prefirió que no";
  if (o.exhibitConsent === "WITHDRAWN") return "Sacada por el autor";
  return "Esperando al autor";
}

function estadoDeLaImagen(o: Obra): string | null {
  if (o.imageStatus === "FAILED") return o.imageError ?? "No pudimos traer la imagen de FotoRank.";
  if (o.imageStatus === "PENDING" && o.include && o.exhibitConsent === "ACCEPTED") return "Imagen por copiar";
  if (o.imageStatus === "PENDING") return "La imagen se copia cuando haya permiso";
  return null;
}

const VENTA: Record<string, string> = {
  PENDING: "Le preguntamos al autor por la venta.",
  ACCEPTED: "El autor acepta que se venda.",
  DECLINED: "El autor prefiere que no se venda.",
};

/** Una obra del concurso en el panel: miniatura, datos, casillas y botones (D13, D16, D22, D28). */
export function ObraConcurso({ obra: o, editable }: { obra: Obra; editable: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const correr = (accion: () => Promise<{ ok: true; avisos?: string[] } | { ok: false; errores: string[] }>) =>
    start(async () => {
      setError(null);
      setAviso(null);
      const r = await accion();
      if (!r.ok) setError(r.errores.join(" "));
      else if (r.avisos?.length) setAviso(r.avisos.join(" "));
      router.refresh();
    });
  const opciones = (cambio: Partial<{ include: boolean; toPrint: boolean; forSale: boolean }>) =>
    // Sólo la casilla que cambió y la versión de la obra que se ve: si cambió mientras tanto, no se pisa.
    correr(() => guardarOpcionesDeObra(o.id, cambio, new Date(o.updatedAt).toISOString()));

  const imagen = estadoDeLaImagen(o);
  const casilla = "flex items-center gap-2 text-[15px]";
  return (
    <li className="flex flex-wrap gap-4 border-b border-[var(--mf-line)] py-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-[2px] bg-[var(--mf-surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- copia propia en nuestro bucket */}
        {o.imageUrl ? <img src={o.imageUrl} alt="" className="size-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1 basis-56 space-y-2">
        <p className="mf-titulo break-words text-lg leading-tight">{o.title}</p>
        <p className="break-words text-[15px]">
          {o.authorName}{" "}
          <span className={nota}>
            {o.sinCuenta ? "· Sin cuenta en FotoRank" : o.seVeSuNombre ? "· Se va a ver su nombre" : "· Autoría reservada hasta que el autor confirme"}
          </span>
        </p>
        <p className="text-sm">{o.distinction}</p>
        <p className={nota}>
          {estadoDelPermiso(o)}{o.enLaMuestra ? " · En la muestra" : ""}{imagen ? ` · ${imagen}` : ""}
        </p>
        {o.sourceStatus === "GONE" ? <p className={alerta}>Ya no figura en los resultados del concurso.</p> : null}
        {o.sinCuenta && o.exhibitConsent === "PENDING" ? (
          <p className={nota}>No tiene cuenta: no puede responder desde la plataforma. Si te autorizó por escrito, marcalo.</p>
        ) : null}
        {o.forSale && VENTA[o.saleConsent] ? <p className={nota}>{VENTA[o.saleConsent]}</p> : null}

        <fieldset disabled={!editable || pendiente} className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          <legend className="sr-only">Opciones de “{o.title}”</legend>
          <label className={casilla}>
            <input type="checkbox" checked={o.include} onChange={(e) => opciones({ include: e.target.checked })} className="size-4" />
            Galería virtual
          </label>
          <label className={casilla}>
            <input type="checkbox" checked={o.toPrint} disabled={!o.include} onChange={(e) => opciones({ toPrint: e.target.checked })} className="size-4" />
            Se imprime
          </label>
          <label className={casilla}>
            <input type="checkbox" checked={o.forSale} onChange={(e) => opciones({ forSale: e.target.checked })} className="size-4" />
            A la venta
          </label>
        </fieldset>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            {o.exhibitConsent === "PENDING" ? (
              <button type="button" disabled={pendiente} className={botonChico} onClick={() => correr(() => marcarAutorizacionEscrita(o.id))}>
                Tengo su autorización por escrito
              </button>
            ) : null}
            {o.sourceStatus === "GONE" && o.include ? (
              <button type="button" disabled={pendiente} className={botonChico} onClick={() => correr(() => sacarObraDelConcurso(o.id))}>
                Sacar de la muestra
              </button>
            ) : null}
          </div>
        ) : null}
        {aviso ? <p role="status" className={alerta}>{aviso}</p> : null}
        {error ? <p role="alert" className={alerta}>{error}</p> : null}
      </div>
    </li>
  );
}
