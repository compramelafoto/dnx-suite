"use client";

import { cn } from "@/lib/utils";
import { partesDelLote } from "@/lib/print-batches/partes-del-lote";
import {
  accionesDelLote,
  fechaDelPanel,
  textoDeCopiasDelPanel,
  textoDelEstadoDelLote,
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
  onQuitar: (lote: LoteDelPanel, entradaId: number, motivo: "SACAR" | "REIMPRIMIR") => void;
};

const BOTON = "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const SECUNDARIO = cn(BOTON, "border-gray-200 bg-white text-gray-700 hover:bg-gray-50");
const PRINCIPAL = cn(BOTON, "border-[#c27b3d] bg-[#c27b3d] text-white hover:bg-[#b06a2f]");
const ENLACE = "text-xs font-medium text-[#c27b3d] hover:underline";

const COLOR_DEL_ESTADO: Partial<Record<EstadoLote, string>> = {
  ARMADO: "bg-gray-100 text-gray-700",
  ENVIADO: "bg-sky-50 text-sky-800",
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
  const enviado = lote.estado !== "ARMADO";

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
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", COLOR_DEL_ESTADO[lote.estado] ?? "bg-gray-100 text-gray-700")}>
            {textoDelEstadoDelLote(lote.estado)}
          </span>
        </div>
        <p className="text-xs text-gray-600">
          {lote.entradas.length} {lote.entradas.length === 1 ? "pedido" : "pedidos"} · {totalCopias} {totalCopias === 1 ? "copia" : "copias"}
          {lote.enviadoAt ? ` · Enviado ${fechaDelPanel(lote.enviadoAt)}` : ""}
          {lote.fechaPrometida ? ` · Prometido ${fechaDelPanel(lote.fechaPrometida)}` : ""}
        </p>
        {enviado && lote.estado !== "CERRADO" ? (
          <p className="text-xs text-gray-500">
            {lote.labAbrioAt ? "abrió ✓" : "todavía no abrió"} · {lote.labDescargoAt ? "descargó ✓" : "todavía no descargó"}
            {lote.entregaPreferida === "ENVIA_LAB" ? " · te lo envían" : " · lo retirás vos"}
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
              {acciones.quitar && !e.entregadoAt ? (
                <button type="button" disabled={ocupado} onClick={() => onQuitar(lote, e.id, acciones.quitar!)} className="text-[11px] text-gray-500 hover:text-red-700 hover:underline disabled:opacity-50">
                  {acciones.quitar === "SACAR" ? "Sacar" : "Reimprimir"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a href={`${base}/etiqueta`} target="_blank" rel="noopener noreferrer" className={ENLACE}>Etiquetas</a>
        <a href={`${base}/sobres`} target="_blank" rel="noopener noreferrer" className={ENLACE}>Sobres</a>
        <a href={`${base}/remito`} target="_blank" rel="noopener noreferrer" className={ENLACE}>Remito</a>
        {Array.from({ length: partes }, (_, i) => (
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
    </article>
  );
}
