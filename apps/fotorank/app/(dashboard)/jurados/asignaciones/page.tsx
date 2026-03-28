import { prisma } from "@repo/db";
import { listJudgesForOrg } from "../../../actions/judges";
import { requireAuth } from "../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../lib/fotorank/dashboard-org-context";
import { AssignmentsPageClient } from "./AssignmentsPageClient";

export default async function JudgeAssignmentsPage() {
  const user = await requireAuth();
  const judgesResult = await listJudgesForOrg();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  const contests =
    resolved.ok
      ? await prisma.fotorankContest.findMany({
          where: { organizationId: resolved.org.id },
          include: { categories: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fr-primary">Asignaciones de jurados</h1>
      <AssignmentsPageClient
        judges={judgesResult.ok ? (judgesResult.data ?? []).map((j: any) => ({ id: j.judgeId, label: `${j.profile?.firstName ?? ""} ${j.profile?.lastName ?? ""} · ${j.email}` })) : []}
        contests={contests.map((c) => ({ id: c.id, title: c.title, categories: c.categories.map((cat) => ({ id: cat.id, name: cat.name })) }))}
      />
    </div>
  );
}
