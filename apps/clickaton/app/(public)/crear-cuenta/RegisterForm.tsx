"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxRegisterPanel, clickatonAuthBrand } from "@repo/auth-ui";
import {
  registerClickatonAccountAction,
  type ClickatonRegisterFormState,
} from "./actions";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

const initialState: ClickatonRegisterFormState = { error: null, info: null };

type Props = { nextPath: string };

export function RegisterForm({ nextPath }: Props) {
  const [state, formAction, pending] = useActionState(
    registerClickatonAccountAction,
    initialState,
  );

  return (
    <DnxRegisterPanel
      brand={clickatonAuthBrand}
      formAction={formAction}
      nextPath={nextPath}
      error={state.error}
      loading={pending ? "submitting" : "idle"}
      googleHref="/api/auth/google"
      loginHref={`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`}
      termsAcceptedName="acceptedTerms"
      hiddenFields={<input type="hidden" name="acceptedPrivacy" value="1" />}
    />
  );
}
