"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxResetPanel, equiposAuthBrand } from "@repo/auth-ui";
import { resetPasswordAction, type ResetFormState } from "../actions";

const initialState: ResetFormState = { error: null, info: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <DnxResetPanel
      brand={equiposAuthBrand}
      formAction={formAction}
      token={token}
      error={state.error}
      notice={state.info}
      loading={pending ? "resetting" : "idle"}
      loginHref="/login"
    />
  );
}
