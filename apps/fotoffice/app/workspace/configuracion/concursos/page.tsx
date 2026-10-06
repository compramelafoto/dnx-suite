import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { loadShowcaseSettings } from "@/lib/contests/load";
import { saveShowcaseAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * La vitrina de concursos del portal: qué concursos ven los socios de esta institución.
 *
 * Por omisión se muestran todos los concursos públicos de FotoRank y las maratones de Clickatón.
 * La institución puede marcar sus organizaciones de FotoRank (sus concursos van primero y con su
 * nombre), mostrar sólo los propios o apagar la vitrina.
 */
export default async function ConcursosConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);
  const params = await searchParams;
  const [membership, s, organizaciones] = await Promise.all([
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
      select: { role: true },
    }),
    loadShowcaseSettings(ensured.workspaceId),
    prisma.contestOrganization.findMany({
      where: { contests: { some: { visibility: "PUBLIC" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { contests: true } } },
    }),
  ]);
  const canEdit = canManageWorkspaceSettings(membership?.role);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-3">
        <Link href="/workspace/configuracion" className="text-sm text-[var(--fo-muted)] hover:underline">
          ← Configuración
        </Link>
        <PageHeader
          title="Vitrina de concursos"
          description="Los concursos de FotoRank y las maratones de Clickatón que ven tus socios en la portada de su portal, en la sección Concursos y en la campanita."
        />
      </div>

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-alert-success p-4 text-sm">Guardado.</p> : null}

      <form action={saveShowcaseAction} className="fo-card space-y-6 p-6">
        <fieldset className="space-y-3" disabled={!canEdit}>
          <legend className="fo-label mb-2">Qué concursos mostrar</legend>
          {[
            { v: "ALL", t: "Todos los concursos públicos", d: "Los de tu institución primero y después los demás. Recomendado." },
            { v: "OWN", t: "Sólo los de mi institución", d: "Sólo los concursos de las organizaciones que marques abajo." },
            { v: "OFF", t: "No mostrar concursos", d: "La vitrina desaparece del portal de tus socios." },
          ].map((o) => (
            <label key={o.v} className="flex items-start gap-3 text-sm">
              <input type="radio" name="mode" value={o.v} defaultChecked={s.mode === o.v} className="mt-1" />
              <span>
                <span className="font-medium">{o.t}</span>
                <span className="block text-[var(--fo-muted)]">{o.d}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-3" disabled={!canEdit}>
          <legend className="fo-label mb-2">Organizaciones de tu institución en FotoRank</legend>
          <p className="fo-helper">Sus concursos aparecen primero, destacados y con la etiqueta «Organiza …».</p>
          {organizaciones.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay organizaciones con concursos públicos.</p>
          ) : (
            organizaciones.map((o) => (
              <label key={o.id} className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="organizationIds" value={o.id} defaultChecked={s.organizationIds.includes(o.id)} />
                {o.name}
              </label>
            ))
          )}
        </fieldset>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="includeClickaton" defaultChecked={s.includeClickaton} className="mt-1" disabled={!canEdit} />
          <span>
            <span className="font-medium">Incluir las maratones de Clickatón</span>
            <span className="block text-[var(--fo-muted)]">Sólo cuando se muestran todos los concursos.</span>
          </span>
        </label>

        {canEdit ? (
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Guardar
          </button>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Tenés acceso de solo lectura a esta pantalla.</p>
        )}
      </form>
    </div>
  );
}
