import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireJudgeAuth } from "../../../lib/judge-auth";
import {
  JuryError,
  hasAcceptedJuryTerms,
  listAnonymousEntriesForJuror,
} from "../../../lib/fotorank/jury";
import { baseDelConcurso } from "../../../lib/fotorank/jury/baseDelConcurso";
import { textoDeTerminos } from "../../../lib/fotorank/jury/terminosDelJurado";
import { JuryTermsGate } from "./JuryTermsGate";

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

  const termsAccepted = await hasAcceptedJuryTerms({
    judgeAccountId: judge.id,
    contestId,
  });
  const { esDeClickaton } = await baseDelConcurso(contestId);

  /*
   * En una maratón esta pantalla ya no es un destino: es sólo donde se aceptan
   * los términos la primera vez. El visor reemplazó a la grilla de miniaturas,
   * y el "Ver detalle" de cada tarjeta lleva al motor viejo, que con el lote
   * congelado redirige igual. Dejarla en el medio obligaba a un clic de más y,
   * si algo fallaba, a un callejón sin salida del que sólo se salía escribiendo
   * la dirección del visor a mano.
   */
  if (termsAccepted && esDeClickaton) {
    redirect(`/jurado/concursos/${contestId}/visor`);
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
              Solo obras congeladas / asignadas de tus categorías. No se muestra identidad del
              participante.
            </p>
            {data.judgingEndsAt ? (
              <p className="mt-2 text-xs text-fr-muted">Cierre de evaluación: {data.judgingEndsAt}</p>
            ) : null}
          </div>
          <Link href="/jurado/panel" className="text-sm text-gold hover:text-gold-hover">
            ← Volver al panel
          </Link>
        </div>

        <JuryTermsGate
          contestId={contestId}
          initiallyAccepted={termsAccepted}
          texto={textoDeTerminos(esDeClickaton)}
        />

        {!termsAccepted ? (
          <p className="text-sm text-amber-200" data-testid="jury-entries-blocked-terms">
            Debés aceptar los términos de jurado antes de ver u evaluar obras.
          </p>
        ) : (
          <>
            <div className="fr-recuadro border border-fr-border bg-fr-card">
              <p className="text-sm text-fr-muted">
                Para calificar, el visor muestra una consigna por vez, la fotografía a pantalla
                completa y los criterios con el teclado.
              </p>
              <Link
                href={`/jurado/concursos/${contestId}/visor`}
                className="fr-btn fr-btn-primary mt-4 inline-flex min-h-11 px-5 py-3 text-sm"
              >
                Abrir el visor
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
                  <p className="mt-1 text-xs text-fr-muted">
                    Evaluación: abrir detalle para draft / submit
                  </p>
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
          </>
        )}
      </div>
    </div>
  );
}
