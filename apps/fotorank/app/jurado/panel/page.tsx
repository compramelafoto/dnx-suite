import Link from "next/link";
import { Card, Button, Badge } from "@repo/design-system";
import { listJudgeAssignmentsForCurrentJudge, judgeLogoutAction } from "../../actions/judges";
import { requireJudgeAuth } from "../../lib/judge-auth";

export default async function JudgePanelPage() {
  const judge = await requireJudgeAuth();
  const assignments = await listJudgeAssignmentsForCurrentJudge();

  return (
    <div className="min-h-screen bg-fr-bg p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-fr-primary">Panel del jurado</h1>
            <p className="text-sm text-fr-muted">{judge.profile ? `${judge.profile.firstName} ${judge.profile.lastName}` : judge.email}</p>
          </div>
          <form action={judgeLogoutAction}>
            <Button variant="outline" type="submit">Cerrar sesión</Button>
          </form>
        </div>

        {!assignments.ok ? (
          <Card><p className="text-red-300 text-sm">{assignments.error}</p></Card>
        ) : (
          <div className="grid gap-4">
            {(assignments.data ?? []).map((a: any) => (
              <Card key={a.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-fr-primary">{a.contestTitle}</h2>
                    <p className="text-sm text-fr-muted">Categoría: {a.categoryName}</p>
                    <p className="text-xs text-fr-muted-soft">Método: {a.methodType}</p>
                    <p className="text-xs text-fr-muted-soft">Votos cargados: {a.votesCount}</p>
                    {!a.evaluationAllowed && a.evaluationBlockMessage ? (
                      <p className="mt-2 text-xs text-amber-200/90">{a.evaluationBlockMessage}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <Badge variant="neutral">{a.assignmentStatus}</Badge>
                    {a.evaluationAllowed ? (
                      <Link href={`/jurado/asignaciones/${a.id}/evaluar`}>
                        <Button size="sm" className="w-full sm:w-auto">Evaluar</Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="w-full sm:w-auto cursor-not-allowed opacity-60">
                        Evaluar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
