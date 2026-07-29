import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireJudgeAuth } from "../../../lib/judge-auth";
import { JuryError, listAnonymousEntriesForJuror } from "../../../lib/fotorank/jury";

type Props = { params: Promise<{ contestId: string }> };

export default async function JuryContestEntriesPage({ params }: Props) {
  const judge = await requireJudgeAuth();
  const { contestId } = await params;

  let data: Awaited<ReturnType<typeof listAnonymousEntriesForJuror>>;
  try {
    data = await listAnonymousEntriesForJuror({
      judgeAccountId: judge.id,
      contestId,
    });
  } catch (err) {
    if (err instanceof JuryError && err.code === "CONTEST_NOT_FOUND") notFound();
    if (err instanceof JuryError && (err.code === "NOT_ASSIGNED" || err.code === "FORBIDDEN")) {
      redirect("/jurado/panel");
    }
    throw err;
  }

  return (
    <div className="min-h-screen bg-fr-bg px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="fr-eyebrow">Panel jurado · anónimo</p>
            <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-fr-primary">
              {data.contestTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-fr-muted">
              Solo obras confirmadas de tus categorías. No se muestra identidad del participante.
            </p>
            {data.judgingEndsAt ? (
              <p className="mt-2 text-xs text-fr-muted">Cierre de evaluación: {data.judgingEndsAt}</p>
            ) : null}
          </div>
          <Link href="/jurado/panel" className="text-sm text-gold hover:text-gold-hover">
            ← Volver al panel
          </Link>
        </div>

        <ul className="grid gap-8 md:grid-cols-2" data-testid="jury-entries-list">
          {data.entries.map((e) => (
            <li key={e.entryId} className="fr-recuadro border border-fr-border bg-fr-card space-y-4">
              {e.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.previewUrl}
                  alt={`Preview ${e.anonymousCode}`}
                  className="max-h-56 w-full rounded-xl object-contain"
                />
              ) : null}
              <div>
                <p className="text-lg font-semibold text-gold">{e.anonymousCode}</p>
                <p className="mt-2 text-sm text-fr-muted">Categoría: {e.categoryName}</p>
                <p className="mt-1 text-xs text-fr-muted">
                  Técnico: {e.technicalSummaryStatus} · Advertencias: {e.warningCount}
                </p>
                <p className="mt-1 text-xs text-fr-muted">Evaluación: Pendiente (aún no habilitada)</p>
              </div>
              <Link
                href={`/jurado/concursos/${contestId}/obras/${e.entryId}`}
                className="fr-btn fr-btn-primary inline-flex min-h-11 px-5 py-3 text-sm"
              >
                Ver detalle
              </Link>
            </li>
          ))}
          {data.entries.length === 0 ? (
            <li className="text-fr-muted">No hay obras confirmadas disponibles en tus categorías.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
