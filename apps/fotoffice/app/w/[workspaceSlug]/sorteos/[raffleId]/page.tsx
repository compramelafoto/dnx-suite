import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { fechaHora } from "@/lib/raffles/labels";
import { loadPublicRaffle } from "@/lib/raffles/public";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { Bolillero } from "@/components/raffles/bolillero";
import { CuentaRegresiva } from "@/components/raffles/cuenta-regresiva";
import { PrizeCards } from "@/components/raffles/prize-cards";

export const dynamic = "force-dynamic";

// Se comparte por enlace, no se busca: los ganadores salen con nombre e inicial, y aun así no
// hace falta que el buscador los guarde.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ workspaceSlug: string; raffleId: string }> };

/**
 * El sorteo, a la vista de cualquiera: la pantalla que se proyecta en el evento y el enlace que
 * se comparte en redes.
 *
 * Tres momentos en la misma dirección:
 * 1. Antes: los premios y la cuenta regresiva.
 * 2. A la hora: la cuenta llega a cero, la página se vuelve a pedir sola y el servidor resuelve.
 * 3. Después: el bolillero cuenta el resultado y quedan los ganadores.
 */
export default async function SorteoPublicoPage({ params }: Props) {
  const { workspaceSlug, raffleId } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, RAFFLES_MODULE_KEY))) notFound();

  const v = await loadPersonVocabulary(branding.workspaceId);
  const sorteo = await loadPublicRaffle({
    workspaceId: branding.workspaceId,
    raffleId,
    memberWord: v.Singular,
  });
  if (!sorteo) notFound();

  const abierto = sorteo.status === "ANUNCIADO" || sorteo.status === "PADRON_SELLADO";
  const cancelado = sorteo.status === "CANCELADO";

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8 md:py-16">
      <header className="space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--fo-muted)]">
          Sorteo entre {v.plural} al día
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{sorteo.title}</h1>
        <p className="text-[var(--fo-muted)]">
          {cancelado
            ? "Este sorteo se canceló."
            : abierto
              ? `Se sortea el ${fechaHora(sorteo.drawsAt)}.`
              : `Se sorteó el ${fechaHora(sorteo.drawsAt)} entre ${sorteo.entrantsCount ?? 0} ${v.plural}.`}
        </p>
      </header>

      {cancelado ? (
        sorteo.cancelReason ? (
          <p className="fo-card mx-auto max-w-2xl p-6 text-center">{sorteo.cancelReason}</p>
        ) : null
      ) : sorteo.bolillero ? (
        <section className="mx-auto max-w-3xl">
          <Bolillero entrantLabels={sorteo.bolillero.entrantLabels} prizes={sorteo.bolillero.prizes} />
        </section>
      ) : sorteo.waiting ? (
        <p className="fo-alert-warning mx-auto max-w-2xl p-4 text-center">{sorteo.waiting}</p>
      ) : abierto ? (
        <section className="space-y-4">
          <CuentaRegresiva drawsAt={sorteo.drawsAt.toISOString()} />
          <p className="text-center text-sm text-[var(--fo-muted)]">
            {sorteo.status === "PADRON_SELLADO"
              ? `Participan ${sorteo.entrantsCount ?? 0} ${v.plural}. La lista ya está cerrada.`
              : `Participan los ${v.plural} que estén al día antes del ${fechaHora(sorteo.entriesCloseAt)}.`}
          </p>
        </section>
      ) : null}

      {!cancelado ? (
        <section className="space-y-5">
          <h2 className="text-center text-sm font-medium uppercase tracking-wide text-[var(--fo-muted)]">
            {sorteo.prizes.length === 1 ? "El premio" : "Los premios"}
          </h2>
          <PrizeCards prizes={sorteo.prizes} />
          {sorteo.prizes.some((p) => p.partnerName) ? (
            <p className="text-center text-sm text-[var(--fo-muted)]">
              Gracias a las marcas que acompañan a la institución.
            </p>
          ) : null}
        </section>
      ) : null}

      {sorteo.drandRound ? <ComoComprobarlo sorteo={sorteo} /> : null}

      {abierto ? (
        <p className="text-center text-sm">
          ¿Todavía no sos {v.singular}?{" "}
          <Link href={`/w/${workspaceSlug}/asociarse`} className="font-medium underline">
            Asociate
          </Link>{" "}
          y participá del próximo.
        </p>
      ) : null}
    </main>
  );
}

/**
 * Lo mínimo para que cualquiera pueda comprobar que no estuvo arreglado, sin cuenta: la huella
 * de la lista cerrada y el número público que decidió. La explicación paso a paso está en el
 * portal de los socios.
 */
function ComoComprobarlo({
  sorteo,
}: {
  sorteo: { entrantsHash: string | null; drandChainHash: string | null; drandRound: number | null };
}) {
  const enlace =
    sorteo.drandChainHash && sorteo.drandRound
      ? `https://api.drand.sh/${sorteo.drandChainHash}/public/${sorteo.drandRound}`
      : null;
  return (
    <details className="fo-card mx-auto max-w-3xl p-5 text-sm">
      <summary className="cursor-pointer font-medium">¿Cómo sé que no está arreglado?</summary>
      <div className="mt-3 space-y-2 text-[var(--fo-muted)]">
        <p>
          El ganador sale de un número público que genera una red internacional (drand) y que no
          controla nadie de la institución. Se fijó cuál número se iba a usar antes de cerrar la
          lista de participantes, y la lista se publicó con su huella antes de que ese número
          existiera.
        </p>
        {sorteo.entrantsHash ? (
          <p className="break-all">
            Huella de la lista: <code className="text-[var(--fo-text)]">{sorteo.entrantsHash}</code>
          </p>
        ) : null}
        {enlace ? (
          <p>
            Número público: tanda {sorteo.drandRound}.{" "}
            <a href={enlace} target="_blank" rel="noopener noreferrer" className="underline">
              Verlo en drand
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}
