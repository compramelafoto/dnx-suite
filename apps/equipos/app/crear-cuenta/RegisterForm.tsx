"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxRegisterPanel, equiposAuthBrand } from "@repo/auth-ui";
import { registerAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = { error: null };

export function RegisterForm({ returnTo }: { returnTo?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <DnxRegisterPanel
      brand={equiposAuthBrand}
      formAction={formAction}
      error={state.error}
      loading={pending ? "submitting" : "idle"}
      loginHref={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"}
      termsAcceptedName="acceptedTerms"
      hiddenFields={
        <>
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <fieldset className="auth-opciones">
            <legend className="auth-opciones-titulo">¿Sos fotógrafo?</legend>
            <label className="opcion">
              <input type="radio" name="esFotografo" value="si" required disabled={pending} /> Sí
            </label>
            <label className="opcion">
              <input type="radio" name="esFotografo" value="no" required disabled={pending} /> No
            </label>
          </fieldset>
        </>
      }
    />
  );
}
