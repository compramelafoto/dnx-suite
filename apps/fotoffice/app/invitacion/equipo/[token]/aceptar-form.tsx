"use client";

import { useActionState } from "react";
import {
  acceptTeamInvitationAction,
  startTeamActivationAction,
  type AceptarEquipoState,
  type ActivacionEquipoState,
} from "./actions";

const INICIAL_ACEPTAR: AceptarEquipoState = { error: null };
const INICIAL_ACTIVAR: ActivacionEquipoState = { error: null };

export function AceptarForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(acceptTeamInvitationAction, INICIAL_ACEPTAR);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
        {pending ? "Entrando…" : "Aceptar y entrar"}
      </button>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
    </form>
  );
}

/** "Es mi primera vez": no pide contraseña acá; manda el correo para crearla. */
export function PrimeraVezForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(startTeamActivationAction, INICIAL_ACTIVAR);

  if (state.sent) {
    return (
      <p role="status" className="text-sm text-[var(--fo-success,#047857)] leading-relaxed">
        Te mandamos un correo para que crees tu contraseña. Cuando la tengas, iniciá sesión y
        volvés acá para terminar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pending}>
          {pending ? "Enviando…" : "Es mi primera vez"}
        </button>
      </form>
      {state.error ? (
        <p role="status" className="text-xs text-[var(--fo-danger,#b91c1c)] leading-relaxed">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
