import Link from "next/link";
import { Card, Button, Badge } from "@repo/design-system";
import { listJudgeAssignmentsForCurrentJudge } from "../../../actions/judges";
import { requireJudgeAuth } from "../../../lib/judge-auth";
import { StatusBadge } from "../../../components/public-ui";
import { presentJudgeAssignmentStatus } from "../../../lib/fotorank/judges/ui/judgeStatus";

/** Lo que esta pantalla necesita de cada asignación, venga de la base que venga. */
type AsignacionDelPanel = {
  id: string;
  contestId: string;
  contestTitle: string;
  categoryName: string;
  assignmentStatus: string;
  platformLabel: string;
  evaluationAllowed: boolean;
  evaluationBlockMessage?: string | null;
};

/** Un concurso con todas las categorías que le tocan a este jurado. */
type ConcursoACalificar = {
  contestId: string;
  titulo: string;
  plataforma: string;
  categorias: string[];
  habilitado: boolean;
  motivoBloqueo: string | null;
  estado: string;
};

/**
 * Agrupa por concurso.
 *
 * Una asignación es por categoría, pero se califica por concurso: el visor
 * trae de una vez todas las obras que le tocan al jurado. Mostrar una tarjeta
 * por categoría daba varios botones que llevaban al mismo lugar.
 */
function agruparPorConcurso(asignaciones: AsignacionDelPanel[]): ConcursoACalificar[] {
  const porConcurso = new Map<string, ConcursoACalificar>();
  for (const a of asignaciones) {
    const id = String(a.contestId);
    const actual = porConcurso.get(id);
    if (!actual) {
      porConcurso.set(id, {
        contestId: id,
        titulo: a.contestTitle,
        plataforma: a.platformLabel,
        categorias: [a.categoryName],
        habilitado: a.evaluationAllowed,
        motivoBloqueo: a.evaluationAllowed ? null : (a.evaluationBlockMessage ?? null),
        estado: String(a.assignmentStatus),
      });
      continue;
    }
    if (!actual.categorias.includes(a.categoryName)) actual.categorias.push(a.categoryName);
    // Alcanza con una categoría habilitada para poder entrar.
    if (a.evaluationAllowed) {
      actual.habilitado = true;
      actual.motivoBloqueo = null;
      actual.estado = String(a.assignmentStatus);
    }
  }
  return [...porConcurso.values()];
}

/**
 * Los concursos que este jurado tiene para calificar.
 *
 * Hay un solo método de calificación: el de la rúbrica, con las obras
 * congeladas y repartidas por vacante. El botón lleva a la pantalla del
 * concurso, que pide aceptar los términos la primera vez y después abre el
 * visor. El método viejo —un puntaje único sobre todas las obras de la
 * categoría— se quitó el 2026-09-24.
 */
export default async function JudgePanelPage() {
  const judge = await requireJudgeAuth();
  const assignments = await listJudgeAssignmentsForCurrentJudge();
  const concursos = assignments.ok
    ? agruparPorConcurso((assignments.data?.assignments ?? []) as AsignacionDelPanel[])
    : [];
  const nombre = judge.profile
    ? `${judge.profile.firstName} ${judge.profile.lastName}`.trim()
    : judge.email;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="fr-eyebrow text-gold">Como jurado</p>
        <h1 className="text-3xl font-semibold tracking-tight text-fr-primary">
          Concursos a calificar
        </h1>
        <p className="text-sm text-fr-muted">{nombre}</p>
      </header>

      {!assignments.ok ? (
        <Card>
          <p className="text-sm text-red-300">{assignments.error}</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.data?.clickatonUnavailable ? (
            <Card>
              <p className="text-sm text-amber-300" role="status">
                No pudimos traer tus concursos de Clickatón en este momento. Volvé a entrar en
                un rato; los demás se muestran igual.
              </p>
            </Card>
          ) : null}

          {concursos.length === 0 ? (
            <Card>
              <p className="text-sm text-fr-muted">
                Todavía no te asignaron ningún concurso. Escribile al organizador.
              </p>
              <p className="mt-2 text-xs text-fr-muted-soft">
                Mientras tanto podés completar tu{" "}
                <Link href="/jurado/perfil" className="underline underline-offset-2">
                  ficha de jurado
                </Link>
                .
              </p>
            </Card>
          ) : null}

          {concursos.map((c) => (
            <Card key={c.contestId}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-fr-primary">{c.titulo}</h2>
                  <p className="text-sm text-fr-muted">
                    {c.categorias.length === 1 ? "Categoría" : "Categorías"}:{" "}
                    {c.categorias.join(", ")}
                  </p>
                  {c.motivoBloqueo ? (
                    <p className="pt-1 text-xs text-amber-200/90">{c.motivoBloqueo}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant="default">{c.plataforma}</Badge>
                    <span title={presentJudgeAssignmentStatus(c.estado).description}>
                      <StatusBadge {...presentJudgeAssignmentStatus(c.estado)} />
                    </span>
                  </div>
                  {c.habilitado ? (
                    <Link href={`/jurado/concursos/${c.contestId}`}>
                      <Button size="sm" className="w-full sm:w-auto">
                        Calificar obras
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="w-full cursor-not-allowed opacity-60 sm:w-auto"
                    >
                      Todavía no se puede calificar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
