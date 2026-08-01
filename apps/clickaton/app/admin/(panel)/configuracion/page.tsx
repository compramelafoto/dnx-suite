import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MercadoPagoConnectedIcon } from "@/components/admin/MercadoPagoConnectedIcon";
import { Card } from "@/components/ui/Card";
import { listClickatonAdminEmails } from "@/config/admin/admins";
import { siteConfig } from "@/config/site";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getAdminEmailsMercadoPagoStatus } from "@/lib/admin/mp-connection-status";

export default async function AdminSettingsPage() {
  await requireClickatonAdmin();
  const admins = listClickatonAdminEmails();
  const mpByEmail = await getAdminEmailsMercadoPagoStatus(admins);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Configuración"
        description="Datos generales del panel administrativo. En esta etapa la vista es de solo lectura."
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
            Rol visible: administrador general. No se pueden eliminar desde aquí todavía. Todavía
            no hay roles diferenciados ni permisos por sede. El ícono celeste indica Mercado Pago
            conectado.
          </p>
          <ul className="space-y-2">
            {admins.map((email) => (
              <li
                key={email}
                className="flex items-center gap-2 rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface-muted px-3 py-2 text-sm text-ck-text"
              >
                <span className="min-w-0 flex-1 truncate">{email}</span>
                {mpByEmail[email] ? <MercadoPagoConnectedIcon /> : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card variant="outlined" className="space-y-2">
        <h2 className="text-sm font-semibold text-ck-text">Mejoras previstas</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ck-text-secondary">
          <li>Redes y contacto oficiales editables</li>
          <li>Identidad visual avanzada del panel</li>
          <li>Gestión de roles y permisos más fina</li>
          <li>Comunicaciones y marketing por correo (cuando esté habilitado)</li>
        </ul>
      </Card>
    </div>
  );
}
