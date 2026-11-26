"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxForgotPanel, equiposAuthBrand } from "@repo/auth-ui";
import { requestPasswordResetAction, type ResetFormState } from "./actions";

const initialState: ResetFormState = { error: null, info: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <DnxForgotPanel
      brand={equiposAuthBrand}
      formAction={formAction}
      error={state.error}
      notice={state.info}
      loading={pending ? "sending-email" : "idle"}
      loginHref="/login"
    />
  );
}
