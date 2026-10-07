import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ImportarConsultas } from "@/components/consultas/importar-consultas";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { ENCABEZADO_EJEMPLO_CONSULTAS } from "@/lib/consultas/importar";
import { MAX_FILAS_IMPORTACION } from "@/lib/consultas/constantes";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";

export const dynamic = "force-dynamic";
// La confirmación (server action) corre bajo la configuración de esta página: hasta 2.000 filas.
export const maxDuration = 300;

/** Consultas → Importar: CSV de consultas (spec §3.6). Pide "Gestionar" en Consultas. */
export default async function ImportarConsultasPage() {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY)) redirect("/consultas");
  return (
    <div className="space-y-8">
      <PageHeader
        title="Importar consultas"
        description={`Cargá hasta ${MAX_FILAS_IMPORTACION.toLocaleString("es-AR")} consultas a la vez desde un CSV. No se manda ningún aviso ni respuesta automática.`}
        actions={
          <Link href="/consultas/lista" className="fo-btn fo-btn-secondary text-sm">
            Volver a Consultas
          </Link>
        }
      />
      <ImportarConsultas encabezado={ENCABEZADO_EJEMPLO_CONSULTAS} />
    </div>
  );
}
