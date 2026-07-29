"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxLoginPanel, clickatonAuthBrand } from "@repo/auth-ui";
import {
  loginClickatonAction,
  type ClickatonLoginFormState,
} from "@/app/(public)/login/actions";

const initialState: ClickatonLoginFormState = { error: null };

type Props = {
  nextPath: string;
  oauthError?: string | null;
};

export function LoginForm({ nextPath, oauthError }: Props) {
  const [state, formAction, pending] = useActionState(loginClickatonAction, initialState);
  const error = state.error ?? oauthError ?? null;

  return (
    <DnxLoginPanel
      brand={clickatonAuthBrand}
      formAction={formAction}
      nextPath={nextPath}
      error={error}
      loading={pending ? "submitting" : "idle"}
      googleHref="/api/auth/google"
      registerHref="/crear-cuenta"
      forgotHref="/recuperar"
      loginHref="/login"
    />
  );
}
