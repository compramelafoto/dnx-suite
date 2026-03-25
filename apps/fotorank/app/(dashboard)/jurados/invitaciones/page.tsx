import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../lib/fotorank/dashboard-org-context";
import { listJudgeInvitationsForOrg } from "../../../actions/judges";
import { InvitationsPageClient } from "./InvitationsPageClient";

export default async function JudgeInvitationsPage() {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);

  const contests =
    resolved.ok
      ? await prisma.fotorankContest.findMany({
          where: { organizationId: resolved.org.id },
          select: {
            id: true,
            title: true,
            categories: { select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const invitationsResult = resolved.ok ? await listJudgeInvitationsForOrg() : { ok: false as const, error: "Sin organización." };
  const invitations = invitationsResult.ok ? invitationsResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fr-primary">Invitaciones de jurados</h1>
      <InvitationsPageClient contests={contests} initialInvitations={invitations} />
    </div>
  );
}
