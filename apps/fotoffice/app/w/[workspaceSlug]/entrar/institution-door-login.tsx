"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxLoginPanel, fotofficeAuthBrand } from "@repo/auth-ui";
import { fotofficeLoginAction, type LoginFormState } from "@/app/login/actions";

const initial: LoginFormState = { error: null };

/**
 * El formulario de siempre, con el nombre de la institución arriba.
 *
 * Reusa `fotofficeLoginAction` y el panel compartido tal como están: la puerta no es otra
 * forma de autenticarse, es la misma con un cartel que dice dónde estás. Duplicar el login
 * habría significado mantener dos, y que uno se quede atrás del otro.
 *
 * `doorPath` viaja como `nextPath`, que el panel ya pone tanto en el campo oculto del
 * formulario como pegado al enlace de Google. Por eso la puerta funciona igual con contraseña
 * que con Google, sin tocar el paquete de autenticación que comparten las cinco aplicaciones.
 */
export function InstitutionDoorLogin({
  institutionName,
  logoUrl,
  doorPath,
}: {
  institutionName: string;
  logoUrl: string | null;
  doorPath: string;
}) {
  const [state, formAction, pending] = useActionState(fotofficeLoginAction, initial);

  return (
    <main className="flex w-full flex-col items-center justify-center gap-6 bg-[var(--fo-bg)] px-4 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-16 rounded-xl border border-[var(--fo-border)] bg-white object-contain p-1"
          />
        ) : null}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">Estás entrando a</p>
          <p className="text-lg font-semibold text-[var(--fo-text)]">{institutionName}</p>
        </div>
      </header>

      <DnxLoginPanel
        brand={fotofficeAuthBrand}
        formAction={formAction}
        nextPath={doorPath}
        error={state.error}
        loading={pending ? "submitting" : "idle"}
        googleHref="/api/auth/google"
        forgotHref="/recuperar"
        loginHref={doorPath}
      />
    </main>
  );
}
