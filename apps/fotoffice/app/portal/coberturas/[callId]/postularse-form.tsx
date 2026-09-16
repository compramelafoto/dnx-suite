"use client";

import { useActionState } from "react";
import { postularseAction, type PostularseState } from "@/app/actions/coverage-portal";

const inicial: PostularseState = { error: null, ok: null };

/**
 * El botón de anotarse a un rol, con su mensaje opcional.
 *
 * Un formulario por rol: cada instancia de este componente lleva su propio estado de
 * `useActionState`, así que anotarse a un rol no deshabilita el botón de otro en la misma
 * pantalla.
 *
 * El botón queda deshabilitado mientras se envía — no solo por prolijidad: en el teléfono, con
 * la conexión de un evento cualquiera, un segundo toque antes de que vuelva la respuesta es un
 * caso real, y generaría una segunda postulación si el botón siguiera activo (el servidor la
 * frena igual, ver `coverage-portal.ts`, pero evitarla acá evita el mensaje de error de más).
 */
export function PostularseForm({ callId, roleId }: { callId: string; roleId: string }) {
  const [state, action, enviando] = useActionState(postularseAction, inicial);

  if (state.ok) {
    return <p className="text-sm font-medium text-[var(--fo-success)]">{state.ok}</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="callId" value={callId} />
      <input type="hidden" name="roleId" value={roleId} />
      <label className="fo-field-stack">
        <span className="fo-label">Contanos por qué querés participar (opcional)</span>
        <textarea name="message" rows={2} className="fo-input" disabled={enviando} />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="fo-btn fo-btn-primary min-h-11 w-full sm:w-auto"
        disabled={enviando}
      >
        {enviando ? "Enviando…" : "Quiero participar"}
      </button>
    </form>
  );
}
