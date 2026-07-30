"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxResetPanel, fotofficeAuthBrand } from "@repo/auth-ui";
import {
  resetFotofficePasswordAction,
  type FotofficeResetFormState,
} from "../actions";

const initial: FotofficeResetFormState = { error: null, info: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetFotofficePasswordAction, initial);

  return (
    <DnxResetPanel
      brand={fotofficeAuthBrand}
      formAction={formAction}
      token={token}
      error={state.error}
      notice={state.info}
      loading={pending ? "resetting" : "idle"}
      loginHref="/login"
    />
  );
}
