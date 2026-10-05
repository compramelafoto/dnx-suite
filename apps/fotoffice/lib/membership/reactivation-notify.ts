import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { formatMinorArs } from "./money";
import { buildReactivationContactEmail, buildSelfReactivatedEmail } from "./reactivation-emails";

export const REACTIVATION_EMAIL_KEYS = {
  CONTACT: "member-reactivation-request",
  SELF: "member-self-reactivated",
} as const;

/** Un mismo pedido no se manda dos veces en este plazo: el botón se aprieta de más. */
const CONTACT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * A quién se le avisa: la casilla institucional y el dueño y los administradores del panel.
 * Sin duplicados, porque la casilla suele ser la misma que la de alguno de ellos.
 */
async function secretaryRecipients(workspaceId: string): Promise<{ email: string; userId: number | null }[]> {
  const [branding, admins] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { contactEmail: true },
    }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId, role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
      select: { user: { select: { id: true, email: true } } },
    }),
  ]);

  const vistos = new Set<string>();
  const out: { email: string; userId: number | null }[] = [];
  const sumar = (email: string | null | undefined, userId: number | null) => {
    const limpio = email?.trim().toLowerCase();
    if (!limpio || vistos.has(limpio)) return;
    vistos.add(limpio);
    out.push({ email: limpio, userId });
  };
  sumar(branding?.contactEmail, null);
  for (const { user } of admins) sumar(user.email, user.id);
  return out;
}

async function memberForNotice(memberId: string) {
  return prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, workspaceId: true, firstName: true, lastName: true, memberNumber: true },
  });
}

export type ContactRequestOutcome = "SENT" | "ALREADY_SENT" | "NO_RECIPIENTS" | "FAILED";

/** El socio de baja pidió que lo contacten para reactivar su ficha. */
export async function sendReactivationContactRequest(input: {
  memberId: string;
  fromEmail: string;
  debtMinor: number;
}): Promise<ContactRequestOutcome> {
  const member = await memberForNotice(input.memberId);
  const base = appUrl();
  if (!member || !base) return "FAILED";

  const recipients = await secretaryRecipients(member.workspaceId);
  if (recipients.length === 0) return "NO_RECIPIENTS";

  const { organizationName, signature } = await loadWorkspaceEmailContext(member.workspaceId);
  const body = buildReactivationContactEmail({
    institution: organizationName,
    personName: `${member.firstName} ${member.lastName}`.trim(),
    memberNumber: member.memberNumber,
    email: input.fromEmail,
    debtLabel: input.debtMinor > 0 ? formatMinorArs(input.debtMinor) : null,
    memberUrl: `${base}/members/${member.id}`,
    signature,
  });

  const reciente = await prisma.sentEmailLog.findFirst({
    where: {
      templateKey: REACTIVATION_EMAIL_KEYS.CONTACT,
      subject: body.subject,
      status: "SENT",
      createdAt: { gte: new Date(Date.now() - CONTACT_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (reciente) return "ALREADY_SENT";

  let enviados = 0;
  for (const r of recipients) {
    const outcome = await sendAndLogEmail({
      to: r.email,
      templateKey: REACTIVATION_EMAIL_KEYS.CONTACT,
      body,
      userId: r.userId,
    });
    if (outcome.status === "SENT") enviados += 1;
  }
  return enviados > 0 ? "SENT" : "FAILED";
}

/** Aviso de que un socio se reactivó solo, pagando. Nunca lanza. */
export async function notifySelfReactivation(memberId: string): Promise<void> {
  try {
    const member = await memberForNotice(memberId);
    const base = appUrl();
    if (!member || !base) return;
    const recipients = await secretaryRecipients(member.workspaceId);
    if (recipients.length === 0) return;

    const { organizationName, signature } = await loadWorkspaceEmailContext(member.workspaceId);
    const body = buildSelfReactivatedEmail({
      institution: organizationName,
      personName: `${member.firstName} ${member.lastName}`.trim(),
      memberNumber: member.memberNumber,
      memberUrl: `${base}/members/${member.id}`,
      signature,
    });
    for (const r of recipients) {
      await sendAndLogEmail({ to: r.email, templateKey: REACTIVATION_EMAIL_KEYS.SELF, body, userId: r.userId });
    }
  } catch (error) {
    console.error("[fotoffice][reactivacion] no se pudo avisar la reactivación", {
      memberId,
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
}
