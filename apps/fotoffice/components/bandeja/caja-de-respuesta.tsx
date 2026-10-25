"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { responderAction } from "@/app/actions/bandeja";

const MAXIMO = 4096;
const AVISO_FUERA_DE_VENTANA =
  "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp sólo permite responder con una plantilla aprobada.";

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
}: {
  chatId: string;
  dentroDeVentana: boolean;
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

  const vacio = texto.trim().length === 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
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

  if (!dentroDeVentana) {
    return (
      <p role="status" className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] px-3 py-2 text-sm text-[var(--fo-warning)]">
        {AVISO_FUERA_DE_VENTANA}
      </p>
    );
  }
  return (
    <form onSubmit={enviar} className="space-y-2">
      {provisorio && provisorio.idBase === ultimoMensajeId ? (
        <div className="flex justify-end" role="status">
          <div className="max-w-[85%] min-w-0 rounded-[var(--fo-radius)] border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--fo-text)]">{provisorio.texto}</p>
            <p className="mt-1 text-right text-[11px] text-[var(--fo-muted)]">enviando</p>
          </div>
        </div>
      ) : null}
      <label htmlFor={idTexto} className="fo-label">
        Respuesta
      </label>
      <textarea
        id={idTexto}
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        maxLength={MAXIMO}
        rows={3}
        className="fo-input"
        disabled={enviando}
        placeholder="Escribí tu respuesta"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--fo-muted)]" aria-live="off">
          {texto.length}/{MAXIMO}
        </span>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando || vacio}>
          {enviando ? "Enviando…" : "Enviar"}
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
