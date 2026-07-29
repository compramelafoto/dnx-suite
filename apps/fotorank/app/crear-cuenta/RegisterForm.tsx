"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxRegisterPanel, fotorankAuthBrand } from "@repo/auth-ui";
import {
  registerFotorankAccountAction,
  type FotorankRegisterFormState,
} from "./actions";

const initialState: FotorankRegisterFormState = { error: null };

export function RegisterForm({ nextPath }: { nextPath?: string | null }) {
  const [state, formAction, pending] = useActionState(
    registerFotorankAccountAction,
    initialState,
  );

  return (
    <DnxRegisterPanel
      brand={fotorankAuthBrand}
      formAction={formAction}
      nextPath={nextPath ?? undefined}
      error={state.error}
      loading={pending ? "submitting" : "idle"}
      googleHref="/api/auth/google"
      loginHref={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
      termsAcceptedName="acceptedTerms"
      hiddenFields={<input type="hidden" name="acceptedPrivacy" value="1" />}
    />
  );
}
