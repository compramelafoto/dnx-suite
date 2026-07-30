"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxResetPanel, infospotAuthBrand } from "@repo/auth-ui";
import { resetPasswordAction, type IdentityFormState } from "@/app/actions/identity";

const initial: IdentityFormState = { ok: false, message: "" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <DnxResetPanel
      brand={infospotAuthBrand}
      formAction={formAction}
      token={token}
      error={state.message || null}
      loading={pending ? "resetting" : "idle"}
      loginHref="/ingresar"
    />
  );
}
