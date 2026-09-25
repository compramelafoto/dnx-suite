import Link from "next/link";
import { Button } from "@repo/design-system";
import { prisma } from "@repo/db";

import { listJudgesForOrg } from "../../actions/judges";
import { EmptyState } from "../../components/public-ui";
import { JudgeCard } from "../../components/jurados/JudgeCard";
import { judgeAvatarSrc } from "../../lib/fotorank/judges/judgeAvatarSrc";
import { presentJudgeAccountStatus } from "../../lib/fotorank/judges/ui/judgeStatus";

/*
 * Por qué esta lista puede estar vacía aunque haya jurados aprobados.
 *
 * Hay dos listas distintas y se confundían:
 *
 * - El **directorio**: todos los jurados aprobados de FotoRank. Son de la
 *   plataforma, no de ninguna organización.
 * - **Mis jurados**: los que trabajan con esta organización. Un jurado del
 *   directorio entra acá cuando acepta una invitación a uno de sus concursos.
 *
 * Al 25/09/2026 había 6 jurados aprobados y 0 vinculados a alguna organización,
 * así que esta pantalla decía "Todavía no hay jurados" y nada más. Ahora
 * explica el circuito y dice cuántos esperan en el directorio.
 */
export default async function JuradosPage() {
  const result = await listJudgesForOrg();
  const jurados = result.ok ? (result.data ?? []) : [];
  const enElDirectorio = await prisma.fotorankJudgeProfile
    .count({
      where: {
        isListedInProfessionalDirectory: true,
        directoryReviewStatus: "APPROVED",
        judgeAccount: { accountStatus: "ACTIVE" },
      },
    })
    .catch(() => 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-fr-primary">Mis jurados</h1>
          {result.ok ? (
            <p className="mt-1 text-sm text-fr-muted">
              {jurados.length === 1 ? "1 jurado trabaja" : `${jurados.length} jurados trabajan`} con
              tu organización
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/jurados/directorio">
            <Button>Buscar jurados</Button>
          </Link>
        </div>
      </div>

      <section className="fr-recuadro border border-fr-border bg-fr-card">
        <h2 className="text-base font-semibold text-fr-primary">Cómo se suma un jurado</h2>
        <ol className="mt-3 grid gap-3 text-sm text-fr-muted md:grid-cols-3">
          <li>
            <span className="font-semibold text-gold">1.</span> Los fotógrafos se postulan como
            jurado y FotoRank revisa su ficha. Los aprobados quedan en el{" "}
            <Link href="/jurados/directorio" className="text-gold hover:text-gold-hover">
              directorio
            </Link>
            {enElDirectorio > 0 ? ` (hoy hay ${enElDirectorio})` : ""}.
          </li>
          <li>
            <span className="font-semibold text-gold">2.</span> Desde el directorio lo invitás a un
            concurso y elegís las categorías. Si alguien que querés todavía no está, pasale el{" "}
            <Link href="/jurados/postulacion" className="text-gold hover:text-gold-hover">
              enlace para postularse
            </Link>
            .
          </li>
          <li>
            <span className="font-semibold text-gold">3.</span> Cuando acepta, aparece en esta
            lista y ya puede calificar las obras que le tocan.
          </li>
        </ol>
      </section>

      {!result.ok ? (
        <div className="fr-recuadro border border-fr-border bg-fr-card">
          <p className="text-sm text-red-300">{result.error}</p>
        </div>
      ) : jurados.length === 0 ? (
        <EmptyState
          title="Ningún jurado trabaja todavía con tu organización"
          description={
            enElDirectorio > 0
              ? `Hay ${enElDirectorio} jurados aprobados en el directorio esperando una invitación. Aparecen acá cuando aceptan la tuya.`
              : "Los jurados aparecen acá cuando aceptan una invitación a uno de tus concursos."
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/jurados/directorio">
                <Button>Ver el directorio</Button>
              </Link>

            </div>
          }
        />
      ) : (
        <div className="grid gap-4">
          {jurados.map((j) => {
            const nombre = j.profile
              ? `${j.profile.firstName} ${j.profile.lastName}`.trim()
              : j.email;
            return (
              <JudgeCard
                key={j.judgeId}
                nombre={nombre || j.email}
                titular={j.profile?.professionalHeadline}
                email={j.email}
                avatarSrc={
                  j.profile
                    ? judgeAvatarSrc({ id: j.profile.id, avatarUrl: j.profile.avatarUrl })
                    : null
                }
                estado={presentJudgeAccountStatus(j.accountStatus)}
                ultimaActividad={j.lastLoginAt}
                href={`/jurados/${j.judgeId}/editar`}
                acciones={
                  <Link href={`/jurados/${j.judgeId}/editar`}>
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </Link>
                }
              >
                {j.assignmentsCount > 0 ? (
                  <p className="text-xs text-fr-muted">
                    {j.assignmentsCount === 1
                      ? "1 categoría asignada"
                      : `${j.assignmentsCount} categorías asignadas`}
                    {j.activeContests.length > 0 ? ` · ${j.activeContests.join(", ")}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-fr-muted">Sin categorías asignadas.</p>
                )}
              </JudgeCard>
            );
          })}
        </div>
      )}

      <p className="text-xs text-fr-muted">
        También:{" "}
        <Link href="/jurados/auditoria" className="text-gold hover:text-gold-hover">
          historial de cambios
        </Link>
      </p>
    </div>
  );
}
