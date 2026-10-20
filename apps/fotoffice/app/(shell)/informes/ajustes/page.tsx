import { PageHeader } from "@/components/page-header";
import { requireInformesConfigurar } from "@/lib/informes/acceso";
import { leerAjustesInformes } from "@/lib/informes/ajustes";
import { importeParaCampo } from "@/lib/informes/url";
import { AjustesInformesForm } from "./ajustes-form";

export const dynamic = "force-dynamic";

/** Ajustes de Informes: saldo mínimo de Caja y control de monotributo. Permiso: `configurar` (dueño o administrador). */
export default async function AjustesInformesPage() {
  const { ctx } = await requireInformesConfigurar();
  const a = await leerAjustesInformes(ctx.workspaceId);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Ajustes de Informes" description="El saldo mínimo que te avisa el flujo de caja y los datos para controlar el monotributo." />
      <AjustesInformesForm
        inicial={{
          minBalanceArs: importeParaCampo(a.minBalanceCentavos),
          monotributoCategory: a.monotributoCategory ?? "",
          monotributoCapArs: importeParaCampo(a.monotributoCapCentavos),
          monotributoWarnPct: String(a.monotributoWarnPct),
        }}
      />
    </div>
  );
}
