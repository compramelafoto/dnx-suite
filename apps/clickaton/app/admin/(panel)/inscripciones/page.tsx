import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminRegistrationsPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inscripciones"
        description="Operación de acreditación: participante, edición, sede, tipo de entrada, kit, QR, check-in y entrega."
        breadcrumbs={[{ label: "Inscripciones" }]}
      />

      <Card variant="outlined" className="space-y-2 border-ck-yellow/40">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
          Frontera con DNX Payments
        </p>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          El estado de pago, órdenes, cobros y reembolsos proviene de DNX Payments. Clickatón no
          implementa Preferences, webhooks ni conciliación aquí.
        </p>
        <p className="text-sm leading-relaxed text-ck-text-muted">
          Las fotografías competitivas y el ranking viven en FotoRank; no se reutilizan como
          inscripciones operativas.
        </p>
      </Card>

      <AdminEmptyState
        title="Todavía no hay inscripciones operativas"
        description="Este módulo administrará acreditación, QR, check-in y entrega de kits cuando exista el modelo de negocio."
        note="Sin datos simulados en esta etapa."
      />
    </div>
  );
}
