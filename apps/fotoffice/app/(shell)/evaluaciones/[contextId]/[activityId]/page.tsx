import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireEvaluacionesContext } from "@/lib/workspace";

export default async function EvaluacionActivityPage({
  params,
}: {
  params: Promise<{ contextId: string; activityId: string }>;
}) {
  const { contextId, activityId } = await params;
  const { workspace } = await requireEvaluacionesContext();
  const context = await prisma.evaluationContext.findFirst({
    where: { id: contextId, workspaceId: workspace.id },
    select: { id: true, name: true, description: true },
  });
  if (!context) notFound();

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${context.name} · Actividad`}
        description={
          context.description ||
          "Esta vista todavía está en construcción. Primero vamos a consolidar contexto, alumnos y actividades."
        }
      />
      <section className="fo-card space-y-3">
        <p className="text-sm text-[var(--fo-text-secondary)]">
          Próximamente: pantalla de corrección masiva conectada a rúbrica y resultados.
        </p>
        <p className="text-xs text-[var(--fo-muted-soft)]">Actividad: {activityId}</p>
      </section>
    </div>
  );
}
