import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getInvitationPreview } from "@/app/actions/identity";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = {
  title: "Aceptar invitación",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);
  if (!preview) notFound();

  const invalid =
    preview.app !== "infospot" ||
    preview.status !== "PENDING" ||
    preview.expiresAt.getTime() <= Date.now();

  return (
    <PageShell
      title="Aceptar invitación"
      description="Completá tu nombre y una contraseña para activar tu identidad DNX en Info Spot."
    >
      <div className="mx-auto max-w-md space-y-8">
        <p className="text-sm leading-relaxed text-[var(--is-muted)]">
          <Link href="/" className="text-[var(--is-accent)] underline-offset-2 hover:underline">
            ← Inicio
          </Link>
        </p>

        {invalid ? (
          <p className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            Esta invitación no está disponible (revocada, vencida o de otra app). Pedile al
            Director que te envíe una nueva.
          </p>
        ) : (
          <>
            <div className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6">
              <p className="text-sm text-[var(--is-muted)]">Invitación para</p>
              <p className="mt-1 font-semibold text-[var(--is-text)]">{preview.email}</p>
              <p className="mt-2 text-sm text-[var(--is-muted)]">
                Rol: {preview.roleLabel}
              </p>
            </div>
            <AcceptInviteForm token={token} />
          </>
        )}
      </div>
    </PageShell>
  );
}
