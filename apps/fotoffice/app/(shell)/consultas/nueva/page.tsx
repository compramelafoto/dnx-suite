import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FormularioConsulta } from "@/components/consultas/formulario-consulta";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { contactoDelWorkspace, opcionesDeConsulta, responsablesDeConsultas } from "@/lib/consultas/ficha";
import { asegurarCatalogosDelWorkspace } from "@/lib/consultas/semillas";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";

export const dynamic = "force-dynamic";

/** Los ids que llegan de la dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * "Nueva consulta" (spec §3.1). Primero la guarda (módulo encendido y "Ver" en Consultas) y
 * "Gestionar" en Consultas: sin él, vuelve al tablero. Después, las opciones del workspace de la
 * sesión. `?contacto=<id>` ("Nueva consulta para este contacto") sólo vale con un contacto del
 * mismo workspace.
 */
export default async function NuevaConsultaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY)) redirect("/consultas");

  const sp = await searchParams;
  const contactoParam = uno(sp.contacto);
  try {
    await asegurarCatalogosDelWorkspace(workspace.id);
  } catch {
    // Si no se pudo sembrar, el formulario lo muestra sin categorías y el alta lo explica.
  }
  const [opciones, responsables, contactoInicial] = await Promise.all([
    opcionesDeConsulta(workspace.id),
    responsablesDeConsultas(workspace.id),
    contactoParam && ID_VALIDO.test(contactoParam) ? contactoDelWorkspace(workspace.id, contactoParam) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva consulta"
        description="Cargá una consulta que llegó por teléfono, WhatsApp, redes o en persona."
        actions={
          <Link href="/consultas" className="fo-btn fo-btn-secondary text-sm">
            Volver a Consultas
          </Link>
        }
      />
      {opciones.categorias.length === 0 ? (
        <p className="fo-card text-sm text-[var(--fo-muted)]">
          No hay categorías activas. Un administrador las puede activar en Configuración → Consultas.
        </p>
      ) : (
        <FormularioConsulta
          categorias={opciones.categorias}
          origenes={opciones.origenes}
          responsables={responsables}
          contactoInicial={contactoInicial}
        />
      )}
    </div>
  );
}
