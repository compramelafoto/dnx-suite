import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarClock, Camera, ListChecks, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getPublicRaffle } from "@/lib/raffles/consultas";
import type { RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";
import StatusBadge from "@/components/raffles/StatusBadge";
import PrizeShowcase from "@/components/raffles/PrizeShowcase";
import LogosBanner from "@/components/raffles/LogosBanner";
import Countdown from "@/components/raffles/Countdown";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicRaffle(id).catch(() => null);
  if (!data) return { title: "Sorteo | CompraMeLaFoto" };
  const imagen = data.raffle.coverImageUrl || data.raffle.prizes.find((p) => p.imageUrl)?.imageUrl;
  return {
    title: `${data.raffle.title} | CompraMeLaFoto`,
    description: "Sorteo para los fotógrafos que venden en CompraMeLaFoto, con resultado verificable.",
    ...(imagen ? { openGraph: { images: [imagen] }, twitter: { card: "summary_large_image", images: [imagen] } } : {}),
  };
}

export default async function SorteoPublicoPage({ params }: Props) {
  const { id } = await params;
  const data = await getPublicRaffle(id).catch(() => null);
  if (!data) notFound();
  const { raffle: r, verification: v, check, logos } = data;
  const status = r.status as RaffleStatus;
  const ultimoDia = new Date(r.salesTo.getTime() - 1);
  const porPosicion = new Map(r.entries.map((e) => [e.position, e]));
  const sorteado = status === "SORTEADO" || status === "CERRADO";
  const ganadorDe = (p: (typeof r.prizes)[number]) => {
    const g = p.award && p.award.status !== "ANULADO" ? porPosicion.get(p.award.winnerPosition) : null;
    return g ? g.displayNameSnapshot : null;
  };

  return (
    <main className="bg-[#fafaf9]">
      {/* Portada */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1c130b] via-[#3d2614] to-[#8a5528] text-white">
        {r.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- portada subida a R2
          <img src={r.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c130b] via-[#1c130b]/60 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-8 sm:pb-16 sm:pt-10">
          <Link href="/sorteos" className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Sorteos
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Para fotógrafos de CompraMeLaFoto
            </span>
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{r.title}</h1>
          {r.description && <p className="mt-3 max-w-2xl text-lg text-white/80">{r.description}</p>}

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            {sorteado ? (
              <p className="text-white/80">
                Sorteado el {formatArgentina(r.drawnAt ?? r.drawsAt)}
                {r.entrantsCount ? ` entre ${r.entrantsCount} fotógrafos` : ""}.
              </p>
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Falta para el sorteo</p>
                <Countdown to={r.drawsAt.toISOString()} />
                <p className="mt-2 text-sm text-white/70">{formatArgentina(r.drawsAt)}</p>
              </div>
            )}
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-3xl font-bold">{r.prizes.length}</p>
                <p className="text-white/60">{r.prizes.length === 1 ? "premio" : "premios"}</p>
              </div>
              {r.entrantsCount ? (
                <div>
                  <p className="text-3xl font-bold">{r.entrantsCount}</p>
                  <p className="text-white/60">participantes</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {logos.length > 0 && (
        <section className="border-b border-[#111827]/5 bg-white py-6">
          <div className="mx-auto max-w-5xl px-4">
            <LogosBanner logos={logos} />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-5xl space-y-14 px-4 py-12">
        {/* Premios */}
        <section>
          <h2 className="text-2xl font-bold text-[#111827]">{sorteado ? "Premios y ganadores" : "Qué se sortea"}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {r.prizes.map((p) => (
              <PrizeShowcase
                key={p.id}
                order={p.order}
                title={p.title}
                description={p.description}
                imageUrl={p.imageUrl}
                sponsorName={p.sponsorName}
                sponsorLogoUrl={p.sponsorLogoUrl}
                sponsorUrl={p.sponsorUrl}
                estimatedValueArs={p.estimatedValueArs}
                winner={ganadorDe(p)}
              />
            ))}
          </div>
        </section>

        {/* Cómo participar */}
        {!sorteado && (
          <section className="rounded-3xl border border-[#111827]/10 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-[#111827]">Cómo participar</h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              <li>
                <Camera className="h-7 w-7 text-[#c27b3d]" />
                <p className="mt-3 font-semibold text-[#111827]">Vendé tus fotos</p>
                <p className="mt-1 text-sm text-[#4b5563]">
                  {r.minSales <= 1 ? "Con una venta pagada" : `Con ${r.minSales} ventas pagadas`} del {formatArgentina(r.salesFrom, false)} al{" "}
                  {formatArgentina(ultimoDia, false)} ya entrás.
                </p>
              </li>
              <li>
                <ListChecks className="h-7 w-7 text-[#c27b3d]" />
                <p className="mt-3 font-semibold text-[#111827]">No hace falta anotarse</p>
                <p className="mt-1 text-sm text-[#4b5563]">
                  La lista se arma sola y se cierra el {formatArgentina(r.entriesCloseAt)}. Lo ves en el inicio de tu panel.
                </p>
              </li>
              <li>
                <CalendarClock className="h-7 w-7 text-[#c27b3d]" />
                <p className="mt-3 font-semibold text-[#111827]">Esperá el sorteo</p>
                <p className="mt-1 text-sm text-[#4b5563]">
                  Se sortea el {formatArgentina(r.drawsAt)}. Si ganás, te llega un correo para coordinar la entrega.
                </p>
              </li>
            </ol>
          </section>
        )}

        {/* Verificación */}
        <section className="rounded-3xl border border-[#111827]/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-[#111827]">
            <ShieldCheck className="h-6 w-6 text-[#c27b3d]" /> Cómo se comprueba
          </h2>
          {r.entrantsHash ? (
            <div className="mt-4 space-y-4">
              <p className="text-[#374151]">
                La lista de participantes se cerró el {r.sealedAt ? formatArgentina(r.sealedAt) : "—"} y en ese momento se publicó su
                huella: un código que cambia si se toca un solo nombre. El ganador sale de combinar esa huella con el número de la
                tanda {r.drandRound} de drand, un servicio público que genera números al azar que nadie puede prever ni elegir. Como
                la tanda quedó fijada al anunciar y la lista se cerró antes de que ese número existiera, nadie pudo acomodar el
                resultado.
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-[#fafafa] p-4">
                  <dt className="text-xs font-semibold uppercase text-[#9ca3af]">Huella de la lista</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-[#374151]">{r.entrantsHash}</dd>
                </div>
                {v && (
                  <div className="rounded-2xl bg-[#fafafa] p-4">
                    <dt className="text-xs font-semibold uppercase text-[#9ca3af]">Número de drand (tanda {v.round})</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-[#374151]">{v.randomness}</dd>
                    <a href={v.drandUrl} className="mt-2 inline-block text-xs font-semibold text-[#c27b3d] hover:underline" target="_blank" rel="noreferrer">
                      Verlo en drand →
                    </a>
                  </div>
                )}
              </dl>
              {check && (
                <p className={`rounded-2xl p-4 text-sm font-medium ${check.ok ? "bg-[#ecfdf5] text-[#065f46]" : "bg-red-50 text-red-700"}`}>
                  {check.ok
                    ? "✓ Comprobado: la lista publicada da la huella publicada, y la cuenta da los mismos ganadores."
                    : `La comprobación encontró diferencias: ${check.mismatches.join(" ")}`}
                </p>
              )}
              <details className="group rounded-2xl border border-[#111827]/10 p-4 text-sm">
                <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[#111827]">
                  <Users className="h-4 w-4 text-[#c27b3d]" /> Lista de participantes ({r.entries.length})
                </summary>
                <ol className="mt-4 grid gap-x-6 gap-y-1 text-[#4b5563] sm:grid-cols-2">
                  {r.entries.map((e) => (
                    <li key={e.position} className="flex gap-2">
                      <span className="w-8 shrink-0 text-right tabular-nums text-[#9ca3af]">{e.position}.</span>
                      <span>
                        {e.displayNameSnapshot} <span className="text-[#9ca3af]">· N.º {e.codeSnapshot}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          ) : (
            <p className="mt-4 text-[#374151]">
              La lista de participantes se cierra el {formatArgentina(r.entriesCloseAt)} y en ese momento se publica su huella. El
              número que decide es el de la tanda {r.drandRound} de drand, que todavía no existe: sale recién en el momento del
              sorteo. Así nadie puede saber de antemano quién gana.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
