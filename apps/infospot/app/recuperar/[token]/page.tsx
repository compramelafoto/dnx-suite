import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PageShell
      title="Elegí una nueva contraseña"
      description="El enlace es de un solo uso y tiene vencimiento."
    >
      <div className="mx-auto max-w-md space-y-8">
        <p className="text-sm text-[var(--is-muted)]">
          <Link href="/ingresar" className="text-[var(--is-accent)] underline-offset-2 hover:underline">
            ← Volver a ingresar
          </Link>
        </p>
        <ResetPasswordForm token={token} />
      </div>
    </PageShell>
  );
}
