import Link from "next/link";
import { findTeamInvitationByTokenHash } from "@repo/db/fotoffice-team";
import { etiquetaRol } from "@/lib/access/roles";
import { getAuthUser } from "@/lib/auth";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";
import { emailsMatch, invitationState } from "@/lib/members/invitations";
import { AceptarForm, PrimeraVezForm } from "./aceptar-form";

export const dynamic = "force-dynamic";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-lg px-4 py-16">
        <section className="fo-card space-y-4">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {children}
        </section>
      </main>
    </div>
  );
}

/**
 * Invitación a sumarse al equipo de un espacio de trabajo.
 *
 * Abrir el enlace no da acceso a nada: sólo muestra a qué se invita. Entrar al equipo exige
 * sesión con el correo invitado y confirmar con el botón.
 */
export default async function TeamInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let rawToken: string;
  try {
    rawToken = decodeURIComponent(token);
  } catch {
    rawToken = "";
  }
  const invitation = rawToken ? await findTeamInvitationByTokenHash(hashInvitationToken(rawToken)) : null;

  if (!invitation) {
    return (
      <Shell title="Invitación no válida">
        <p className="text-sm text-[var(--fo-muted)]">Este enlace no es válido.</p>
      </Shell>
    );
  }

  if (invitationState(invitation) !== "PENDING") {
    return (
      <Shell title="Invitación no disponible">
        <p className="text-sm text-[var(--fo-muted)]">
          Esta invitación ya no está disponible. Pedile a quien te invitó que te mande una nueva.
        </p>
        <Link href="/login" className="fo-btn fo-btn-secondary text-sm">
          Ir al inicio de sesión
        </Link>
      </Shell>
    );
  }

  const workspaceName = invitation.workspace.name;
  const rol = etiquetaRol(invitation.role);
  const user = await getAuthUser();

  if (!user) {
    return (
      <Shell title={`Invitación de ${workspaceName}`}>
        <p className="text-sm text-[var(--fo-text)]">
          Te invitaron a sumarte al equipo de <strong>{workspaceName}</strong> como{" "}
          <strong>{rol}</strong>.
        </p>
        <p className="text-sm text-[var(--fo-muted)]">
          Para seguir, entrá con <strong>{invitation.email}</strong>.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/invitacion/equipo/${token}`)}`}
          className="fo-btn fo-btn-primary text-sm"
        >
          Ya tengo cuenta
        </Link>
        <PrimeraVezForm token={rawToken} />
        <p className="text-xs text-[var(--fo-muted)]">
          Si abrís el correo en otro dispositivo, volvé a entrar a este mismo enlace para terminar.
        </p>
      </Shell>
    );
  }

  if (!emailsMatch(user.email, invitation.email)) {
    return (
      <Shell title="Esta invitación es para otra cuenta">
        <p className="text-sm text-[var(--fo-text)]">
          Esta invitación es para <strong>{invitation.email}</strong>. Entraste como{" "}
          <strong>{user.email}</strong>.
        </p>
        <p className="text-sm text-[var(--fo-muted)]">
          Cerrá sesión y volvé a entrar con el correo invitado.
        </p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="fo-btn fo-btn-secondary text-sm">
            Cerrar sesión
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title={`Sumate al equipo de ${workspaceName}`}>
      <p className="text-sm text-[var(--fo-text)]">
        Te invitaron a sumarte al equipo de <strong>{workspaceName}</strong> como{" "}
        <strong>{rol}</strong>.
      </p>
      <AceptarForm invitationId={invitation.id} />
    </Shell>
  );
}
