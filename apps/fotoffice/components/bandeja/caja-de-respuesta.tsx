"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { agregarNotaAction, responderAction } from "@/app/actions/bandeja";
import { aplicarVariables, filtrarRespuestas, type RespuestaRapida } from "@/lib/bandeja/respuestas-rapidas-puro";

const MAXIMO = 4096;
const AVISO_FUERA_DE_VENTANA =
  "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp sólo permite responder con una plantilla aprobada.";
const AVISO_FUERA_DE_VENTANA_INSTAGRAM =
  "Pasaron más de 24 horas desde el último mensaje del cliente: Instagram no deja responder hasta que vuelva a escribir.";

/**
 * Caja de respuesta. Genera un identificador por envío (`crypto.randomUUID()`) para que un
 * reintento tras un corte de red no mande el mensaje dos veces: si la llamada falla sin respuesta
 * del servidor se reutiliza el mismo identificador con el mismo texto. Mientras se envía, el botón
 * queda deshabilitado. Fuera de la ventana de 24 h no se puede escribir.
 */
export function CajaDeRespuesta({
  chatId,
  dentroDeVentana,
  ultimoMensajeId,
  canal = "WHATSAPP",
  respuestas = [],
  nombreCliente = null,
}: {
  /** Respuestas rápidas del workspace: «/» al principio o el botón ⚡ las abren; elegir inserta el texto. */
  respuestas?: RespuestaRapida[];
  /** Para `{nombre}` en las respuestas rápidas. */
  nombreCliente?: string | null;
  chatId: string;
  dentroDeVentana: boolean;
  /** Sólo cambia el aviso fuera de la ventana: Instagram no tiene plantillas. */
  canal?: "WHATSAPP" | "INSTAGRAM";
  /** Id del último mensaje que muestra la conversación: cuando cambia, el servidor ya trajo el nuestro. */
  ultimoMensajeId: string | null;
}) {
  const router = useRouter();
  const idTexto = useId();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Burbuja provisoria con lo recién enviado. Se muestra mientras la conversación siga con el mismo
  // último mensaje; cuando el refresco trae el mensaje real (el id cambia) deja de mostrarse, así
  // nunca queda duplicado.
  const [provisorio, setProvisorio] = useState<{ texto: string; idBase: string | null } | null>(null);
  const envioEnCurso = useRef<{ token: string; texto: string } | null>(null);

  const [modo, setModo] = useState<"responder" | "nota">("responder");
  const [rapidasAbiertas, setRapidasAbiertas] = useState(false);
  // «/algo» al principio (sin espacios) filtra la lista; el botón ⚡ la abre completa.
  const porBarra = /^\/[^\s]*$/.test(texto);
  const visibles = respuestas.length > 0 && (porBarra || rapidasAbiertas) ? filtrarRespuestas(respuestas, porBarra ? texto.slice(1) : "").slice(0, 8) : [];
  function elegirRapida(r: RespuestaRapida) {
    setTexto(aplicarVariables(r.texto, { nombre: nombreCliente }));
    setRapidasAbiertas(false);
  }
  const vacio = texto.trim().length === 0;
  const nota = modo === "nota";

  async function guardarNota() {
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await agregarNotaAction(chatId, texto.trim());
      if (r.ok) {
        setTexto("");
        setAviso("Nota guardada. Sólo la ve el equipo.");
        router.refresh();
      } else setError(r.error);
    } catch {
      setError("No se pudo guardar la nota. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (nota) {
      if (!enviando && !vacio) await guardarNota();
      return;
    }
    if (enviando || vacio || !dentroDeVentana) return;
    const limpio = texto.trim();
    // Mismo texto tras un corte de red: mismo identificador. Texto distinto: identificador nuevo.
    if (!envioEnCurso.current || envioEnCurso.current.texto !== limpio) {
      envioEnCurso.current = { token: crypto.randomUUID(), texto: limpio };
    }
    const { token } = envioEnCurso.current;
    setEnviando(true);
    setProvisorio({ texto: limpio, idBase: ultimoMensajeId });
    setError(null);
    setAviso(null);
    try {
      const r = await responderAction(chatId, limpio, token);
      if (r.ok) {
        envioEnCurso.current = null;
        setTexto("");
        // Por si el refresco no llegara a traer el mensaje, la burbuja provisoria no queda para siempre.
        window.setTimeout(() => setProvisorio(null), 20_000);
        setAviso(r.aviso ?? (r.estadoEnvio === "SIMULADO" ? "Mensaje registrado (modo de prueba: no salió a WhatsApp)." : "Mensaje enviado."));
        router.refresh();
      } else {
        // El servidor contestó que no: el próximo intento es un envío nuevo.
        envioEnCurso.current = null;
        setProvisorio(null);
        setError(r.error);
      }
    } catch {
      // Sin respuesta: puede haber salido. Se conserva el identificador para reintentar sin duplicar.
      setProvisorio(null);
      setError("No pudimos confirmar el envío. Revisá la conversación antes de reintentar.");
    } finally {
      setEnviando(false);
    }
  }

  const pestana = (valor: "responder" | "nota", etiqueta: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={modo === valor}
      onClick={() => {
        setModo(valor);
        setError(null);
        setAviso(null);
      }}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        modo === valor
          ? valor === "nota"
            ? "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]"
            : "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]"
          : "text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
      }`}
    >
      {etiqueta}
    </button>
  );
  const pestanas = (
    <div role="tablist" aria-label="Qué escribir" className="flex gap-1">
      {pestana("responder", "Responder")}
      {pestana("nota", "Nota interna")}
    </div>
  );

  if (!dentroDeVentana && !nota) {
    return (
      <div className="space-y-2">
        {pestanas}
        <p role="status" className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] px-3 py-2 text-sm text-[var(--fo-warning)]">
          {canal === "INSTAGRAM" ? AVISO_FUERA_DE_VENTANA_INSTAGRAM : AVISO_FUERA_DE_VENTANA}
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} className="space-y-2">
      {pestanas}
      {provisorio && provisorio.idBase === ultimoMensajeId ? (
        <div className="flex justify-end" role="status">
          <div className="max-w-[85%] min-w-0 rounded-[var(--fo-radius)] border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--fo-text)]">{provisorio.texto}</p>
            <p className="mt-1 text-right text-[11px] text-[var(--fo-muted)]">enviando</p>
          </div>
        </div>
      ) : null}
      {visibles.length > 0 ? (
        <ul role="listbox" aria-label="Respuestas rápidas" className="max-h-56 overflow-y-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-1 shadow-sm">
          {visibles.map((r) => (
            <li key={r.id}>
              <button type="button" role="option" aria-selected={false} className="block w-full rounded-[var(--fo-radius-sm)] px-3 py-1.5 text-left hover:bg-[var(--fo-surface-hover)]" onClick={() => elegirRapida(r)}>
                <span className="text-sm font-medium">
                  <span className="text-[var(--fo-accent-hover)]">/{r.atajo}</span> · {r.titulo}
                </span>
                <span className="block truncate text-xs text-[var(--fo-muted)]">{r.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : porBarra && respuestas.length > 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">No hay respuestas rápidas con ese atajo.</p>
      ) : null}
      <label htmlFor={idTexto} className="sr-only">
        {nota ? "Nota interna" : "Respuesta"}
      </label>
      <textarea
        id={idTexto}
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        maxLength={MAXIMO}
        rows={3}
        className={`fo-input ${nota ? "!border-[var(--fo-warning-border)] !bg-[var(--fo-warning-soft)]" : ""}`}
        disabled={enviando}
        placeholder={nota ? "Sólo la ve el equipo: no le llega al cliente ni la lee el bot" : "Escribí tu respuesta"}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-3 text-xs text-[var(--fo-muted)]" aria-live="off">
          {respuestas.length > 0 ? (
            <button type="button" className="rounded-full px-2 py-0.5 hover:bg-[var(--fo-surface-hover)]" aria-expanded={rapidasAbiertas} onClick={() => setRapidasAbiertas((v) => !v)} title="Respuestas rápidas (o escribí /)">
              ⚡ Respuestas rápidas
            </button>
          ) : null}
          {texto.length}/{MAXIMO}
        </span>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando || vacio}>
          {nota ? (enviando ? "Guardando…" : "Guardar nota") : enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm text-[var(--fo-text-secondary)]">
          {aviso}
        </p>
      ) : null}
    </form>
  );
}
