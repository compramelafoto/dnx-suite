import { getPublicResultsPayload } from "../../../lib/fotorank/results/public-results-payload";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const payload = await getPublicResultsPayload({ contestSlug: slug });
  if (!payload.published) {
    return {
      title: "Resultados no publicados",
      robots: { index: false, follow: false, nocache: true },
    };
  }
  return {
    title: `Resultados — ${payload.contest.title}`,
    description: payload.stagingTest
      ? "Publicación de prueba staging — no oficial"
      : `Resultados oficiales de ${payload.contest.title}`,
    robots: payload.stagingTest
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function PublicContestResultsPage({ params }: Props) {
  const { slug } = await params;
  const payload = await getPublicResultsPayload({ contestSlug: slug });

  if (!payload.published) {
    return (
      <main className="min-h-screen bg-fr-bg px-6 py-16 text-fr-primary">
        <div className="mx-auto max-w-2xl space-y-4" data-testid="public-results-not-published">
          <h1 className="text-3xl font-semibold">Resultados</h1>
          <p className="text-fr-muted leading-relaxed">Resultados todavía no publicados.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-fr-bg px-6 py-16 text-fr-primary">
      <div className="mx-auto max-w-3xl space-y-10" data-testid="public-results-live">
        <header className="space-y-4">
          <p className="fr-eyebrow text-gold">Resultados</p>
          <h1 className="text-3xl font-semibold md:text-4xl">{payload.contest.title}</h1>
          {payload.stagingTest ? (
            <p className="text-sm text-amber-200">STAGING_TEST_PUBLICATION — no oficial</p>
          ) : null}
          <p className="text-sm text-fr-muted">
            Publicado {payload.publishedAt ?? "—"} · {payload.timezone}
          </p>
          {!payload.scoresVisible ? (
            <p className="text-sm text-fr-muted">Los puntajes no se publican.</p>
          ) : null}
        </header>

        {payload.categories.map((cat) => (
          <section key={cat.slug} className="fr-recuadro space-y-4 border border-fr-border bg-fr-card">
            <h2 className="text-xl font-semibold">{cat.name}</h2>
            <div>
              <h3 className="text-sm font-semibold text-gold mb-2">Ganadores</h3>
              <ul className="text-sm space-y-1">
                {cat.winners.length === 0 ? (
                  <li className="text-fr-muted">Sin ganadores en payload</li>
                ) : (
                  cat.winners.map((w) => (
                    <li key={`${w.awardType}-${w.anonymousCode}`}>
                      {w.awardType}: {w.anonymousCode}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gold mb-2">Finalistas</h3>
              <ul className="text-sm space-y-1">
                {cat.finalists.map((f) => (
                  <li key={f.anonymousCode}>{f.anonymousCode}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
