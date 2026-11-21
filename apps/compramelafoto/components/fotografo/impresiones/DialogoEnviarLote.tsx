"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { laboratorioParaEnviar, type LaboratorioDelPanel, type LoteDelPanel } from "@/lib/print-batches/panel";
import type { EntregaLote } from "@/lib/print-batches/reglas";

export type DatosDeEnvio = {
  labContactId: number;
  mensaje: string;
  entregaPreferida: EntregaLote;
  fechaPrometida: string;
};

type Props = {
  lote: LoteDelPanel;
  laboratorios: LaboratorioDelPanel[];
  enviando: boolean;
  error: string | null;
  onCancelar: () => void;
  onEnviar: (datos: DatosDeEnvio) => void;
};

const CAMPO =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#c27b3d] disabled:bg-gray-100";

export default function DialogoEnviarLote({ lote, laboratorios, enviando, error, onCancelar, onEnviar }: Props) {
  const inicial = laboratorioParaEnviar(lote, laboratorios);
  const [labId, setLabId] = useState<number | null>(inicial.elegido);
  const [mensaje, setMensaje] = useState(lote.mensajeAlLab ?? "");
  const [entrega, setEntrega] = useState<EntregaLote>(lote.entregaPreferida);
  const [fecha, setFecha] = useState(lote.fechaPrometida?.slice(0, 10) ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !enviando) onCancelar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enviando, onCancelar]);

  const sinLaboratorios = laboratorios.length === 0;
  const fijoNoActivo = inicial.bloqueado && !laboratorios.some((l) => l.id === inicial.elegido);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (labId == null) return;
    onEnviar({ labContactId: labId, mensaje, entregaPreferida: entrega, fechaPrometida: fecha });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="enviar-lote-titulo">
      <button type="button" aria-label="Cerrar" onClick={() => !enviando && onCancelar()} className="absolute inset-0 bg-black/40" />
      <form onSubmit={enviar} className="relative w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-2xl">
        <div>
          <h2 id="enviar-lote-titulo" className="text-base font-semibold text-gray-900">
            Enviar el {lote.nombre} al laboratorio
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Le llega un correo con el enlace para ver los pedidos y bajar las fotos.
          </p>
        </div>

        {sinLaboratorios ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Todavía no cargaste laboratorios.{" "}
            <Link href="/fotografo/impresiones/laboratorios" className="font-medium underline">
              Cargá uno en «Mis laboratorios»
            </Link>
            .
          </p>
        ) : (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-700">Laboratorio</span>
            <select
              className={CAMPO}
              value={labId ?? ""}
              disabled={inicial.bloqueado || enviando}
              onChange={(e) => setLabId(e.target.value ? Number(e.target.value) : null)}
            >
              {labId == null ? <option value="">Elegí un laboratorio</option> : null}
              {laboratorios.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                  {l.esPredeterminado ? " (predeterminado)" : ""}
                </option>
              ))}
            </select>
            {inicial.bloqueado ? (
              <span className="block text-[11px] text-gray-500">
                {fijoNoActivo
                  ? "Hay pedidos que se retiran en un laboratorio que ya no está en tu lista: volvé a cargarlo en «Mis laboratorios»."
                  : "Hay pedidos que el cliente retira en este laboratorio: el lote va a ése."}
              </span>
            ) : null}
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-700">Mensaje para el laboratorio (opcional)</span>
          <textarea className={CAMPO} rows={3} maxLength={2000} value={mensaje} disabled={enviando} onChange={(e) => setMensaje(e.target.value)} />
        </label>

        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-gray-700">¿Cómo te lo entregan?</legend>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="radio" name="entrega" checked={entrega === "RETIRA_FOTOGRAFO"} disabled={enviando} onChange={() => setEntrega("RETIRA_FOTOGRAFO")} />
            Lo retiro yo
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="radio" name="entrega" checked={entrega === "ENVIA_LAB"} disabled={enviando} onChange={() => setEntrega("ENVIA_LAB")} />
            Me lo envía el laboratorio
          </label>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-700">Fecha prometida (opcional)</span>
          <input type="date" className={CAMPO} value={fecha} disabled={enviando} onChange={(e) => setFecha(e.target.value)} />
        </label>

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} disabled={enviando} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || labId == null || sinLaboratorios || fijoNoActivo}
            className="rounded-lg bg-[#c27b3d] px-3 py-2 text-sm font-semibold text-white hover:bg-[#b06a2f] disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
