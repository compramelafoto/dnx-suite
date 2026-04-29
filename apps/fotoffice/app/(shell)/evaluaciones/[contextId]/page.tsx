import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireEvaluacionesContext } from "@/lib/workspace";

export default async function EvaluationContextDetailPage({
  params,
}: {
  params: Promise<{ contextId: string }>;
}) {
  const { contextId } = await params;
  const { workspace } = await requireEvaluacionesContext();

  const context = await prisma.evaluationContext.findFirst({
    where: {
      id: contextId,
      workspaceId: workspace.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });

  if (!context) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={context.name}
        description={context.description || "Contexto de evaluación sin descripción."}
      />

      <section className="fo-card space-y-3">
        <p className="text-xs text-[var(--fo-muted-soft)]">
          Creado el{" "}
          {new Intl.DateTimeFormat("es-AR", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(context.createdAt)}
        </p>
        <p className="text-sm text-[var(--fo-text-secondary)]">
          Próximo paso: cargar alumnos y crear actividades
        </p>
      </section>
    </div>
  );
}
