import Link from "next/link";
import { getClickatonJuryPrisma } from "@repo/db/clickaton-jury-client";
import { prisma } from "@repo/db";
import { Card, Button, Badge } from "@repo/design-system";
import { listJudgeAssignmentsForCurrentJudge, judgeLogoutAction } from "../../actions/judges";
import { requireJudgeAuth } from "../../lib/judge-auth";
import { caminoDeEvaluacion } from "../../lib/fotorank/jury/caminoDeEvaluacion";
import { StatusBadge } from "../../components/public-ui";
import {
  presentJudgeAssignmentStatus,
  presentJudgeMethodType,
} from "../../lib/fotorank/judges/ui/judgeStatus";

/** Lo que esta pantalla necesita de cada asignación, venga de la base que venga. */
type AsignacionDelPanel = {
  id: string;
  contestId: string;
  contestTitle: string;
  categoryName: string;
  assignmentStatus: string;
  methodType: string;
  platformLabel: string;
  evaluationAllowed: boolean;
  evaluationBlockMessage?: string | null;
  votesCount?: number;
};

export default async function JudgePanelPage() {
  const judge = await requireJudgeAuth();
  const assignments = await listJudgeAssignmentsForCurrentJudge();

  /*
   * Qué concursos tienen su lote congelado.
   *
   * Decide por dónde califica cada jurado: con lote congelado sólo sirve el
   * panel de obras, que respeta el reparto por vacante y usa los criterios de
   * la rúbrica. El otro camino mostraba las obras de toda la categoría y pedía
   * un puntaje único.
   */
  const contestIds = [
    ...new Set(
      (assignments.ok ? (assignments.data?.assignments ?? []) : [])
        .map((a) => String((a as { contestId?: unknown }).contestId ?? ""))
        .filter(Boolean),
    ),
  ];
  const cruzado = getClickatonJuryPrisma();
  const conLoteCongelado = new Set<string>();

  if (contestIds.length) {
    /*
     * Se pregunta en las dos bases.
     *
     * El lote de una maratón está del lado de Clickatón: preguntando sólo en
     * casa la respuesta era siempre "no hay lote congelado", y el botón seguía
     * llevando al motor viejo, que muestra todas las obras de la categoría y
     * pide un puntaje único.
     */
    const propios = await prisma.fotorankAdmissionBatch.findMany({
      where: { contestId: { in: contestIds }, status: "FROZEN" },
      select: { contestId: true },
    });
    for (const b of propios) conLoteCongelado.add(b.contestId);

    if (cruzado) {
      try {
        const ajenos = await cruzado.fotorankAdmissionBatch.findMany({
          where: { contestId: { in: contestIds }, status: "FROZEN" },
          select: { contestId: true },
        });
        for (const b of ajenos) conLoteCongelado.add(b.contestId);
      } catch {
        // Sin Clickatón al alcance, el panel sigue mostrando lo propio.
      }
    }
  }

  return (
    <div className="min-h-screen bg-fr-bg p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-fr-primary">Panel del jurado</h1>
            <p className="text-sm text-fr-muted">{judge.profile ? `${judge.profile.firstName} ${judge.profile.lastName}` : judge.email}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/jurado/perfil">
              <Button variant="outline" type="button">
                Perfil profesional
              </Button>
            </Link>
            <Link href="/jurado/invitaciones">
              <Button variant="outline" type="button">
                Invitaciones
              </Button>
            </Link>
            <form action={judgeLogoutAction}>
              <Button variant="outline" type="submit">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>

        {!assignments.ok ? (
          <Card><p className="text-red-300 text-sm">{assignments.error}</p></Card>
        ) : (
          <div className="grid gap-4">
            {assignments.data?.clickatonUnavailable ? (
              <Card>
                <p className="text-sm text-amber-300" role="status">
                  No pudimos traer tus asignaciones de Clickatón en este momento.
                  Volvé a entrar en un rato; las demás se muestran igual.
                </p>
              </Card>
            ) : null}
            {(assignments.data?.assignments ?? []).length === 0 ? (
              <Card>
                <p className="text-sm text-fr-muted">
                  Todavía no te asignaron ninguna categoría. Escribile al organizador del concurso.
                </p>
                <p className="mt-2 text-xs text-fr-muted-soft">
                  Mientras tanto podés completar tu{" "}
                  <Link href="/jurado/perfil" className="underline underline-offset-2">
                    perfil profesional
                  </Link>
                  .
                </p>
              </Card>
            ) : null}
            {(assignments.data?.assignments ?? []).map((cruda) => {
              // `listJudgeAssignmentsForCurrentJudge` devuelve filas sueltas de
              // dos bases distintas, así que el tipo ancho se estrecha acá.
              const a = cruda as AsignacionDelPanel;
              return (
              <Card key={a.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-fr-primary">{a.contestTitle}</h2>
                    <p className="text-sm text-fr-muted">Categoría: {a.categoryName}</p>
                    <p
                      className="text-xs text-fr-muted-soft"
                      title={presentJudgeMethodType(String(a.methodType)).description}
                    >
                      Cómo se evalúa: {presentJudgeMethodType(String(a.methodType)).label}
                    </p>
                    <p className="text-xs text-fr-muted-soft">Votos cargados: {a.votesCount}</p>
                    {!a.evaluationAllowed && a.evaluationBlockMessage ? (
                      <p className="mt-2 text-xs text-amber-200/90">{a.evaluationBlockMessage}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <Badge variant="default">{a.platformLabel}</Badge>
                    <span title={presentJudgeAssignmentStatus(String(a.assignmentStatus)).description}>
                      <StatusBadge {...presentJudgeAssignmentStatus(String(a.assignmentStatus))} />
                    </span>
                    {a.evaluationAllowed ? (
                      <Link
                        href={
                          caminoDeEvaluacion({
                            hayLoteCongelado: conLoteCongelado.has(String(a.contestId)),
                            contestId: String(a.contestId),
                            assignmentId: String(a.id),
                          }).href
                        }
                      >
                        <Button size="sm" className="w-full sm:w-auto">Calificar obras</Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="w-full sm:w-auto cursor-not-allowed opacity-60">
                        Evaluación no habilitada
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
