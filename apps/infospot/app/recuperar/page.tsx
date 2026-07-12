import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return (
    <PageShell
      title="Recuperar contraseña"
      description="Te enviamos un enlace de un solo uso. Nunca mandamos tu contraseña por email."
    >
      <div className="mx-auto max-w-md space-y-8">
        <p className="text-sm text-[var(--is-muted)]">
          <Link href="/ingresar" className="text-[var(--is-accent)] underline-offset-2 hover:underline">
            ← Volver a ingresar
          </Link>
        </p>
        <ForgotPasswordForm />
      </div>
    </PageShell>
  );
}
