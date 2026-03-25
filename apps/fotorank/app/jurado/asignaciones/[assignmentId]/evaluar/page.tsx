import Link from "next/link";
import { notFound } from "next/navigation";
import { listEntriesForAssignment } from "../../../../actions/judges";
import { requireJudgeAuth } from "../../../../lib/judge-auth";
import {
  eligibilityForLoadedAssignment,
  loadJudgeAssignmentScoped,
} from "../../../../lib/fotorank/judgeEvaluationGate";
import { EvaluationClient } from "./EvaluationClient";
import { Card, Button } from "@repo/design-system";

export default async function JudgeEvaluationPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const judge = await requireJudgeAuth();

  const assignment = await loadJudgeAssignmentScoped(assignmentId, judge.id);
  if (!assignment) return notFound();

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
        <h1 className="text-2xl font-semibold text-fr-primary">Evaluación de fotografías</h1>
        <EvaluationClient
          assignmentId={assignmentId}
          methodType={assignment.methodType}
          methodConfig={assignment.methodConfigJson}
          entries={(entriesResult.data ?? []) as any[]}
        />
      </div>
    </div>
  );
}
