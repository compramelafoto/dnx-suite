import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { buildPaymentImportPrompt } from "@/lib/membership/history-import/prompt";
import { PAYMENT_IMPORT_HEADER_ROW } from "@/lib/membership/history-import/columns";
import { PaymentImportWizard } from "@/components/membership/payment-import-wizard";

export const dynamic = "force-dynamic";

/**
 * Carga del registro de pagos anterior a FotoOffice.
 *
 * Mismo permiso que registrar un pago cobrado en mano: es la misma atribución —quién puede
 * afirmar que un cobro existió— y separarlas dejaría a alguien pudiendo hacer por planilla
 * lo que no puede hacer de a uno.
 */
export default async function ImportarHistorialPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) redirect("/members/cuotas");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Importar pagos anteriores"
        description="El registro de cobros previo a FotoOffice, para que cada socio vea su historial completo. No da de alta socios ni modifica deudas."
        actions={
          <Link href="/members/cuotas" className="fo-btn fo-btn-secondary text-sm">
            Volver a Cuotas
          </Link>
        }
      />
      <PaymentImportWizard
        prompt={buildPaymentImportPrompt({ workspaceName: workspace.name })}
        csvHeaderExample={PAYMENT_IMPORT_HEADER_ROW}
      />
    </div>
  );
}
