import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTEST_TIERS, formatArDayLong, type ContestTier } from "@repo/muestras";
import { ArmarMuestra } from "@/components/concursos/armar-muestra";
import { enlace, nota } from "@/components/concursos/estilos";
import { muestrasDeEsteConcurso, muestrasParaSumar } from "@/lib/concursos/consultas";
import { mensajeDeResultados, puedeArmarDesdeConcurso, resultadosDelConcurso } from "@/lib/concursos/fotorank";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Armar una muestra desde un concurso" };

type Props = { params: Promise<{ contestId: string }> };

/** Elegir niveles y destino y armar la muestra (etapa 7, D7 y D8). Sólo la organización del concurso. */
export default async function ArmarDesdeConcurso({ params }: Props) {
  const { contestId } = await params;
  const usuario = await requireUsuario(`/panel/concursos/${encodeURIComponent(contestId)}`);
  if (!(await puedeArmarDesdeConcurso(usuario, contestId))) notFound();
  const r = await resultadosDelConcurso(usuario, contestId);
  if (!r.ok && r.motivo === "NO_EXISTE") notFound();

  const volver = <Link href="/panel/concursos" className={`text-sm ${enlace}`}>Volver a Concursos</Link>;
  if (!r.ok) {
    return (
      <main className="max-w-3xl space-y-6">
        {volver}
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Armar una muestra</h1>
        <p className="text-lg">{mensajeDeResultados(r.motivo)}</p>
      </main>
    );
  }

  const [destinos, yaArmadas] = await Promise.all([muestrasParaSumar(usuario), muestrasDeEsteConcurso(usuario, contestId)]);
  const counts = Object.fromEntries(CONTEST_TIERS.map((t) => [t, r.works.filter((w) => w.tier === t).length])) as Record<ContestTier, number>;
  const fecha = r.batch.date
    ? `Resultados ${r.batch.status === "PUBLISHED" ? "publicados" : "cerrados por el jurado"} el ${formatArDayLong(r.batch.date)}.`
    : null;

  return (
    <main className="max-w-3xl space-y-8">
      {volver}
      <header className="space-y-3">
        <p className={nota}>{r.contest.organizationName}</p>
        <h1 className="mf-titulo break-words text-[clamp(2.2rem,4vw,3rem)]">{r.contest.title}</h1>
        {fecha ? <p className="text-lg text-[var(--mf-muted)]">{fecha}</p> : null}
      </header>
      {yaArmadas.length ? (
        <p className="text-[15px]">
          Ya armaste:{" "}
          {yaArmadas.map((m, i) => (
            <span key={m.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/panel/muestras/${m.id}/concurso`} className={enlace}>{m.title}</Link>
            </span>
          ))}
          . Podés armar otra (por ejemplo, una itinerante) o actualizarla desde su página.
        </p>
      ) : null}
      {r.works.length === 0 ? (
        <p className="text-lg">El jurado cerró los resultados, pero ninguna obra tiene premio, mención ni preselección.</p>
      ) : (
        <ArmarMuestra contestId={r.contest.id} counts={counts} destinos={destinos.map((d) => ({ id: d.id, title: d.title }))} />
      )}
    </main>
  );
}
