"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxResetPanel, clickatonAuthBrand } from "@repo/auth-ui";
import {
  resetClickatonPasswordAction,
  type ClickatonResetFormState,
} from "../actions";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

const initialState: ClickatonResetFormState = { error: null, info: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetClickatonPasswordAction,
    initialState,
  );

  return (
    <DnxResetPanel
      brand={clickatonAuthBrand}
      formAction={formAction}
      token={token}
      error={state.error}
      notice={state.info}
      loading={pending ? "resetting" : "idle"}
      loginHref={CLICKATON_LOGIN_PATH}
    />
  );
}
