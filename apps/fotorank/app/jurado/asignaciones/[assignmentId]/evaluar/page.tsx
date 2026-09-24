import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { listEntriesForAssignment } from "../../../../actions/judges";
import { requireJudgeAuth } from "../../../../lib/judge-auth";
import {
  eligibilityForLoadedAssignment,
  loadJudgeAssignmentScoped,
} from "../../../../lib/fotorank/judgeEvaluationGate";
import { platformLabel } from "../../../../lib/fotorank/jury/assignment-source";
import { EvaluationClient } from "./EvaluationClient";
import { Card, Button } from "@repo/design-system";

export default async function JudgeEvaluationPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const judge = await requireJudgeAuth();

  const loaded = await loadJudgeAssignmentScoped(assignmentId, judge.id);
  if (!loaded) return notFound();
  const assignment = loaded.row;
  const plataforma = platformLabel(loaded.platform);

  /*
   * Con el lote congelado, esta pantalla no sirve y no puede quedar accesible.
   *
   * Filtra las obras por categoría, así que ignora el reparto por vacante y las
   * muestra todas; y califica con un puntaje único en vez de los criterios de
   * la rúbrica. Una jurado con 170 obras asignadas entró por acá y vio 270.
   *
   * La guarda va en la pantalla y no sólo en el botón del panel: un enlace
   * guardado en favoritos la dejaría entrar igual.
   */
  const loteCongelado = await prisma.fotorankAdmissionBatch.findFirst({
    where: { contestId: assignment.contestId, status: "FROZEN" },
    select: { id: true },
  });
  if (loteCongelado) {
    redirect(`/jurado/concursos/${assignment.contestId}`);
  }

  const eligibility = eligibilityForLoadedAssignment(assignment, judge, new Date());

  if (!eligibility.allowed) {
    return (
      <div className="min-h-screen bg-fr-bg p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-semibold text-fr-primary">Evaluación no disponible</h1>
          <Card>
            <p className="text-sm text-fr-muted">{eligibility.message}</p>
            <Link href="/jurado/panel" className="mt-6 inline-block">
              <Button variant="outline">Volver al panel</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const entriesResult = await listEntriesForAssignment(assignmentId);
  if (!entriesResult.ok) {
    return (
      <div className="min-h-screen bg-fr-bg p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-semibold text-fr-primary">Evaluación</h1>
          <Card>
            <p className="text-sm text-red-300">{entriesResult.error}</p>
            <Link href="/jurado/panel" className="mt-6 inline-block">
              <Button variant="outline">Volver al panel</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fr-bg p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fr-primary">
            {assignment.contest.title}
          </h1>
          <p className="text-sm text-fr-muted">{plataforma} · Evaluación de fotografías</p>
        </div>
        <EvaluationClient
          assignmentId={assignmentId}
          methodType={assignment.methodType}
          methodConfig={assignment.methodConfigJson}
          entries={entriesResult.data ?? []}
        />
      </div>
    </div>
  );
}
