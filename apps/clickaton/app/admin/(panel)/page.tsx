import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { adminRoutes } from "@/config/admin/navigation";
import { siteConfig } from "@/config/site";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminDashboardPage() {
  const user = await requireClickatonAdmin();
  const integrations = getAdminIntegrations();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Panel de Clickatón"
        description="Operación de marca: ediciones, sedes, inscripciones operativas y sponsors. La competencia vive en FotoRank; los cobros en DNX Payments."
        breadcrumbs={[{ label: "Dashboard" }]}
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
          Administrás {siteConfig.name} con acceso completo del MVP. No hay permisos por sede en
          esta etapa.
        </p>
      </Card>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
          Accesos rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: adminRoutes.editions, label: "Ediciones" },
            { href: adminRoutes.venues, label: "Sedes" },
            { href: adminRoutes.registrations, label: "Inscripciones" },
            { href: adminRoutes.sponsors, label: "Sponsors" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-4 py-4 text-sm font-medium text-ck-text transition-colors hover:border-ck-yellow/50 hover:text-ck-yellow"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <AdminEmptyState
        title="Todavía no hay una edición configurada"
        description="Cuando exista el modelo de ediciones (Etapa 10C), este panel mostrará la edición activa y métricas reales. Por ahora no se inventan inscriptos, recaudación ni kits."
        action={
          <Button href={adminRoutes.editions} variant="primary">
            Ir a Ediciones
          </Button>
        }
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
            Integraciones
          </h2>
          <Button href={adminRoutes.integrations} variant="text" size="sm">
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
