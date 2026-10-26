"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FichaCompleta } from "@/lib/soporte/ficha";
import { getStatusLabel } from "@/lib/admin/helpers";
import { tituloDe, rolDe } from "@/lib/soporte/tablero-textos";
import { ACCIONES, CATEGORIAS, describirInput, fechaCorta, textoReloj } from "./textos";

type AccionSugerida = { herramienta: string; input: Record<string, unknown>; motivo: string; tildada: boolean };
type Envio = { estado: "listo" } | { estado: "enviando" } | { estado: "fallas"; fallas: { herramienta: string; mensaje: string }[] } | { estado: "error"; texto: string } | { estado: "enviado"; mailEnviado: boolean };

const ROL_ITEM: Record<string, string> = { usuario: "self-end bg-gray-900 text-white", bot: "self-start bg-gray-100 text-gray-900", equipo: "self-start border border-orange-200 bg-orange-50 text-gray-900" };

/** Ficha completa del reclamo: diagnóstico, conversación, acciones preparadas y respuesta. */
export default function FichaTicket({ ticketId, onCambio }: { ticketId: number; onCambio?: () => void }) {
  const [f, setF] = useState<FichaCompleta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [tildadas, setTildadas] = useState<boolean[]>([]);
  const [envio, setEnvio] = useState<Envio>({ estado: "listo" });
  const [rediagnosticando, setRediagnosticando] = useState(false);
  // Una clave por respuesta: los reintentos y el doble clic la reusan; se renueva después de enviar.
  const clave = useRef<string>(crypto.randomUUID());
  // La respuesta sugerida se usa una sola vez: después de enviar, el campo queda vacío (un segundo envío sería otro mail).
  const prellenada = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as FichaCompleta;
      setF(d);
      const acciones = (d.diagnostico?.acciones ?? []) as AccionSugerida[];
      setTildadas(acciones.map((a) => a.tildada));
      // Con el mail sin verificar no se prellena: la sugerencia podría mencionar pedidos de otra persona.
      if (!prellenada.current && d.diagnostico?.estado === "LISTO") {
        prellenada.current = true;
        if (!d.diagnostico.mailSinVerificar) setMensaje((m) => m || d.diagnostico?.respuestaSugerida || "");
      }
      setError(null);
    } catch {
      setError("No se pudo cargar el reclamo.");
    }
  }, [ticketId]);

  useEffect(() => {
    setF(null);
    setMensaje("");
    setEnvio({ estado: "listo" });
    clave.current = crypto.randomUUID();
    prellenada.current = false;
    void cargar();
  }, [cargar]);

  const acciones = (f?.diagnostico?.acciones ?? []) as AccionSugerida[];

  const enviar = async (conAcciones: boolean, enviarIgual = false) => {
    if (!mensaje.trim() || envio.estado === "enviando") return;
    setEnvio({ estado: "enviando" });
    const elegidas = conAcciones ? acciones.filter((_, i) => tildadas[i]).map(({ herramienta, input }) => ({ herramienta, input })) : [];
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/responder`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensaje: mensaje.trim(), acciones: elegidas, idempotencyKey: clave.current, ...(enviarIgual ? { enviarIgual: true } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setEnvio({ estado: "enviado", mailEnviado: d.mailEnviado !== false });
        clave.current = crypto.randomUUID();
        setMensaje("");
        await cargar();
        onCambio?.();
        return;
      }
      if (res.status === 409 && Array.isArray(d.fallas)) return setEnvio({ estado: "fallas", fallas: d.fallas });
      if (res.status === 409 && d.enCurso) return setEnvio({ estado: "error", texto: "Esta respuesta ya se está enviando. Esperá unos segundos y recargá." });
      setEnvio({ estado: "error", texto: "No se pudo enviar la respuesta." });
    } catch {
      setEnvio({ estado: "error", texto: "No se pudo enviar la respuesta. Revisá la conexión y probá de nuevo." });
    }
  };

  const rediagnosticar = async () => {
    setRediagnosticando(true);
    try {
      await fetch(`/api/admin/support/tickets/${ticketId}/diagnosticar`, { method: "POST", credentials: "include" });
      setMensaje("");
      prellenada.current = false;
      await cargar();
      onCambio?.();
    } finally {
      setRediagnosticando(false);
    }
  };

  if (!f) return <p className="p-6 text-center text-gray-500">{error ?? "Cargando reclamo…"}</p>;
  const d = f.diagnostico;
  const t = f.ticket;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs text-gray-500">
          #{t.id} · {t.reason} · {rolDe(t.requesterRole)} · {getStatusLabel(t.status)}
          {f.reloj && <span className={f.reloj.color === "rojo" ? " font-semibold text-red-600" : f.reloj.color === "amarillo" ? " font-semibold text-yellow-700" : " text-green-700"}> · {textoReloj(f.reloj.venceEn)}</span>}
        </p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">{tituloDe(t.description)}</h2>
        <p className="text-sm text-gray-600">{t.requesterName ?? "Sin nombre"} · {t.requesterEmail ?? "sin mail"} · {fechaCorta(new Date(t.createdAt).toISOString())}</p>
      </header>

      <section className="rounded-lg border border-gray-200 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🔎 Diagnóstico automático</h3>
          <button type="button" onClick={rediagnosticar} disabled={rediagnosticando} className="text-xs text-blue-700 underline disabled:opacity-50">
            {rediagnosticando ? "Diagnosticando…" : "Volver a diagnosticar"}
          </button>
        </div>
        {!d && <p className="text-sm text-gray-500">Todavía no hay diagnóstico.</p>}
        {d?.estado === "PENDIENTE" && <p className="text-sm text-gray-500">Diagnosticando…</p>}
        {d?.estado === "FALLO" && <p className="text-sm text-amber-700">No se pudo diagnosticar: {d.error}</p>}
        {d?.estado === "SIN_PRESUPUESTO" && <p className="text-sm text-amber-700">Sin diagnóstico: se alcanzó el tope mensual del DNX Bot.</p>}
        {d?.estado === "LISTO" && (
          <div className="space-y-2 text-sm">
            {d.mailSinVerificar && (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">⚠️ Mail sin verificar: estos pedidos podrían no ser de quien consulta.</p>
            )}
            <p className="font-medium text-gray-900">{d.categoria ? CATEGORIAS[d.categoria] ?? d.categoria : ""} · confianza {d.confianza?.toLowerCase()}</p>
            <p className="whitespace-pre-wrap text-gray-700">{d.hallazgos}</p>
            {d.mailSinVerificar && d.respuestaSugerida && (
              <details>
                <summary className="cursor-pointer text-gray-600">Ver la respuesta sugerida (revisala antes de usarla)</summary>
                <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-gray-700">{d.respuestaSugerida}</p>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">💬 Conversación</h3>
        <div className="flex flex-col gap-2">
          <p className="self-start rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"><span className="font-semibold">Consulta:</span> {t.description}</p>
          {f.historia.map((i, n) => (
            <div key={n} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${ROL_ITEM[i.rol]}`}>
              {i.rol === "equipo" && <p className="mb-1 text-[11px] font-bold text-orange-800">{i.autor}</p>}
              {i.rol === "bot" && <p className="mb-1 text-[11px] font-bold text-gray-500">DNX Bot</p>}
              {i.texto}
            </div>
          ))}
        </div>
        {f.notas.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-gray-600">Notas internas ({f.notas.length})</summary>
            {f.notas.map((n, i) => (
              <p key={i} className="mt-2 whitespace-pre-wrap rounded bg-yellow-50 p-2 text-gray-700"><span className="font-semibold">{n.autor ?? "Nota"}:</span> {n.texto}</p>
            ))}
          </details>
        )}
        {f.acciones.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-gray-600">
            {f.acciones.map((a, i) => (
              <li key={i}>{a.status === "EXECUTED" ? "✅" : "❌"} {ACCIONES[a.toolName] ?? a.toolName} · {fechaCorta(a.fecha)}{a.resultMessage ? ` · ${a.resultMessage}` : ""}</li>
            ))}
          </ul>
        )}
      </section>

      {t.status !== "CLOSED" && (
        <section className="rounded-lg border border-gray-200 p-3">
          {acciones.length > 0 && (
            <div className="mb-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">⚡ Acciones preparadas</h3>
              {acciones.map((a, i) => (
                <label key={i} className="flex items-start gap-2 py-1 text-sm text-gray-800">
                  <input type="checkbox" className="mt-1" checked={tildadas[i] ?? false} onChange={(e) => setTildadas((xs) => xs.map((x, j) => (j === i ? e.target.checked : x)))} />
                  <span>
                    {ACCIONES[a.herramienta] ?? a.herramienta}
                    {describirInput(a.input) && <span className="block text-xs font-medium text-gray-700">{describirInput(a.input)}</span>}
                    <span className="block text-xs text-gray-500">{a.motivo}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">✉️ Respuesta (le llega por mail)</h3>
          {d?.estado === "LISTO" && d.mailSinVerificar && (
            <p className="mb-2 text-xs text-amber-800">No se prellenó la respuesta sugerida porque el mail no está verificado. Revisala en el diagnóstico antes de usarla.</p>
          )}
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Escribí la respuesta…" />
          <div className="mt-2 flex flex-wrap gap-2">
            {acciones.length > 0 && (
              <button type="button" onClick={() => enviar(true)} disabled={!mensaje.trim() || envio.estado === "enviando"} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Enviar y aplicar acciones
              </button>
            )}
            <button type="button" onClick={() => enviar(false)} disabled={!mensaje.trim() || envio.estado === "enviando"} className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${acciones.length > 0 ? "border border-gray-300 text-gray-800" : "bg-gray-900 text-white"}`}>
              {acciones.length > 0 ? "Solo enviar respuesta" : "Enviar respuesta"}
            </button>
          </div>
          {envio.estado === "enviando" && <p className="mt-2 text-sm text-gray-500">Enviando…</p>}
          {envio.estado === "enviado" && envio.mailEnviado && <p className="mt-2 text-sm text-green-700">Respuesta enviada. La ficha pasó a «Esperando al cliente».</p>}
          {envio.estado === "enviado" && !envio.mailEnviado && (
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">La respuesta quedó guardada en el reclamo, pero el mail no salió. La persona no la recibió: revisá su mail o contactala por otro medio.</p>
          )}
          {envio.estado === "error" && <p className="mt-2 text-sm text-red-600">{envio.texto}</p>}
          {envio.estado === "fallas" && (
            <div className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">
              <p className="font-semibold">No se envió nada: falló una acción.</p>
              <ul className="list-disc pl-5">{envio.fallas.map((x, i) => <li key={i}>{ACCIONES[x.herramienta] ?? x.herramienta}: {x.mensaje}</li>)}</ul>
              <button type="button" onClick={() => enviar(false, true)} className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1 font-semibold">Enviar igual (sin acciones)</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
