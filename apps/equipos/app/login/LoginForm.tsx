"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxLoginPanel, equiposAuthBrand } from "@repo/auth-ui";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = { error: null };

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <DnxLoginPanel
      brand={equiposAuthBrand}
      formAction={formAction}
      error={state.error}
      loading={pending ? "submitting" : "idle"}
      registerHref={returnTo ? `/crear-cuenta?returnTo=${encodeURIComponent(returnTo)}` : "/crear-cuenta"}
      forgotHref="/recuperar"
      loginHref="/login"
      hiddenFields={returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
    />
  );
}
