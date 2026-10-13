"use client";

import { useActionState } from "react";
import { conectarAlboomAction } from "./actions";
import { ESTADO_INICIAL } from "./estado";
import { MensajeAlboom } from "./mensaje";

/**
 * Subdominio, usuario y contraseña del panel de Alboom. La contraseña viaja una sola vez al servidor, que prueba el
 * inicio de sesión y la guarda cifrada; nunca vuelve a la pantalla.
 */
export function ConexionForm({ subdomainInicial, usuarioInicial, reconectar }: { subdomainInicial: string; usuarioInicial: string; reconectar: boolean }) {
  const [estado, enviar, pendiente] = useActionState(conectarAlboomAction, ESTADO_INICIAL);
  return (
    <form action={enviar} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="alboom-subdomain">
            Subdominio
          </label>
          <input
            id="alboom-subdomain"
            name="subdomain"
            defaultValue={subdomainInicial}
            required
            maxLength={200}
            autoComplete="off"
            className="fo-input"
            placeholder="tuestudio"
          />
          <p className="text-xs text-[var(--fo-muted)]">Lo que va antes de .alboomcrm.com.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="alboom-username">
            Usuario (correo)
          </label>
          <input id="alboom-username" name="username" type="email" defaultValue={usuarioInicial} required maxLength={200} autoComplete="off" className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="alboom-password">
            Contraseña
          </label>
          <input id="alboom-password" name="password" type="password" required maxLength={200} autoComplete="new-password" className="fo-input" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Probando…" : reconectar ? "Volver a conectar" : "Conectar"}
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    </form>
  );
}
