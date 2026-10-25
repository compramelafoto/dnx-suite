"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { enviarFotoCarnetPorMailAction } from "@/app/(shell)/ventas/impresion/actions";

/** Le manda al cliente la foto carnet armada (sola, sin plancha). Arranca con el mail de su ficha, si tiene. */
export function EnviarPorMail({ preparacionId, emailInicial }: { preparacionId: string; emailInicial: string | null }) {
  const [email, setEmail] = useState(emailInicial ?? "");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: true; a: string } | { ok: false; error: string } | null>(null);

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await enviarFotoCarnetPorMailAction(preparacionId, email);
      setResultado(r.ok ? { ok: true, a: email.trim() } : r);
    } catch {
      setResultado({ ok: false, error: "No se pudo enviar el mail. Probá de nuevo." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="fo-label">Enviar por mail al cliente</span>
        <div className="flex gap-2">
          <input
            type="email"
            className="fo-input min-w-0 flex-1"
            placeholder="cliente@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="button" className="fo-btn fo-btn-secondary shrink-0" disabled={enviando || email.trim() === ""} onClick={() => void enviar()}>
            <Mail className="size-4" aria-hidden />
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </label>
      {resultado?.ok ? <p className="fo-alert-success">Foto enviada a {resultado.a}.</p> : null}
      {resultado && !resultado.ok ? <p className="fo-alert-error">{resultado.error}</p> : null}
    </div>
  );
}
