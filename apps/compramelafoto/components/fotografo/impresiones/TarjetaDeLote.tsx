"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import VerificarLote from "./VerificarLote";
import { partesDelLote } from "@/lib/print-batches/partes-del-lote";
import {
  accionesDelLote,
  faseDelLote,
  fechaDelPanel,
  seguimientoDelLote,
  sePuedeSacar,
  textoDeCopiasDelPanel,
  textoDeLaFase,
  type EntradaDelPanel,
  type FaseDelLote,
  type LoteDelPanel,
} from "@/lib/print-batches/panel";
import type { EstadoLote } from "@/lib/print-batches/reglas";

type Props = {
  lote: LoteDelPanel;
  resaltado: boolean;
  ocupado: boolean;
  onEnviar: (lote: LoteDelPanel) => void;
  onDeshacer: (lote: LoteDelPanel) => void;
  onMover: (lote: LoteDelPanel, hacia: EstadoLote) => void;
  onPagadoAlLab: (lote: LoteDelPanel) => void;
  onQuitar: (lote: LoteDelPanel, entrada: EntradaDelPanel) => void;
};

const BOTON = "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const SECUNDARIO = cn(BOTON, "border-gray-200 bg-white text-gray-700 hover:bg-gray-50");
const PRINCIPAL = cn(BOTON, "border-[#c27b3d] bg-[#c27b3d] text-white hover:bg-[#b06a2f]");
const ENLACE = "text-xs font-medium text-[#c27b3d] hover:underline";

const COLOR_DE_LA_FASE: Partial<Record<FaseDelLote, string>> = {
  ARMADO: "bg-gray-100 text-gray-700",
  SIN_ABRIR: "bg-sky-50 text-sky-800",
  ABIERTO: "bg-sky-50 text-sky-800",
  DESCARGADO: "bg-violet-50 text-violet-800",
  POR_FUERA: "bg-emerald-50 text-emerald-800",
  EN_PRODUCCION: "bg-amber-50 text-amber-800",
  LISTO: "bg-emerald-50 text-emerald-800",
  DESPACHADO: "bg-indigo-50 text-indigo-800",
  RECIBIDO: "bg-emerald-50 text-emerald-800",
  CERRADO: "bg-gray-100 text-gray-600",
};

