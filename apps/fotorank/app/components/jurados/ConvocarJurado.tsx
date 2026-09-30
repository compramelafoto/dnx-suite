"use client";

import { useActionState } from "react";
import { convocarJuradoAction, type EstadoDeConvocatoria } from "../../actions/convocarJurado";
import { inputBase } from "../ui/form";

/**
 * Convocar a alguien a sumarse como jurado, sin un concurso de por medio.
 * Le llega un correo con el enlace para postularse.
 */
export function ConvocarJurado() {
  const [estado, accion, pendiente] = useActionState<EstadoDeConvocatoria | undefined, FormData>(
    convocarJuradoAction,
    undefined,
  );

  return (
    <details id="convocar" className="fr-recuadro border border-fr-border bg-fr-card">
      <summary className="cursor-pointer text-sm font-semibold text-fr-primary">
        ¿No encontrás a quien buscás? Invitalo a sumarse como jurado
      </summary>
      <p className="mt-3 text-sm text-fr-muted">
        Le llega un correo de FotoRank con el enlace para postularse. Cuando FotoRank apruebe su
        ficha, va a aparecer en este directorio y lo vas a poder invitar a tu concurso.
      </p>
      <form action={accion} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs text-fr-muted">Correo *</span>
          <input name="email" type="email" required className={inputBase} placeholder="nombre@correo.com" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-fr-muted">Nombre (para el saludo)</span>
          <input name="nombre" className={inputBase} maxLength={80} />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs text-fr-muted">Mensaje personal (opcional)</span>
          <textarea name="mensaje" rows={3} maxLength={600} className={inputBase} />
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <button type="submit" className="fr-btn fr-btn-primary" disabled={pendiente}>
            {pendiente ? "Enviando…" : "Enviar convocatoria"}
          </button>
          {estado?.mensaje ? (
            <p className={`text-sm ${estado.ok ? "text-emerald-300" : "text-amber-300"}`} role="status">
              {estado.mensaje}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
