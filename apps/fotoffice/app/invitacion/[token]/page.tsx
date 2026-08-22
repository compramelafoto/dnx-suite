import Link from "next/link";
import { findInvitationByTokenHash } from "@repo/db/fotoffice-member-invitations";
import { getAuthUser } from "@/lib/auth";
import {
  canMemberUseInvitations,
  emailsMatch,
  hashInvitationToken,
  invitationState,
} from "@/lib/members/invitations";
import { AcceptInvitationForm } from "@/components/members/accept-invitation-form";
import { PasswordActivationForm } from "@/components/members/password-activation-form";

export const dynamic = "force-dynamic";

/** Marco común, para que todos los desenlaces se vean igual y no se filtre nada por la forma. */
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
 * Aceptación de una invitación de acceso.
 *
 * Abrir el enlace NO vincula nada: solo muestra qué se va a vincular. El vínculo requiere
 * estar autenticado con el email invitado y confirmar explícitamente.
 */
export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await findInvitationByTokenHash(hashInvitationToken(decodeURIComponent(token)));

  // Token inexistente y token inválido dan la MISMA respuesta: no se confirma si un enlace
  // existió alguna vez.
  if (!invitation) {
    return (
      <Shell title="Invitación no válida">
        <p className="text-sm text-[var(--fo-muted)]">
          Este enlace no es válido o ya fue utilizado. Pedile a la institución que te envíe uno nuevo.
        </p>
      </Shell>
    );
  }

  const state = invitationState(invitation);
  if (state !== "PENDING") {
    const detail =
      state === "ACCEPTED"
        ? "Esta invitación ya fue aceptada. Si sos vos, iniciá sesión normalmente."
        : state === "REVOKED"
          ? "Esta invitación fue cancelada por la institución."
          : "Esta invitación venció. Pedile a la institución que te envíe una nueva.";
    return (
      <Shell title="Invitación no disponible">
        <p className="text-sm text-[var(--fo-muted)]">{detail}</p>
        <Link href="/login" className="fo-btn fo-btn-secondary text-sm">
          Ir al inicio de sesión
        </Link>
      </Shell>
    );
  }

  if (!canMemberUseInvitations(invitation.member.status)) {
    return (
      <Shell title="Invitación no disponible">
        <p className="text-sm text-[var(--fo-muted)]">
          Este enlace ya no está disponible. Consultá con la institución.
        </p>
      </Shell>
    );
  }

  if (invitation.member.userId !== null) {
    return (
      <Shell title="Este socio ya tiene cuenta">
        <p className="text-sm text-[var(--fo-muted)]">
          El acceso de este socio ya fue activado. Iniciá sesión con tu cuenta.
        </p>
        <Link href="/login" className="fo-btn fo-btn-secondary text-sm">
          Ir al inicio de sesión
        </Link>
      </Shell>
    );
  }

  const user = await getAuthUser();

  // Sin sesión, dos caminos sobre el MISMO sistema de identidad: Google, o el flujo de "crear
  // contraseña" que ya existe. Acá no se pide ni se muestra ninguna contraseña, y abrir el
  // enlace no vincula nada: eso requiere después sesión con el email invitado.
  if (!user) {
    return (
      <Shell title={`Invitación de ${invitation.workspace.name}`}>
        <p className="text-sm text-[var(--fo-text)]">
          Te invitaron a acceder como socio de <strong>{invitation.workspace.name}</strong>.
        </p>
        <p className="text-sm text-[var(--fo-muted)]">
          Para continuar, entrá con <strong>{invitation.email}</strong>. Podés usar tu cuenta de
          Google con ese mismo email, o crear una contraseña.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/invitacion/${token}`)}`}
          className="fo-btn fo-btn-primary text-sm"
        >
          Continuar con Google o iniciar sesión
        </Link>
        <PasswordActivationForm token={token} />
      </Shell>
    );
  }

  // Sesión con OTRO email: no se vincula. Si no, cualquiera con el enlace podría quedarse con
  // el socio de otra persona.
  if (!emailsMatch(user.email, invitation.email)) {
    return (
      <Shell title="Esta invitación es para otra cuenta">
        <p className="text-sm text-[var(--fo-text)]">
          La invitación fue emitida para <strong>{invitation.email}</strong>, pero tenés la sesión
          iniciada con <strong>{user.email}</strong>.
        </p>
        <p className="text-sm text-[var(--fo-muted)]">
          Cerrá sesión e ingresá con el email invitado, o pedile a la institución que emita la
          invitación para tu email.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={`Confirmá tu acceso a ${invitation.workspace.name}`}>
      <p className="text-sm text-[var(--fo-text)]">
        Vas a vincular tu cuenta <strong>{user.email}</strong> con el socio{" "}
        <strong>
          N° {invitation.member.memberNumber} — {invitation.member.lastName}, {invitation.member.firstName}
        </strong>{" "}
        de <strong>{invitation.workspace.name}</strong>.
      </p>
      <p className="fo-helper">
        Vincular tu cuenta no te otorga permisos de administración: solo asocia tu acceso a tu
        ficha de socio.
      </p>
      <AcceptInvitationForm invitationId={invitation.id} />
    </Shell>
  );
}
