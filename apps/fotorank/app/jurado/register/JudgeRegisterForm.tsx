"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  registerJudgeInvitationFormAction,
  type JudgeRegisterInviteFormState,
} from "../../actions/judges";
import { FormField, inputAuth } from "../../components/ui/form";

const initialState: JudgeRegisterInviteFormState = { error: null };

function JudgeRegisterSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="judge-register-submit"
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
    >
      {pending ? "Creando cuenta..." : "Aceptar invitación y continuar"}
    </button>
  );
}

export function JudgeRegisterForm() {
  const params = useSearchParams();
  const tokenFromUrl = params.get("token") ?? "";
  const [state, formAction] = useActionState(registerJudgeInvitationFormAction, initialState);

  return (
    <form data-testid="judge-register-form" action={formAction} method="post" className="w-full space-y-0">
      <FormField
        id="judge-token"
        label="Token de invitación"
        required
        layout="auth"
        hint="Lo recibís por correo o en el enlace de invitación."
      >
        <input
          id="judge-token"
          name="token"
          defaultValue={tokenFromUrl}
          required
          className={inputAuth}
          placeholder="Pegá el token aquí"
        />
      </FormField>
      <FormField id="judge-firstName" label="Nombre" required layout="auth">
        <input id="judge-firstName" name="firstName" required className={inputAuth} autoComplete="given-name" />
      </FormField>
      <FormField id="judge-lastName" label="Apellido" required layout="auth">
        <input id="judge-lastName" name="lastName" required className={inputAuth} autoComplete="family-name" />
      </FormField>
      <FormField
        id="judge-password"
        label="Contraseña"
        required
        layout="auth"
        className="!pb-8 md:!pb-10"
        hint="Mínimo 8 caracteres."
      >
        <input
          id="judge-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputAuth}
        />
      </FormField>
      {state.error ? (
        <div
          className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm leading-relaxed text-red-200 md:text-base"
          role="alert"
          data-testid="judge-register-error"
        >
          {state.error}
        </div>
      ) : null}
      <div className="mt-10 md:mt-12">
        <JudgeRegisterSubmitButton />
      </div>
    </form>
  );
}
