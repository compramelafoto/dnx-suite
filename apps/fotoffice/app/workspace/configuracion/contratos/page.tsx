import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { clausulaVigente, leerAjustesContratos, urlFirmaEmpresa } from "@/lib/contratos/ajustes";
import { CLAUSULA_CONSENTIMIENTO_INICIAL } from "@/lib/contratos/clausula";
import { prepararConfiguracionContratos } from "@/lib/contratos/pagina";
import { AjustesForm } from "./ajustes-form";
import { FirmaEmpresa } from "./firma-empresa";

export const dynamic = "force-dynamic";

/**
 * Configuración → Contratos: datos de la empresa (van a las variables `[empresa_…]`), cláusula de
 * consentimiento a la firma electrónica, recordatorios a los firmantes y la imagen de la firma de la
 * empresa. Permiso: `configurar` (dueño o administrador). Las plantillas están en una subpágina.
 */
export default async function ConfiguracionContratosPage() {
  const c = await prepararConfiguracionContratos();

  if (c.estado === "SIN_PERMISO") {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Contratos" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los contratos.</p>
      </div>
    );
  }
  if (c.estado === "APAGADO") {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Contratos" description="Contratos de los pedidos, con firma electrónica." />
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Contratos todavía no está encendido. Para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      </div>
    );
  }

  const ajustes = await leerAjustesContratos(c.ctx.workspaceId);
  const firmaUrl = await urlFirmaEmpresa(ajustes.companySignatureKey);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Contratos" description="Datos de la empresa, consentimiento a la firma electrónica y recordatorios." />

      <AjustesForm
        inicial={{
          companyName: ajustes.companyName ?? "",
          companyTaxId: ajustes.companyTaxId ?? "",
          companyAddress: ajustes.companyAddress ?? "",
          consentClause: clausulaVigente(ajustes),
          reminderEnabled: ajustes.reminderEnabled,
          reminderDays: ajustes.reminderDays,
        }}
        clausulaDeFabrica={CLAUSULA_CONSENTIMIENTO_INICIAL}
      />

      <FirmaEmpresa url={firmaUrl} />

      <Link
        href="/workspace/configuracion/contratos/plantillas"
        className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">Plantillas de contrato</span>
          <span className="block text-xs text-[var(--fo-muted)]">El texto de tus contratos, con variables que se completan solas con los datos del pedido.</span>
        </span>
        <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
      </Link>
    </div>
  );
}
