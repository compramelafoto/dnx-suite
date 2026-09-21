import Link from "next/link";
import { Button } from "@repo/design-system";

import { listJudgesForOrg } from "../../actions/judges";
import { EmptyState } from "../../components/public-ui";
import { JudgeCard } from "../../components/jurados/JudgeCard";
import { judgeAvatarSrc } from "../../lib/fotorank/judges/judgeAvatarSrc";
import { presentJudgeAccountStatus } from "../../lib/fotorank/judges/ui/judgeStatus";

export default async function JuradosPage() {
  const result = await listJudgesForOrg();
  const jurados = result.ok ? (result.data ?? []) : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-fr-primary">Jurados</h1>
          {result.ok ? (
            <p className="mt-1 text-sm text-fr-muted">
              {jurados.length === 1 ? "1 jurado" : `${jurados.length} jurados`} en tu organización
            </p>
          ) : null}
        </div>
        <Link href="/jurados/nuevo">
          <Button>Nuevo jurado</Button>
        </Link>
      </div>

      {!result.ok ? (
        <div className="fr-recuadro border border-fr-border bg-fr-card">
          <p className="text-sm text-red-300">{result.error}</p>
        </div>
      ) : jurados.length === 0 ? (
        <EmptyState
          title="Todavía no hay jurados"
          description="Podés cargar uno a mano, o compartir el enlace de postulación para que los fotógrafos se presenten solos."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/jurados/nuevo">
                <Button>Cargar uno a mano</Button>
              </Link>
              <Link href="/jurados/directorio">
                <Button variant="outline">Buscar en el directorio</Button>
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
    </div>
  );
}
