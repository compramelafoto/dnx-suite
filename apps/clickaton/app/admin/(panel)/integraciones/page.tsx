import { AdminIntegrationCard } from "@/components/admin/AdminIntegrationCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminIntegrationsPage() {
  await requireClickatonAdmin();
  const integrations = getAdminIntegrations();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Integraciones"
        description="Estado y enlaces operativos hacia FotoRank y DNX Payments. Clickatón no duplica sus interfaces internas."
        breadcrumbs={[{ label: "Integraciones" }]}
      />

      <Card variant="outlined" className="space-y-2 text-sm text-ck-text-secondary">
        <p>
          Solo se muestra estado verificable. Si no hay URL configurada, la integración aparece como
          no configurada. Nunca se afirma una conexión activa sin evidencia.
        </p>
        <p className="text-ck-text-muted">
          Variables opcionales: `CLICKATON_FOTORANK_ADMIN_URL`, `FOTORANK_PUBLIC_WEB_BASE_URL`,
          `CLICKATON_PAYMENTS_ADMIN_URL`.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminIntegrationCard integration={integrations.fotorank} />
        <AdminIntegrationCard integration={integrations.payments} />
      </div>

      <Card variant="outlined" className="space-y-3 text-sm">
        <a
          href="/admin/finanzas/cuenta-owner"
          className="block font-medium text-ck-text-primary underline-offset-4 hover:underline"
        >
          Cuenta owner Mercado Pago →
        </a>
        <a
          href="/admin/integraciones/diagnostico"
          className="block font-medium text-ck-text-primary underline-offset-4 hover:underline"
        >
          Diagnóstico OAuth / emails / reconciliación →
        </a>
      </Card>
    </div>
  );
}
