import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Invitación InfoSpot",
  robots: { index: false, follow: false },
};

/**
 * Landing invite-only — no hay alta pública de cuenta editorial.
 * El enlace real llega por email a `/invitar/[token]`.
 */
export default function InvitarHelpPage() {
  return (
    <PageShell
      title="¿Recibiste una invitación?"
      description="El acceso editorial a InfoSpot (Director, Redactor o Colaborador) es solo por invitación."
    >
      <div className="mx-auto max-w-md space-y-8 text-sm leading-relaxed text-[var(--is-text-secondary)]">
        <p>
          Si un Director te invitó, abrí el enlace del email. Ahí vas a poder activar tu{" "}
          <strong className="text-[var(--is-text)]">Cuenta DNX</strong> (o iniciar sesión si ya
          tenés una) y aceptar el rol editorial.
        </p>
        <p>
          Crear o iniciar sesión con Cuenta DNX <strong className="text-[var(--is-text)]">no</strong>{" "}
          otorga por sí solo permisos de Redacción o Admin.
        </p>
        <div className="flex flex-col gap-4 pt-2">
          <Link
            href="/ingresar"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)]"
          >
            Ir a iniciar sesión
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center text-[var(--is-accent)] underline-offset-2 hover:underline"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
