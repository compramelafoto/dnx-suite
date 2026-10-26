"use client";

import type { Ficha } from "@/lib/soporte/tablero";
import { fechaCorta, textoReloj } from "./textos";

const BORDE: Record<string, string> = { verde: "border-l-green-500", amarillo: "border-l-yellow-500", rojo: "border-l-red-500" };
const RELOJ: Record<string, string> = { verde: "text-green-700", amarillo: "text-yellow-700", rojo: "text-red-600" };

export default function FichaResumida({ ficha, seleccionada, onAbrir }: { ficha: Ficha; seleccionada?: boolean; onAbrir: () => void }) {
  const color = ficha.reloj?.color;
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`w-full rounded-lg border border-gray-200 border-l-4 bg-white p-2.5 text-left shadow-sm transition hover:shadow ${color ? BORDE[color] : "border-l-gray-300"} ${seleccionada ? "ring-2 ring-blue-500" : ""} ${ficha.status === "RESOLVED" || ficha.status === "CLOSED" ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>#{ficha.id} · {ficha.reason}</span>
        {ficha.reloj ? <span className={`font-semibold ${RELOJ[ficha.reloj.color]}`}>{textoReloj(ficha.reloj.venceEn)}</span> : <span>{fechaCorta(ficha.fecha)}</span>}
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-900">{ficha.titulo}</p>
      {ficha.resumen && <p className="mt-1 text-xs text-gray-600">🔎 {ficha.resumen}</p>}
      {!ficha.resumen && ficha.diagnostico === "PENDIENTE" && <p className="mt-1 text-xs text-gray-400">Diagnosticando…</p>}
      {(ficha.diagnostico === "FALLO" || ficha.diagnostico === "SIN_PRESUPUESTO") && <p className="mt-1 text-xs text-amber-700">Sin diagnóstico automático</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${ficha.rol === "Fotógrafo" ? "bg-pink-100 text-pink-800" : "bg-indigo-100 text-indigo-800"}`}>{ficha.rol}</span>
        {ficha.vieneDelBot && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">DNX Bot</span>}
        {ficha.clienteRespondio && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-800">El cliente respondió</span>}
        {ficha.clienteEscribio && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">El cliente escribió</span>}
        {ficha.mailSinVerificar && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">Mail sin verificar</span>}
      </div>
    </button>
  );
}
