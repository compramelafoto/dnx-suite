import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";

export default async function ServiceLeadFormsPage() {
  const { workspace } = await requireActiveWorkspace();
  const forms = workspace
    ? await prisma.serviceLeadForm.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Formularios de captación"
        description="Administrá los formularios públicos que capturan consultas para este workspace."
      />

      {!workspace ? (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            No hay workspace activo para este usuario.
          </p>
        </div>
      ) : null}

      {workspace && forms.length === 0 ? (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Todavía no tenés formularios creados.
          </p>
        </div>
      ) : null}

      {workspace && forms.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[920px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Tipo de evento</th>
                <th className="px-4 py-3 font-semibold">Activo</th>
                <th className="px-4 py-3 font-semibold">Por defecto</th>
                <th className="px-4 py-3 font-semibold">Link público</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {forms.map((form) => {
                const publicPath = `/w/dnx-estudio/${form.slug}`;
                return (
                  <tr key={form.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                    <td className="px-4 py-3 text-[var(--fo-text)] font-medium">{form.name}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)] font-mono text-xs">{form.slug}</td>
                    <td className="px-4 py-3 text-[var(--fo-text)]">{form.eventType}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{form.isActive ? "Sí" : "No"}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{form.isDefault ? "Sí" : "No"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={publicPath}
                        className="text-[var(--fo-accent)] underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {publicPath}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/service-leads/forms/${form.id}`}
                          className="text-[var(--fo-accent)] underline underline-offset-2"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/dashboard/service-leads/forms/${form.id}/share`}
                          className="text-[var(--fo-accent)] underline underline-offset-2"
                        >
                          Compartir
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
