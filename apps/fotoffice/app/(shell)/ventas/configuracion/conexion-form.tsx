"use client";

import { useActionState, useTransition, useState } from "react";
import { desconectarAlboomAction, guardarConexionAction, type PanelState } from "../actions";
import { EstadoPanel } from "../estado-panel";

const inicial: PanelState = { error: null, ok: null };

/**
 * El formulario de la conexión. La contraseña nunca se precarga ni vuelve en el estado: si ya
 * hay una guardada, el campo queda vacío con "(guardada)" y, vacío, la acción conserva la de antes.
 */
export function ConexionForm({
  subdomain,
  usuario,
  hayContrasenia,
}: {
  subdomain: string;
  usuario: string;
  hayContrasenia: boolean;
}) {
  const [state, action, guardando] = useActionState(guardarConexionAction, inicial);
  const [desconexion, setDesconexion] = useState<PanelState>(inicial);
  const [desconectando, startTransition] = useTransition();

  function desconectar() {
    if (!window.confirm("¿Desconectar Alboom? El asistente deja de leer oportunidades nuevas.")) return;
    startTransition(async () => {
      setDesconexion(await desconectarAlboomAction());
    });
  }

  return (
    <form action={action} className="space-y-4">
      <label className="fo-field-stack">
        <span className="fo-label">Subdominio</span>
        <input
          name="subdomain"
          defaultValue={subdomain}
          placeholder="dnxfotografia"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="fo-input"
        />
        <span className="fo-helper">Lo que va antes de .alboomcrm.com en la dirección de tu panel.</span>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Usuario</span>
        <input
          name="username"
          type="email"
          defaultValue={usuario}
          autoComplete="off"
          required
          className="fo-input"
        />
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={hayContrasenia ? "(guardada)" : ""}
          required={!hayContrasenia}
          className="fo-input"
        />
        {hayContrasenia ? (
          <span className="fo-helper">Dejala vacía para seguir usando la que ya está guardada.</span>
        ) : null}
      </label>

      <EstadoPanel state={state} />
      <EstadoPanel state={desconexion} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={guardando}>
          {guardando ? "Probando…" : "Probar y guardar"}
        </button>
        {hayContrasenia ? (
          <button
            type="button"
            className="fo-btn fo-btn-danger-outline min-h-11"
            onClick={desconectar}
            disabled={desconectando}
          >
            {desconectando ? "Desconectando…" : "Desconectar"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