export default function TarjetaDeLote({ lote, resaltado, ocupado, onEnviar, onDeshacer, onMover, onPagadoAlLab, onQuitar }: Props) {
  const acciones = accionesDelLote(lote);
  const totalCopias = lote.entradas.reduce((s, e) => s + e.totalCopias, 0);
  const partes = partesDelLote(lote.entradas.flatMap((e) => (e.albumOrderId != null ? [e.albumOrderId] : []))).length;
  const base = `/api/fotografo/impresiones/lotes/${lote.id}`;
  const fase = faseDelLote(lote);
  const seguimiento = seguimientoDelLote(lote);
  const [verificando, setVerificando] = useState(false);
  const envio = [
    ...(lote.laboratorio ? [{ etiqueta: "Laboratorio", valor: lote.laboratorio }] : []),
    { etiqueta: "Entrega", valor: lote.entregaPreferida === "ENVIA_LAB" ? "Lo envía el laboratorio" : "Lo retirás vos" },
    ...(lote.fechaPrometida ? [{ etiqueta: "Prometido", valor: fechaDelPanel(lote.fechaPrometida) }] : []),
    ...(lote.mensajeAlLab?.trim() ? [{ etiqueta: "Mensaje", valor: lote.mensajeAlLab.trim() }] : []),
  ];

  return (
    <article
      id={`lote-${lote.id}`}
      className={cn(
        "ds-card rounded-xl border bg-white p-3 space-y-2.5 scroll-mt-24",
        resaltado ? "border-[#c27b3d] ring-2 ring-[#c27b3d]/40" : "border-gray-200",
      )}
    >
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {lote.nombre}
            {lote.laboratorio ? <span className="font-normal text-gray-600"> · {lote.laboratorio}</span> : null}
          </h3>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", COLOR_DE_LA_FASE[fase] ?? "bg-gray-100 text-gray-700")}>
            {textoDeLaFase(fase)}
          </span>
        </div>
        <p className="text-xs text-gray-600">
          {lote.entradas.length} {lote.entradas.length === 1 ? "pedido" : "pedidos"} · {totalCopias} {totalCopias === 1 ? "copia" : "copias"}
          {lote.fechaPrometida ? ` · Prometido ${fechaDelPanel(lote.fechaPrometida)}` : ""}
        </p>
        {seguimiento.length ? (
          <ol aria-label="Seguimiento del lote" className="m-0 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0 text-[11px] text-gray-600">
            {seguimiento.map((p) => (
              <li key={p.texto}>
                <span className="text-emerald-700">✓</span> {p.texto} <span className="text-gray-400">{p.cuando}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {lote.estado === "ENVIADO" && !lote.labDescargoAt ? (
          <p className="text-[11px] text-gray-500">
            Cuando el laboratorio descargue las fotos lo vas a ver acá.
            {lote.entregaPreferida === "ENVIA_LAB" ? " Te lo envían." : " Lo retirás vos."}
          </p>
        ) : null}
        {lote.pagadoAlLabAt ? <p className="text-xs text-emerald-700">Pagado al laboratorio el {fechaDelPanel(lote.pagadoAlLabAt)}</p> : null}
      </header>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {lote.entradas.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                #{e.albumOrderId ?? "—"} {e.cliente}
                {e.retiraCliente ? <span className="ml-1 font-normal text-gray-500">(retira el cliente)</span> : null}
              </p>
              <p className="text-[11px] text-gray-500">{textoDeCopiasDelPanel(e.copias)}</p>
              {e.entregadoAt ? <p className="text-[11px] text-emerald-700">Entregado {fechaDelPanel(e.entregadoAt)}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {e.codigoQr && !e.entregadoAt ? (
                <a href={`/pedido/entrega/${encodeURIComponent(e.codigoQr)}`} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                  QR · entregar
                </a>
              ) : null}
              {acciones.quitar && sePuedeSacar(e) ? (
                <button type="button" disabled={ocupado} onClick={() => onQuitar(lote, e)} className="text-[11px] text-gray-500 hover:text-red-700 hover:underline disabled:opacity-50">
                  Sacar del lote
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {lote.porFuera || partes === 0 ? null : (
          <button
            type="button"
            onClick={() => setVerificando(true)}
            className={cn(SECUNDARIO, "border-[#c27b3d] text-[#9a5a26] hover:bg-[#c27b3d]/10")}
            title="Pasa uno por uno los archivos que recibe el laboratorio: nombre, copias, tamaño y acabado"
          >
            Verificar lote
          </button>
        )}
        {lote.porFuera ? null : <a href={`${base}/etiqueta`} target="_blank" rel="noopener noreferrer" className={ENLACE}>Etiquetas</a>}
        <a href={`${base}/sobres`} target="_blank" rel="noopener noreferrer" className={ENLACE}>Sobres</a>
        {lote.porFuera ? null : <a href={`${base}/remito`} target="_blank" rel="noopener noreferrer" className={ENLACE}>Remito</a>}
        {Array.from({ length: lote.porFuera ? 0 : partes }, (_, i) => (
          <a key={i} href={`${base}/zip?parte=${i + 1}`} className={ENLACE}>
            {partes === 1 ? "ZIP" : `ZIP parte ${i + 1} de ${partes}`}
          </a>
        ))}
      </div>

      {acciones.enviar || acciones.deshacer || acciones.mover.length > 0 || acciones.pagadoAlLab ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2.5">
          {acciones.enviar ? (
            <button type="button" disabled={ocupado} onClick={() => onEnviar(lote)} className={PRINCIPAL}>
              Enviar al laboratorio
            </button>
          ) : null}
          {acciones.deshacer ? (
            <button type="button" disabled={ocupado} onClick={() => onDeshacer(lote)} className={SECUNDARIO}>
              Deshacer lote
            </button>
          ) : null}
          {acciones.mover.map((m) => (
            <button key={m.hacia} type="button" disabled={ocupado} onClick={() => onMover(lote, m.hacia)} className={m.principal ? PRINCIPAL : SECUNDARIO}>
              {m.texto}
            </button>
          ))}
          {acciones.pagadoAlLab ? (
            <button type="button" disabled={ocupado} onClick={() => onPagadoAlLab(lote)} className={SECUNDARIO}>
              Pagado al laboratorio
            </button>
          ) : null}
        </div>
      ) : null}

      {verificando ? (
        <VerificarLote
          titulo={lote.nombre}
          fuentes={[{ etiqueta: "ZIP", url: `${base}/verificar` }]}
          envio={envio}
          onCerrar={() => setVerificando(false)}
        />
      ) : null}
    </article>
  );
}
