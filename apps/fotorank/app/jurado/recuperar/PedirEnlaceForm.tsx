"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  pedirEnlaceDeResetAction,
  type EstadoDelPedido,
} from "../../actions/judgePasswordReset";
import { FormField, inputAuth } from "../../components/ui/form";

const INICIAL: EstadoDelPedido = { info: null, error: null };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
      data-testid="judge-reset-request-submit"
    >
      {pending ? "Enviando…" : "Enviarme el enlace"}
    </button>
  );
}

export function PedirEnlaceForm() {
  const [state, formAction] = useActionState(pedirEnlaceDeResetAction, INICIAL);

  // Con el aviso en pantalla el formulario se retira: dejarlo invita a mandar
  // otro enlace, y cada pedido nuevo invalida el anterior.
  if (state.info) {
    return (
      <div
        className="rounded-xl border border-fr-border bg-fr-card px-5 py-4 text-sm leading-relaxed text-fr-muted"
        role="status"
        data-testid="judge-reset-request-sent"
      >
        {state.info}
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-0" data-testid="judge-reset-request-form">
      <FormField
        id="judge-reset-email"
        label="Tu correo"
        required
        layout="auth"
        microcopy="El mismo con el que entrás como jurado."
        className="!pb-8 md:!pb-10"
      >
        <input
          id="judge-reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className={inputAuth}
        />
      </FormField>

      {state.error ? (
        <div
          className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm leading-relaxed text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <div className="mt-10 md:mt-12">
        <Boton />
      </div>
    </form>
  );
}
