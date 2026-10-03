import { PageHeader } from "@/components/page-header";
import { requireCommissionAdmin } from "@/lib/commission/access";
import { ensureCommissionSetup } from "@/lib/commission/seed";
import { ComisionTabs } from "./comision-tabs";

export const dynamic = "force-dynamic";

/**
 * Marco de la Comisión directiva: guardia de dueño/admin, siembra de plantillas la primera vez y
 * las pestañas Integrantes · Cargos · Roles.
 *
 * Cada página vuelve a llamar a `requireCommissionAdmin()`: layout y página se renderizan en
 * paralelo, y la guardia del layout sola no frena el contenido de la página.
 */
export default async function ComisionLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = await requireCommissionAdmin();
  await ensureCommissionSetup(workspaceId);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Comisión directiva"
        description="Quiénes integran la comisión, qué cargo ocupa cada persona y qué puede hacer en el panel."
      />
      <ComisionTabs />
      {children}
    </div>
  );
}
