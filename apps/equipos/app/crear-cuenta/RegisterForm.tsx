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
          <fieldset
            style={{
              border: "1px solid var(--auth-border)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              display: "flex",
              gap: "1.5rem",
              alignItems: "center",
              fontFamily: "var(--auth-font)",
              color: "var(--auth-text-primary)",
            }}
          >
            <legend style={{ padding: "0 0.5rem", fontSize: "0.875rem" }}>¿Sos fotógrafo?</legend>
            <label>
              <input type="radio" name="esFotografo" value="si" required disabled={pending} /> Sí
            </label>
            <label>
              <input type="radio" name="esFotografo" value="no" required disabled={pending} /> No
            </label>
          </fieldset>
        </>
      }
    />
  );
}
