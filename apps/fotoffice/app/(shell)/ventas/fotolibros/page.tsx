import { prisma } from "@repo/db";
import { TemplateV2RowActions, templateV2EditorPath } from "@repo/template-editor-ui";
import { PageHeader } from "@/components/page-header";
import { NuevoFotolibro } from "@/components/fotolibro/nuevo-fotolibro";
import { requireSalesStaff } from "@/lib/sales/access";
import { listarProveedores } from "@/lib/proveedores/repositorio";
import { listKeyedTemplatesTodas } from "@/lib/template-v2/keyed-template";
import { FOTOLIBRO_TEMPLATE_KEY, FOTOLIBROS_BASE_PATH } from "@/lib/fotolibro/constantes";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(v);

/**
 * Los fotolibros del estudio: se arman acá con la medida real del pliego del laboratorio y se
 * diseñan en el editor. Es trabajo de quien vende y manda al laboratorio, por eso vive en
 * Ventas y pide gestionarlas.
 */
export default async function FotolibrosPage() {
  const { workspace } = await requireSalesStaff();

  const [proveedores, conMarca] = await Promise.all([
    listarProveedores(workspace.id, { soloActivos: true }),
    // Una base sin las tablas del editor no tiene fotolibros: se muestra la lista vacía.
    listKeyedTemplatesTodas(workspace.id).catch(() => []),
  ]);
  const ids = conMarca.filter((t) => t.templateKey === FOTOLIBRO_TEMPLATE_KEY).map((t) => t.templateId);
  const fotolibros =
    ids.length === 0
      ? []
      : await prisma.templateV2.findMany({
          where: { id: { in: ids }, workspaceId: workspace.id },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, description: true, currentVersionId: true, updatedAt: true },
        });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotolibros"
        description="Armá el fotolibro con la medida real del pliego de cada laboratorio y diseñalo hoja por hoja."
      />

      <NuevoFotolibro proveedores={proveedores.map((p) => ({ id: p.id, name: p.name }))} />

      {fotolibros.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no hay fotolibros.</p>
      ) : (
        <section className="fo-card overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--fo-border)] text-[var(--fo-muted-soft)]">
              <tr>
                <th className="px-5 py-3 font-medium">Fotolibro</th>
                <th className="px-5 py-3 font-medium">Última edición</th>
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fotolibros.map((f) => (
                <tr key={f.id} className="border-b border-[var(--fo-border)]">
                  <td className="px-5 py-3">
                    <p className="font-medium">{f.name}</p>
                    {f.description ? <p className="text-xs text-[var(--fo-muted)]">{f.description}</p> : null}
                  </td>
                  <td className="px-5 py-3 text-[var(--fo-muted)]">{fecha(f.updatedAt)}</td>
                  <td className="px-5 py-3">
                    <TemplateV2RowActions
                      templateId={f.id}
                      name={f.name}
                      editorHref={
                        f.currentVersionId
                          ? templateV2EditorPath(FOTOLIBROS_BASE_PATH, f.id, f.currentVersionId)
                          : null
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
