import Link from "next/link";
import { UserCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { listCollaborators } from "@/lib/coverages/repository";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBER_STATUS_LABELS } from "@/lib/members/status-labels";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { ColaboradorRow } from "./colaborador-row";

export const dynamic = "force-dynamic";

/**
 * Quién puede participar de las convocatorias de este workspace.
 *
 * El módulo de coberturas no tiene padrón propio: los colaboradores salen de Socios. Por eso
 * esta pantalla depende de dos cosas que pueden faltar, y las dos se explican con todas las
 * letras en vez de mostrar una lista vacía sin motivo (ver los cuidados del plan):
 * 1. que el módulo Socios esté encendido en este workspace;
 * 2. que ese padrón tenga al menos un socio cargado.
 *
 * Administrar colaboradores es tarea de coordinación (`requireCoveragesCoordinator`, no
 * `requireCoveragesReviewer`): activar o apagar el perfil de alguien decide quién ve el
 * portal entero, no es una tarea de revisión.
 */
export default async function ColaboradoresPage() {
  const { workspace } = await requireCoveragesCoordinator();

  const sociosEncendido = await isModuleEnabledForWorkspace(workspace.id, MEMBERS_MODULE_KEY);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colaboradores"
        description="Quiénes del padrón están habilitados para ver convocatorias y anotarse."
      />

      {!sociosEncendido ? (
        <AvisoVacio
          titulo="El módulo Socios no está encendido en este workspace"
          texto="Los colaboradores de coberturas salen del padrón de socios. Encendé el módulo Socios para esta organización y volvé acá para marcar quiénes participan."
        />
      ) : (
        <ListaDeSocios workspaceId={workspace.id} />
      )}
    </div>
  );
}

async function ListaDeSocios({ workspaceId }: { workspaceId: string }) {
  const socios = await listCollaborators({ workspaceId });

  if (socios.length === 0) {
    return (
      <AvisoVacio
        titulo="Todavía no hay socios cargados"
        texto="Sin socios en el padrón no hay a quién marcar como colaborador. Cargá el padrón en Socios y volvé acá."
        href="/members"
        hrefLabel="Ir al padrón de socios"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="w-full text-sm text-left min-w-[720px]">
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            <th className="px-4 py-3 font-semibold">Socio</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold w-24">Colaborador</th>
            <th className="px-4 py-3 font-semibold">Ciudad</th>
            <th className="px-4 py-3 font-semibold">Zonas</th>
            <th className="px-4 py-3 font-semibold w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
          {socios.map((s) => (
            <ColaboradorRow
              key={s.id}
              memberId={s.id}
              nombre={`${s.lastName}, ${s.firstName}`}
              memberNumber={s.memberNumber}
              memberStatusLabel={MEMBER_STATUS_LABELS[s.status]}
              perfil={s.coverageProfile}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AvisoVacio({
  titulo,
  texto,
  href,
  hrefLabel,
}: {
  titulo: string;
  texto: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
        <UserCheck className="size-7" aria-hidden />
      </div>
      <div className="space-y-2 max-w-md">
        <p className="text-base font-semibold text-[var(--fo-text)]">{titulo}</p>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{texto}</p>
      </div>
      {href ? (
        <Link href={href} className="fo-btn fo-btn-primary text-sm">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}
