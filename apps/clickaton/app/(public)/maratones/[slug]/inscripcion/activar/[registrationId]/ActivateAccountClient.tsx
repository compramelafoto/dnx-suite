"use client";

import "@repo/auth-ui/tokens.css";
import {
  DnxGoogleButton,
  DnxAuthDivider,
  DnxAuthNotice,
  clickatonAuthBrand,
} from "@repo/auth-ui";
import Link from "next/link";

type Props = {
  editionSlug: string;
  registrationId: string;
  accessToken: string;
  emailMasked: string;
  googleHref: string;
  loginHref: string;
  recoverHref: string;
  dashboardHref: string;
  activationRequired: boolean;
  existingUserWithCredentials: boolean;
};

export function ActivateAccountClient({
  emailMasked,
  googleHref,
  loginHref,
  recoverHref,
  dashboardHref,
  activationRequired,
  existingUserWithCredentials,
}: Props) {
  if (existingUserWithCredentials && !activationRequired) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-8" data-brand="clickaton">
        <DnxAuthNotice
          tone="success"
          message="¡Tu inscripción está confirmada! Iniciá sesión con tu Cuenta DNX para gestionarla."
        />
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--auth-accent,#D4AF37)] px-6 text-center font-semibold text-[#050505]"
        >
          Iniciar sesión
        </Link>
        <Link
          href={dashboardHref}
          className="text-center text-sm text-[var(--auth-text-secondary,#a1a1a1)] underline-offset-4 hover:underline"
        >
          Ver mi inscripción
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-8"
      data-brand={clickatonAuthBrand.tokens.brandKey}
    >
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--auth-text,#fafafa)]">
          ¡Ya estás inscripto!
        </h1>
        <p className="text-balance text-base leading-relaxed text-[var(--auth-text-secondary,#a1a1a1)]">
          Activá tu Cuenta DNX para gestionar tu participación. Usá el enlace de crear contraseña
          (email {emailMasked}) o continuá con Google.
        </p>
      </div>

      <DnxAuthNotice
        tone="info"
        message="No generamos contraseñas temporales. La activación usa el sistema central DNX."
      />

      <Link
        href={recoverHref}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--auth-accent,#D4AF37)] px-6 font-semibold text-[#050505]"
      >
        Activar cuenta / Crear contraseña
      </Link>

      <DnxAuthDivider />

      <DnxGoogleButton href={googleHref} label="Continuar con Google" />

      <p className="text-center text-sm text-[var(--auth-text-secondary,#a1a1a1)]">
        ¿Ya tenés contraseña?{" "}
        <Link
          href={loginHref}
          className="font-semibold text-[var(--auth-accent,#D4AF37)] underline-offset-4 hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
