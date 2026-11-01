import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { parseDedupMode, parsePollKind, voteTotals } from "@/lib/live-raffles/rules";
import { entrantCookieName, loadLiveRaffleByCode } from "@/lib/live-raffles/server";
import { registerLiveRaffleEntrantAction, voteLiveRafflePollAction } from "./actions";
import { LogosBanner, sponsorLogos } from "./logos-banner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const sorteo = await prisma.liveRaffle.findUnique({ where: { publicCode: code }, select: { title: true } });
  return { title: sorteo ? `Sorteo · ${sorteo.title}` : "Sorteo", robots: { index: false, follow: false } };
}

/** La página que abre el QR: anotarse y, después, votar las encuestas. */
export default async function SorteoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { code } = await params;
  const aviso = await searchParams;
  const sorteo = await loadLiveRaffleByCode(code);
  if (!sorteo) notFound();

  const cookieId = (await cookies()).get(entrantCookieName(sorteo.id))?.value;
  const yo = cookieId
    ? await prisma.liveRaffleEntrant.findFirst({
        where: { id: cookieId, liveRaffleId: sorteo.id },
        select: { id: true, firstName: true },
      })
    : null;
  const conDni = parseDedupMode(sorteo.dedupMode) === "CELULAR_DNI";
  const bases = sorteo.rulesText?.trim();
  const polls = sorteo.polls.filter((p) => p.isOpen || (yo && p.votes.some((v) => v.entrantId === yo.id)));
  const logos = sponsorLogos(sorteo.sponsors, sorteo.prizes);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-8">
        <header className="space-y-3 text-center">
          {sorteo.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
            <img src={sorteo.logoUrl} alt="" className="mx-auto h-20 w-auto max-w-[16rem] object-contain" />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{sorteo.title}</h1>
          {sorteo.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{sorteo.description}</p>
          ) : null}
        </header>

        {aviso.error ? (
          <p className="fo-alert-error p-4 text-sm" role="alert">
            {aviso.error}
          </p>
        ) : null}

        {yo ? (
          <div className="fo-card space-y-1 p-5 text-center">
            <p className="text-lg font-semibold">¡Ya estás participando, {yo.firstName}!</p>
            <p className="text-sm text-[var(--fo-muted)]">Quedate cerca: el sorteo se hace en vivo, en la pantalla.</p>
          </div>
        ) : !sorteo.registrationOpen ? (
          <div className="fo-card p-5 text-center text-sm">La inscripción para este sorteo ya está cerrada.</div>
        ) : (
          <form action={registerLiveRaffleEntrantAction} className="fo-card space-y-4 p-5">
            <input type="hidden" name="code" value={sorteo.publicCode} />
            <p className="text-base font-semibold">Anotate para participar</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="firstName">
                  Nombre
                </label>
                <input id="firstName" name="firstName" className="fo-input" required autoComplete="given-name" />
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="lastName">
                  Apellido
                </label>
                <input id="lastName" name="lastName" className="fo-input" required autoComplete="family-name" />
              </div>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="phone">
                Celular
              </label>
              <input id="phone" name="phone" type="tel" inputMode="tel" className="fo-input" required autoComplete="tel" />
              <p className="fo-helper">Si ganás, te contactamos a este número.</p>
            </div>
            {conDni ? (
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="dni">
                  DNI
                </label>
                <input id="dni" name="dni" inputMode="numeric" className="fo-input" required placeholder="Sin puntos" />
              </div>
            ) : null}
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="email">
                Correo
              </label>
              <input id="email" name="email" type="email" className="fo-input" required autoComplete="email" />
            </div>
            {bases ? (
              <div className="space-y-2">
                <details className="rounded-md border border-[var(--fo-border)] p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Leer bases y condiciones</summary>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--fo-muted)]">{bases}</p>
                </details>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="acceptRules" required className="mt-1" />
                  Leí y acepto las bases y condiciones.
                </label>
              </div>
            ) : null}
            <button type="submit" className="fo-btn fo-btn-primary w-full">
              Participar
            </button>
          </form>
        )}

        {yo && polls.length > 0 ? (
          <section id="encuestas" className="space-y-3">
            <h2 className="text-lg font-semibold">Encuestas</h2>
            {polls.map((poll) => {
              const miVoto = poll.votes.find((v) => v.entrantId === yo.id);
              const esTexto = parsePollKind(poll.kind) === "TEXTO";
              if (miVoto || !poll.isOpen) {
                if (esTexto) {
                  return (
                    <div key={poll.id} className="fo-card space-y-2 p-5 text-sm">
                      <p className="font-medium">{poll.question}</p>
                      {miVoto?.text ? (
                        <p className="whitespace-pre-line text-[var(--fo-muted)]">{miVoto.text}</p>
                      ) : null}
                      <p className="text-[var(--fo-muted)]">{miVoto ? "¡Gracias por tu respuesta!" : "La pregunta ya cerró."}</p>
                    </div>
                  );
                }
                const totales = voteTotals(poll.options.length, poll.votes);
                const otras = poll.votes.filter((v) => v.optionIndex === null).length;
                const filas = [
                  ...poll.options.map((o, i) => ({ label: o, n: totales[i], mio: miVoto?.optionIndex === i })),
                  ...(poll.allowOther ? [{ label: "Otra", n: otras, mio: !!miVoto && miVoto.optionIndex === null }] : []),
                ];
                const total = poll.votes.length || 1;
                return (
                  <div key={poll.id} className="fo-card space-y-3 p-5 text-sm">
                    <p className="font-medium">{poll.question}</p>
                    {filas.map((f, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between gap-3">
                          <span className={f.mio ? "font-semibold" : ""}>
                            {f.label} {f.mio ? "· tu voto" : ""}
                          </span>
                          <span className="tabular-nums text-[var(--fo-muted)]">{Math.round((f.n / total) * 100)} %</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--fo-border-muted)]">
                          <div className="h-2 rounded-full bg-[var(--fo-accent)]" style={{ width: `${(f.n / total) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <form key={poll.id} action={voteLiveRafflePollAction} className="fo-card space-y-3 p-5 text-sm">
                  <input type="hidden" name="code" value={sorteo.publicCode} />
                  <input type="hidden" name="pollId" value={poll.id} />
                  <p className="font-medium">{poll.question}</p>
                  {esTexto ? (
                    <textarea name="text" rows={4} required maxLength={2000} className="fo-input" placeholder="Escribí tu respuesta" />
                  ) : (
                    <>
                      {poll.options.map((o, i) => (
                        <label key={i} className="flex items-center gap-3 rounded-md border border-[var(--fo-border)] p-3">
                          <input type="radio" name="optionIndex" value={i} required />
                          {o}
                        </label>
                      ))}
                      {poll.allowOther ? (
                        <label className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--fo-border)] p-3">
                          <input type="radio" name="optionIndex" value="otra" required />
                          Otra:
                          <input name="text" maxLength={200} className="fo-input min-w-0 flex-1" placeholder="Escribila acá" />
                        </label>
                      ) : null}
                    </>
                  )}
                  <button type="submit" className="fo-btn fo-btn-primary w-full">
                    {esTexto ? "Enviar" : "Votar"}
                  </button>
                </form>
              );
            })}
          </section>
        ) : null}
      </main>

      <footer className="space-y-2 pt-4">
        {logos.length > 0 ? (
          <p className="text-center text-xs uppercase tracking-wide text-[var(--fo-muted)]">Premios donados por</p>
        ) : null}
        <LogosBanner logos={logos} />
      </footer>
    </div>
  );
}
