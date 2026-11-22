import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicRaffle } from "@/lib/raffles/consultas";
import { STATUS_LABELS, type RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicRaffle(id).catch(() => null);
  return { title: data ? `${data.raffle.title} | CompraMeLaFoto` : "Sorteo | CompraMeLaFoto" };
}

export default async function SorteoPublicoPage({ params }: Props) {
  const { id } = await params;
  const data = await getPublicRaffle(id).catch(() => null);
  if (!data) notFound();
  const { raffle: r, verification: v, check } = data;
  const ultimoDia = new Date(r.salesTo.getTime() - 1);
  const porPosicion = new Map(r.entries.map((e) => [e.position, e]));

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div>
        <Link href="/sorteos" className="text-sm text-gray-500 hover:underline">
          ← Sorteos
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{r.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{STATUS_LABELS[r.status as RaffleStatus] ?? r.status}</p>
        {r.description && <p className="mt-3 text-gray-700">{r.description}</p>}
      </div>

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Quiénes participan</p>
          <p className="text-gray-900">
            Fotógrafos con {r.minSales <= 1 ? "al menos una venta" : `al menos ${r.minSales} ventas`} en CompraMeLaFoto del{" "}
            {formatArgentina(r.salesFrom, false)} al {formatArgentina(ultimoDia, false)}. No hace falta anotarse.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Sorteo</p>
          <p className="text-gray-900">{formatArgentina(r.drawsAt)}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Premios</h2>
        {r.prizes.map((p) => {
          const g = p.award && p.award.status !== "ANULADO" ? porPosicion.get(p.award.winnerPosition) : null;
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-semibold text-gray-900">
                {p.order}. {p.title}
                {p.sponsorName ? <span className="font-normal text-gray-500"> · {p.sponsorName}</span> : null}
              </p>
              {p.description && <p className="text-sm text-gray-600">{p.description}</p>}
              {g && (
                <p className="mt-2 text-sm font-medium text-green-800">
                  Ganó: {g.displayNameSnapshot} (cuenta N.º {g.codeSnapshot})
                </p>
              )}
            </div>
          );
        })}
      </section>

      {r.entrantsHash ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Cómo se comprueba</h2>
          <p className="text-sm text-gray-700">
            La lista de participantes se cerró el {r.sealedAt ? formatArgentina(r.sealedAt) : "—"} y en ese momento se
            publicó su huella (un código que cambia si se toca un solo nombre de la lista). El ganador sale de combinar esa
            huella con el número de la tanda {r.drandRound} de drand, un servicio público que genera números al azar
            que nadie puede prever ni elegir. Como la tanda quedó fijada al anunciar el sorteo y la lista se cerró antes de
            que ese número existiera, ninguna de las dos partes pudo acomodarse a la otra.
          </p>
          <p className="break-all text-xs text-gray-500">
            Huella de la lista: <code>{r.entrantsHash}</code>
          </p>
          {v && (
            <p className="break-all text-xs text-gray-500">
              Número de drand (tanda {v.round}): <code>{v.randomness}</code> ·{" "}
              <a href={v.drandUrl} className="underline" target="_blank" rel="noreferrer">
                verlo en drand
              </a>
            </p>
          )}
          {check && (
            <p className={`rounded-lg p-3 text-sm ${check.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {check.ok
                ? "Comprobado: la lista publicada da la huella publicada, y la cuenta da los mismos ganadores."
                : `La comprobación encontró diferencias: ${check.mismatches.join(" ")}`}
            </p>
          )}
          <details className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-gray-900">
              Lista de participantes ({r.entries.length})
            </summary>
            <ol className="mt-3 space-y-1 text-gray-700">
              {r.entries.map((e) => (
                <li key={e.position}>
                  {e.position}. Cuenta N.º {e.codeSnapshot} · {e.displayNameSnapshot}
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : (
        <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
          La lista de participantes se cierra el {formatArgentina(r.entriesCloseAt)}. El número que decide el sorteo es el
          de la tanda {r.drandRound} de drand, que todavía no existe: sale recién en el momento del sorteo.
        </p>
      )}
    </main>
  );
}
