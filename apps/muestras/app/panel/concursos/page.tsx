import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CONTEST_TIERS, CONTEST_TIER_LABELS, REVIEW_STATUS_LABELS, formatArDayLong } from "@repo/muestras";
import { concursosParaArmar } from "@/lib/concursos/fotorank";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Concursos" };

const estado = (s: string) => {
  const t = (REVIEW_STATUS_LABELS as Record<string, string>)[s];
  return t ? ` (${t.toLowerCase()})` : "";
};

type Props = { searchParams: Promise<{ concurso?: string | string[] }> };

/** Los concursos de FotoRank con resultados cerrados de las organizaciones donde la persona arma (etapa 7). */
export default async function Concursos({ searchParams }: Props) {
  const usuario = await requireUsuario("/panel/concursos");
  // Desde el botón "Armar muestra" de FotoRank: directo al concurso (su página vuelve a pedir el permiso).
  const { concurso } = await searchParams;
  if (typeof concurso === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(concurso)) redirect(`/panel/concursos/${concurso}`);
  const concursos = await concursosParaArmar(usuario);

  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Concursos</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Llevá a la sala las obras ganadoras y seleccionadas de tus concursos de FotoRank: te armamos el borrador de la muestra con sus
          imágenes, autores y premios.
        </p>
      </header>
      {concursos.length === 0 ? (
        <p className="text-lg">
          Cuando organices un concurso en FotoRank y publiques sus resultados, lo vas a ver acá para armar la muestra.
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {concursos.map((c) => (
            <li key={c.id} className="space-y-2 border-b border-[var(--mf-line)] py-4">
              <Link href={`/panel/concursos/${c.id}`} className="mf-titulo block break-words text-xl underline-offset-[5px] hover:underline">{c.title}</Link>
              <p className="text-[13px] text-[var(--mf-muted)]">
                {c.organizationName}.{" "}
                {c.batchDate ? `Resultados ${c.batchStatus === "PUBLISHED" ? "publicados" : "cerrados por el jurado"} el ${formatArDayLong(c.batchDate)}. ` : ""}
                {CONTEST_TIERS.map((t) => `${CONTEST_TIER_LABELS[t]}: ${c.counts[t]}`).join(" · ")}
              </p>
              {c.muestras.length ? (
                <p className="text-sm">
                  Ya armaste:{" "}
                  {c.muestras.map((m, i) => (
                    <span key={m.id}>
                      {i > 0 ? ", " : ""}
                      <Link href={`/panel/muestras/${m.id}/concurso`} className="underline underline-offset-4">{m.title}</Link>
                      {estado(m.reviewStatus)}
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
