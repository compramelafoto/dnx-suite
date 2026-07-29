"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxForgotPanel, clickatonAuthBrand } from "@repo/auth-ui";
import {
  requestClickatonPasswordResetAction,
  type ClickatonResetFormState,
} from "./actions";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

const initialState: ClickatonResetFormState = { error: null, info: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestClickatonPasswordResetAction,
    initialState,
  );

  return (
    <DnxForgotPanel
      brand={clickatonAuthBrand}
      formAction={formAction}
      error={state.error}
      notice={state.info}
      loading={pending ? "sending-email" : "idle"}
      loginHref={CLICKATON_LOGIN_PATH}
    />
  );
}
