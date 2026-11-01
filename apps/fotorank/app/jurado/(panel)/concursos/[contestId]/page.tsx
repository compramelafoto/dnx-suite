import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireJudgeAuth } from "../../../../lib/judge-auth";
import {
  JuryError,
  hasAcceptedJuryTerms,
  listAnonymousEntriesForJuror,
} from "../../../../lib/fotorank/jury";
import { baseDelConcurso } from "../../../../lib/fotorank/jury/baseDelConcurso";
import { textoDeTerminos } from "../../../../lib/fotorank/jury/terminosDelJurado";
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
   * Esta pantalla ya no es un destino: es sólo donde se aceptan los términos
   * la primera vez. El visor reemplazó a la grilla de miniaturas y sabe decir
   * por qué no hay obras (la evaluación no abrió, no te tocó ninguna).
   *
   * Antes sólo las maratones seguían de largo. En un concurso de FotoRank el
   * jurado quedaba acá, frente a una grilla con "Técnico" y "Advertencias", y
   * si la organización no había congelado las obras leía "No hay obras
   * confirmadas disponibles" sin saber si era un error ni qué hacer.
   */
  if (termsAccepted) {
    redirect(`/jurado/concursos/${contestId}/visor`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="fr-eyebrow">Como jurado</p>
          <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-fr-primary">
            {data.contestTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-fr-muted">
            Antes de ver la primera obra, leé y aceptá los términos del jurado. Es una sola vez
            por concurso. Las obras se muestran sin el nombre de quien las hizo.
          </p>
        </div>
        <Link href="/jurado/panel" className="text-sm text-gold hover:text-gold-hover">
          ← Mis concursos
        </Link>
      </div>

      <JuryTermsGate
        contestId={contestId}
        initiallyAccepted={termsAccepted}
        texto={textoDeTerminos(esDeClickaton)}
      />
    </div>
  );
}
