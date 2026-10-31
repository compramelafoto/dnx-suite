"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxForgotPanel, fotorankAuthBrand } from "@repo/auth-ui";
import {
  requestFotorankPasswordResetAction,
  type FotorankResetFormState,
} from "./actions";

const initialState: FotorankResetFormState = { error: null, info: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestFotorankPasswordResetAction,
    initialState,
  );

  return (
    <DnxForgotPanel
      brand={fotorankAuthBrand}
      formAction={formAction}
      error={state.error}
      notice={state.info}
      loading={pending ? "sending-email" : "idle"}
      loginHref="/login"
      showRegister={Boolean(state.noAccount)}
    />
  );
}
