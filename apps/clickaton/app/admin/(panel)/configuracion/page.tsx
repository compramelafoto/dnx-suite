import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { listClickatonAdminEmails } from "@/config/admin/admins";
import { siteConfig } from "@/config/site";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminSettingsPage() {
  await requireClickatonAdmin();
  const admins = listClickatonAdminEmails();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Configuración"
        description="Datos generales del panel. Vista de solo lectura en esta etapa."
        breadcrumbs={[{ label: "Configuración" }]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="default" className="space-y-3">
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
            Aplicación
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ck-text-muted">Nombre</dt>
              <dd className="text-ck-text">{siteConfig.name}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Nombre completo</dt>
              <dd className="text-ck-text">{siteConfig.nameFull}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">URL pública</dt>
              <dd className="text-ck-text">{siteConfig.url}</dd>
            </div>
          </dl>
        </Card>

        <Card variant="default" className="space-y-3">
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
            Administradores iniciales
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Acceso completo al panel MVP. No se pueden eliminar desde aquí todavía. Sin roles
            diferenciados ni permisos por sede.
          </p>
          <ul className="space-y-2">
            {admins.map((email) => (
              <li
                key={email}
                className="rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface-muted px-3 py-2 text-sm text-ck-text"
              >
                {email}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card variant="outlined" className="space-y-2">
        <h2 className="text-sm font-semibold text-ck-text">Pendiente para etapas posteriores</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ck-text-secondary">
          <li>Redes y contacto oficiales editables</li>
          <li>Identidad visual avanzada del panel</li>
          <li>Migración del acceso a appAccess `CLICKATON` en DNX Identity</li>
          <li>DNX Communications / email marketing (Etapa 2)</li>
        </ul>
      </Card>
    </div>
  );
}
