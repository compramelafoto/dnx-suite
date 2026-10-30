import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { ProbadorCuadros } from "@/components/probador/probador-cuadros";
import { EnlaceParaClientes } from "@/components/probador/enlace-para-clientes";
import { cargarCatalogoProbador } from "@/lib/probador/catalogo.server";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { PROBADOR_PUBLIC_SEGMENT } from "@/lib/probador/constantes";
import { appUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * El probador de cuadros dentro del panel: el fotógrafo lo usa con el cliente adelante (en el
 * mostrador o en una reunión) y le copia el enlace de la versión pública para que pruebe en su
 * casa. Va con Ventas, igual que su lugar en el menú.
 */
export default async function ProbadorPanelPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const nivel = await getModuleLevel(user.id, workspace.id, SALES_MODULE_KEY);
  if (!hasLevel(nivel, "VIEW")) redirect("/dashboard");

  const [branding, catalogo] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { publicSlug: true } }),
    cargarCatalogoProbador(workspace.id),
  ]);
  const enlace = branding?.publicSlug ? `${appUrl()}/w/${branding.publicSlug}/${PROBADOR_PUBLIC_SEGMENT}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probador de cuadros"
        description="Sacale una foto a la pared del cliente, marcá una medida que conozcas y mostrale cómo quedan los cuadros a escala: individuales, dípticos, trípticos o una galería, con el marco que elija."
      />
      {enlace ? <EnlaceParaClientes url={enlace} /> : null}
      <ProbadorCuadros catalogo={catalogo} />
    </div>
  );
}
