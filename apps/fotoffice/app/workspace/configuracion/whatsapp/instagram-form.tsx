"use client";

import { useActionState } from "react";
import { conectarInstagramAction, desconectarInstagramAction, type EstadoWhatsappConfig } from "./actions";

const INICIAL: EstadoWhatsappConfig = { error: null };

function Mensaje({ estado }: { estado: EstadoWhatsappConfig }) {
  if (estado.error) return <p role="alert" className="text-sm text-[var(--fo-danger)]">{estado.error}</p>;
  if (estado.ok) return <p role="status" className="text-sm text-[var(--fo-success)]">{estado.ok}</p>;
  return null;
}

/**
 * Configuración → WhatsApp → Instagram: estado, la cuenta y el token del usuario del sistema para
 * conectar. El token nunca vuelve a la pantalla: el campo siempre arranca vacío.
 */
export function InstagramForm({ conectado, usuario }: { conectado: boolean; usuario: string | null }) {
  const [estado, conectar, conectando] = useActionState(conectarInstagramAction, INICIAL);
  const [estadoDesconectar, desconectar, desconectando] = useActionState(desconectarInstagramAction, INICIAL);
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="ig-titulo">
      <div className="space-y-1">
        <h2 id="ig-titulo" className="text-base font-semibold">Instagram</h2>
        <p className={`text-sm ${conectado ? "text-[var(--fo-success)]" : "text-[var(--fo-muted)]"}`}>
          {conectado ? `Conectado${usuario ? ` · @${usuario}` : ""}` : "No conectado"}
        </p>
        <p className="text-sm text-[var(--fo-muted)]">
          Los mensajes directos de Instagram entran a la Bandeja y el bot los contesta igual que en WhatsApp.
          Hasta que Meta apruebe la app, sólo llegan al bot las personas que tienen un rol en la app de Meta.
        </p>
      </div>
      <form action={conectar} className="space-y-3">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ig-token">Token del usuario del sistema</label>
          <input id="ig-token" name="token" type="password" required autoComplete="new-password" className="fo-input" />
          <p className="text-xs text-[var(--fo-muted)]">
            FOTOFFICE busca la página de Facebook que tiene vinculado el Instagram, la suscribe a los mensajes y guarda el token de la página. Por seguridad nunca se muestra.
          </p>
        </div>
        <Mensaje estado={estado} />
        <button type="submit" disabled={conectando} className="fo-btn fo-btn-primary">{conectando ? "Conectando…" : "Conectar Instagram"}</button>
      </form>
      {conectado ? (
        <form
          action={desconectar}
          onSubmit={(e) => {
            if (!window.confirm("¿Desconectar Instagram? Los mensajes directos dejan de entrar a la Bandeja y no se puede contestar desde acá.")) e.preventDefault();
          }}
          className="space-y-2"
        >
          <Mensaje estado={estadoDesconectar} />
          <button type="submit" disabled={desconectando} className="fo-btn fo-btn-secondary">{desconectando ? "Desconectando…" : "Desconectar"}</button>
        </form>
      ) : null}
    </section>
  );
}
