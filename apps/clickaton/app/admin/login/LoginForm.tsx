"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  loginAdminAction,
  type AdminLoginFormState,
} from "@/app/admin/login/actions";

const initialState: AdminLoginFormState = { error: null };

type Props = {
  nextPath: string;
};

export function LoginForm({ nextPath }: Props) {
  const [state, formAction, pending] = useActionState(loginAdminAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <Field id="email" label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={pending}
        />
      </Field>
      <Field id="password" label="Contraseña" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </Field>
      {state.error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" loading={pending}>
        Ingresar al panel
      </Button>
    </form>
  );
}
