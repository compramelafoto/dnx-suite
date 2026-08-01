import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { adminRoutes } from "@/config/admin/navigation";
import { siteConfig } from "@/config/site";
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import { getEditionDashboardMetrics } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminDashboardPage() {
  const user = await requireClickatonAdmin();
  const integrations = getAdminIntegrations();
  const metricsResult = await getEditionDashboardMetrics();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inicio del panel"
        description="Revisá el estado operativo de Clickatón, las ediciones activas y las acciones más frecuentes. La evaluación artística se gestiona en FotoRank."
        breadcrumbs={[{ label: "Inicio" }]}
      />

      <Card variant="yellow" className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
          Sesión activa
        </p>
        <p className="text-lg text-ck-text">
          Bienvenido{user.name?.trim() ? `, ${user.name.trim()}` : ""}
        </p>
        <p className="text-sm text-ck-text-secondary">{user.email}</p>
        <p className="text-sm text-ck-text-muted">
          Rol visible: administrador general de {siteConfig.name}. El acceso no está limitado por
          sede en esta etapa.
        </p>
      </Card>

      {!metricsResult.ok ? (
        <AdminMigrationNotice message={metricsResult.message} />
      ) : metricsResult.data.totalEditions === 0 ? (
        <AdminEmptyState
          title="Todavía no hay una edición configurada"
          description="Creá la primera edición para habilitar sedes, precios e inscripciones."
          action={
            <Button href={`${adminRoutes.editions}/nueva`} variant="primary" className="min-h-11">
              Crear edición
            </Button>
          }
        />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen operativo">
          {[
            {
              label: "Ediciones",
              value: String(metricsResult.data.totalEditions),
              hint: `${metricsResult.data.operativeEditions} operativas`,
            },
            {
              label: "Próxima edición",
              value: metricsResult.data.nextEdition?.name ?? "—",
              hint: metricsResult.data.nextEdition?.startAt
                ? formatAdminDateTime(
                    metricsResult.data.nextEdition.startAt,
                    metricsResult.data.nextEdition.timezone ?? undefined,
                  )
                : "Sin fecha de inicio",
            },
            {
              label: "Sedes",
              value: String(metricsResult.data.totalVenues),
              hint: "Todas las ediciones",
            },
            {
              label: "Capacidad total",
              value: String(metricsResult.data.totalCapacity),
              hint: "Suma de capacidades de sedes o valor por defecto de edición",
            },
          ].map((metric) => (
            <Card key={metric.label} variant="outlined" className="space-y-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ck-text-muted">
                {metric.label}
              </p>
              <p className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-text">
                {metric.value}
              </p>
              <p className="text-sm text-ck-text-secondary">{metric.hint}</p>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
          Acciones rápidas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { href: adminRoutes.registrations, label: "Revisar inscripciones" },
            { href: adminRoutes.editions, label: "Abrir ediciones" },
            { href: adminRoutes.catalog, label: "Configurar productos y kits" },
            { href: adminRoutes.promotions, label: "Gestionar códigos promocionales" },
            { href: adminRoutes.financePartner, label: "Conectar Mercado Pago" },
            { href: adminRoutes.social, label: "Preparar publicaciones" },
            { href: adminRoutes.venues, label: "Administrar sedes" },
            { href: adminRoutes.sponsors, label: "Ver patrocinadores" },
            { href: adminRoutes.integrations, label: "Revisar integraciones" },
          ].map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="flex min-h-11 items-center rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-4 py-4 text-sm font-medium text-ck-text transition-colors hover:border-ck-yellow/50 hover:text-ck-yellow"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
            Integraciones
          </h2>
          <Button href={adminRoutes.integrations} variant="text" size="sm" className="min-h-11">
            Ver detalle
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[integrations.fotorank, integrations.payments].map((item) => (
            <Card key={item.id} variant="outlined" className="space-y-3 p-5 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ck-text">{item.name}</p>
                <Badge variant={item.status === "pending" ? "brand" : "neutral"}>
                  {item.statusLabel}
                </Badge>
              </div>
              <p className="text-sm text-ck-text-secondary">{item.purpose}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
