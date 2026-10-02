import "server-only";
import { createTeamInvitation, markTeamInvitationDelivery, TeamError } from "@repo/db/fotoffice-team";
import { etiquetaRol } from "@/lib/access/roles";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { generateInvitationToken, hashInvitationToken } from "@/lib/members/invitation-tokens";
import { buildTeamInvitationEmail, buildTeamInvitationUrl } from "./invitation-email";
import { teamInvitationExpiryFrom } from "./rules";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TeamRole = Parameters<typeof createTeamInvitation>[0]["role"];

export async function inviteTeamMember(p: {
  workspaceId: string;
  actor: { id: number; name: string | null };
  email: string;
  role: string;
}): Promise<{ ok: true; sentTo: string; warn?: string } | { ok: false; error: string }> {
  const email = p.email.trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return { ok: false, error: "Revisá el correo." };
  const rawToken = generateInvitationToken();
  const link = buildTeamInvitationUrl(rawToken);
  if (!link.ok) return { ok: false, error: "Falta configurar la dirección de la app." };
  let id: string;
  try {
    ({ id } = await createTeamInvitation({
      workspaceId: p.workspaceId,
      email,
      // La action ya validó el rol contra `rolesOfrecidos`.
      role: p.role as TeamRole,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: teamInvitationExpiryFrom(),
      invitedByUserId: p.actor.id,
    }));
  } catch (e) {
    if (e instanceof TeamError && e.reason === "ALREADY_MEMBER") {
      return { ok: false, error: "Esa persona ya es parte del equipo." };
    }
    throw e;
  }
  const { organizationName, signature } = await loadWorkspaceEmailContext(p.workspaceId);
  const body = buildTeamInvitationEmail({
    organizationName,
    roleLabel: etiquetaRol(p.role),
    inviterName: p.actor.name ?? "Alguien del equipo",
    url: link.url,
    signature,
  });
  const res = await sendAndLogEmail({ to: email, templateKey: "fotoffice.team.invitation", body, userId: p.actor.id });
  const sent = res.status === "SENT";
  await markTeamInvitationDelivery(id, sent);
  return sent
    ? { ok: true, sentTo: email }
    : { ok: true, sentTo: email, warn: "La invitación quedó creada pero el correo no salió. Podés reenviarla." };
}
