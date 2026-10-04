import { notFound, redirect } from "next/navigation";
import { requireJudgeAuth } from "../../../../../lib/judge-auth";
import { loadJudgeAssignmentScoped } from "../../../../../lib/fotorank/judgeEvaluationGate";

/**
 * La dirección del método viejo de calificación, que ya no existe.
 *
 * Calificaba con un puntaje único sobre todas las obras de la categoría, sin
 * vacantes ni criterios. Convivía con el de la rúbrica y el panel llevaba a
 * uno u otro según el concurso; desde el 2026-09-24 queda sólo el de la
 * rúbrica. La dirección se conserva para que un enlace guardado lleve al
 * concurso correcto en vez de a una página inexistente.
 */
export default async function MetodoViejoRedirige({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const judge = await requireJudgeAuth();
  const loaded = await loadJudgeAssignmentScoped(assignmentId, judge.id);
  if (!loaded) notFound();
  redirect(`/jurado/concursos/${loaded.row.contestId}`);
}
