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
export function CajaDeRespuesta({ chatId, dentroDeVentana }: { chatId: string; dentroDeVentana: boolean }) {
  const router = useRouter();
  const idTexto = useId();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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
    setError(null);
    setAviso(null);
    try {
      const r = await responderAction(chatId, limpio, token);
      if (r.ok) {
        envioEnCurso.current = null;
        setTexto("");
        setAviso(r.aviso ?? (r.estadoEnvio === "SIMULADO" ? "Mensaje registrado (modo de prueba: no salió a WhatsApp)." : "Mensaje enviado."));
        router.refresh();
      } else {
        // El servidor contestó que no: el próximo intento es un envío nuevo.
        envioEnCurso.current = null;
        setError(r.error);
      }
    } catch {
      // Sin respuesta: puede haber salido. Se conserva el identificador para reintentar sin duplicar.
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
