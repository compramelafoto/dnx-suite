import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { listEvaluationContextsAction } from "@/app/actions/evaluaciones";
import { CreateEvaluationContextForm } from "@/components/evaluaciones/create-context-form";

export default async function EvaluacionesPage() {
  const contexts = await listEvaluationContextsAction();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Evaluaciones"
        description="Gestioná contextos de evaluación por workspace y prepará la base para actividades y correcciones."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Contextos existentes</h2>
          {contexts.length === 0 ? (
            <div className="fo-card">
              <p className="text-sm text-[var(--fo-muted)]">Todavía no hay contextos creados.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {contexts.map((context) => (
                <li key={context.id} className="fo-card flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-base font-semibold text-[var(--fo-text)]">{context.name}</p>
                    <p className="text-sm text-[var(--fo-muted)] line-clamp-2">
                      {context.description || "Sin descripción"}
                    </p>
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      Creado el{" "}
                      {new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(context.createdAt)}
                    </p>
                  </div>
                  <Link href={`/evaluaciones/${context.id}`} className="fo-btn fo-btn-secondary text-sm min-h-9">
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CreateEvaluationContextForm />
      </div>
    </div>
  );
}
