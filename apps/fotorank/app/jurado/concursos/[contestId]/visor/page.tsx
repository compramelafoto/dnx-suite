import { notFound, redirect } from "next/navigation";

import { requireJudgeAuth } from "../../../../lib/judge-auth";
import { JuryError, hasAcceptedJuryTerms } from "../../../../lib/fotorank/jury";
import { colaParaElVisor } from "../../../../lib/fotorank/jury/visor-service";
import { VisorDeCalificacion } from "./VisorDeCalificacion";

type Props = { params: Promise<{ contestId: string }> };

/**
 * Donde el jurado califica de verdad.
 *
 * Trae toda su tanda de una sola vez: el visor se mueve con el teclado y no
 * recarga entre foto y foto, así que los datos tienen que estar antes.
 */
export default async function VisorPage({ params }: Props) {
  const judge = await requireJudgeAuth();
  const { contestId } = await params;

  let cola: Awaited<ReturnType<typeof colaParaElVisor>>;
  try {
    cola = await colaParaElVisor({ judgeAccountId: judge.id, contestId });
  } catch (err) {
    if (err instanceof JuryError && err.code === "CONTEST_NOT_FOUND") notFound();
    if (err instanceof JuryError && (err.code === "NOT_ASSIGNED" || err.code === "FORBIDDEN")) {
      redirect("/jurado/panel");
    }
    throw err;
  }

  // Los términos se aceptan en la pantalla de obras, que es donde se explican.
  const acepto = await hasAcceptedJuryTerms({ judgeAccountId: judge.id, contestId });
  if (!acepto) redirect(`/jurado/concursos/${contestId}`);

  return <VisorDeCalificacion contestId={contestId} cola={cola} />;
}
