import { AdminIntegrationCard } from "@/components/admin/AdminIntegrationCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { Card } from "@/components/ui/Card";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminIntegrationsPage() {
  await requireClickatonAdmin();
  const integrations = getAdminIntegrations();

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Integraciones"
        description="Revisá con qué sistemas trabaja Clickatón, qué hace cada uno y qué acción conviene seguir."
        breadcrumbs={[{ label: "Integraciones" }]}
      />

      <Card variant="outlined" className="space-y-2 p-5 text-sm text-ck-text-secondary">
        <p>
          Solo se muestra estado verificable. Si falta configuración, aparece como sin conectar.
          Nunca se afirma una conexión activa sin evidencia.
        </p>
        <p>
          La evaluación artística, el ranking y la publicación de resultados continúan en FotoRank.
          Los correos se envían con Resend desde los flujos de inscripción. Las publicaciones se
          preparan en Publicaciones y comunicaciones.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminIntegrationCard integration={integrations.fotorank} />
        <AdminIntegrationCard integration={integrations.payments} />
      </div>

      <Card variant="outlined" className="space-y-4 p-5 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-ck-text">Resend</p>
          <p className="text-ck-text-secondary">
            Envía correos de confirmación, credenciales y avisos. El detalle operativo aparece en
            cada inscripción y en el diagnóstico.
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-medium text-ck-text">Instagram y redes sociales</p>
          <p className="text-ck-text-secondary">
            Permite preparar o publicar contenido relacionado con Clickatón desde Publicaciones y
            comunicaciones.
          </p>
        </div>
        <a
          href="/admin/finanzas/cuenta-owner"
          className="block min-h-11 font-medium text-ck-text-primary underline-offset-4 hover:underline"
        >
          Abrir cuenta que recibirá los pagos →
        </a>
        <a
          href="/admin/integraciones/diagnostico"
          className="block min-h-11 font-medium text-ck-text-primary underline-offset-4 hover:underline"
        >
          Abrir diagnóstico operativo →
        </a>
        <a
          href="/admin/social"
          className="block min-h-11 font-medium text-ck-text-primary underline-offset-4 hover:underline"
        >
          Preparar publicaciones →
        </a>
      </Card>

      <AdminTechnicalInfo
        description="Nombres de variables opcionales para soporte. No son secretos."
        rows={[
          {
            label: "URL admin FotoRank",
            value: "CLICKATON_FOTORANK_ADMIN_URL / FOTORANK_PUBLIC_WEB_BASE_URL",
            mono: true,
          },
          {
            label: "URL admin pagos",
            value: "CLICKATON_PAYMENTS_ADMIN_URL",
            mono: true,
          },
        ]}
      />
    </div>
  );
}
