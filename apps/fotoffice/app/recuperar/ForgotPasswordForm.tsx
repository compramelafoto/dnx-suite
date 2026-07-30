"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxForgotPanel, fotofficeAuthBrand } from "@repo/auth-ui";
import {
  requestFotofficePasswordResetAction,
  type FotofficeResetFormState,
} from "./actions";

const initial: FotofficeResetFormState = { error: null, info: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestFotofficePasswordResetAction,
    initial,
  );

  return (
    <DnxForgotPanel
      brand={fotofficeAuthBrand}
      formAction={formAction}
      error={state.error}
      notice={state.info}
      loading={pending ? "sending-email" : "idle"}
      loginHref="/login"
    />
  );
}
