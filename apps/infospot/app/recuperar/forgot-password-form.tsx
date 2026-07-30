"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxForgotPanel, infospotAuthBrand } from "@repo/auth-ui";
import { requestPasswordResetAction, type IdentityFormState } from "@/app/actions/identity";

const initial: IdentityFormState = { ok: false, message: "" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);

  return (
    <DnxForgotPanel
      brand={infospotAuthBrand}
      formAction={formAction}
      error={state.ok ? null : state.message || null}
      notice={state.ok ? state.message || null : null}
      loading={pending ? "sending-email" : "idle"}
      loginHref="/ingresar"
    />
  );
}
