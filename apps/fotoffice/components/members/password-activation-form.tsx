"use client";

import { useActionState } from "react";
import {
  startPasswordActivationAction,
  type ActivationState,
} from "@/app/actions/member-activation";

const INITIAL: ActivationState = { status: "IDLE", message: "" };

/**
 * Segunda vía de activación, para quien no usa Google.
 *
 * No pide ni muestra contraseñas: dispara el email de "crear contraseña" del sistema de
 * identidad que ya existe. El token de la invitación viaja como campo del formulario y se
 * revalida entero en el servidor.
 */
export function PasswordActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(startPasswordActivationAction, INITIAL);

  if (state.status === "PASSWORD_EMAIL_SENT") {
    return (
      <p role="status" className="text-sm text-[var(--fo-success,#047857)] leading-relaxed">
        {state.message}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pending}>
          {pending ? "Enviando…" : "Crear acceso con contraseña"}
        </button>
      </form>
      {state.message ? (
        <p role="status" className="text-xs text-[var(--fo-danger,#b91c1c)] leading-relaxed">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
