import Link from "next/link";
import { CreateTemplateV2Button } from "@repo/template-editor-ui";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb } from "@/lib/admin/db";
// El import registra el runtime del editor (base, sesión y almacenamiento).
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function ClickatonTemplatesPage() {
  await requireClickatonAdmin();

  const loaded = await withClickatonDb(async () =>
    prisma.templateV2.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        currentVersionId: true,
        updatedAt: true,
      },
    })
  );

  const breadcrumbs = [{ label: "Plantillas" }];

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Plantillas" breadcrumbs={breadcrumbs} />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }

  const templates = loaded.data;

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Plantillas"
        description="Diseñá las piezas de Clickatón. Una vez guardadas, se asignan a las placas de cada edición desde Ediciones → Placas."
        breadcrumbs={breadcrumbs}
        actions={<CreateTemplateV2Button />}
      />

      {templates.length === 0 ? (
        <Card variant="outlined" className="space-y-2 p-8">
          <p className="text-ck-text-secondary">Todavía no hay plantillas.</p>
          <p className="text-xs text-ck-text-muted">
            Creá la primera y diseñala en el lienzo: fondo, foto del participante, textos con
            variables y logo.
          </p>
        </Card>
      ) : (
        <Card variant="outlined" className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ck-border text-ck-text-muted">
              <tr>
                <th className="px-6 py-4 font-medium">Plantilla</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Última edición</th>
                <th className="px-6 py-4 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-ck-border/60">
                  <td className="px-6 py-4">
                    <p className="font-medium text-ck-text">{t.name}</p>
                    {t.description ? (
                      <p className="text-xs text-ck-text-muted">{t.description}</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="neutral">{t.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-ck-text-secondary">
                    {formatDate(t.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    {t.currentVersionId ? (
                      <Link
                        href={`${adminRoutes.templates}/${t.id}/${t.currentVersionId}`}
                        className="text-ck-accent underline-offset-2 hover:underline"
                      >
                        Abrir editor
                      </Link>
                    ) : (
                      <span className="text-xs text-ck-text-muted">Sin versión</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
