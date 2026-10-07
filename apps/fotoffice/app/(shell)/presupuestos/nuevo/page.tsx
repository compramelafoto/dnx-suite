import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NuevoPresupuesto } from "@/components/presupuestos/nuevo-presupuesto";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { opcionesDeConsulta } from "@/lib/consultas/ficha";
import { consultaParaPresupuesto, consultasParaPresupuesto, contactoParaPresupuesto } from "@/lib/presupuestos/nuevo-datos";
import { requirePresupuestos } from "@/lib/presupuestos/pagina";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const texto = (v: string | string[] | undefined) => (typeof v === "string" && ID_VALIDO.test(v) ? v : null);

/**
 * "Nuevo presupuesto": de una consulta (`?consulta=`, desde su ficha), de las consultas de un
 * contacto (`?contacto=`, desde su ficha) o de las recientes; o creando la consulta con un
 * contacto existente. Pide "Gestionar" en Presupuestos. Todo se lee dentro del workspace de la
 * sesión: un id ajeno da 404.
 */
export default async function NuevoPresupuestoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { workspace, ctx } = await requirePresupuestos("operar");
  const sp = await searchParams;
  const consultaId = texto(sp.consulta);
  const contactoId = texto(sp.contacto);

  const veConsultas = puedeEnContexto(ctx, "ver", SERVICE_LEADS_MODULE_KEY);
  // Crear la consulta con un contacto existente: el alta pide "Gestionar" en Consultas y "Ver" en Clientes.
  const puedeCrearConsulta = puedeEnContexto(ctx, "operar", SERVICE_LEADS_MODULE_KEY) && puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);

  let consultas: { id: string; etiqueta: string }[] = [];
  if (consultaId) {
    const c = await consultaParaPresupuesto(workspace.id, consultaId);
    if (!c) notFound();
    consultas = [c];
  } else if (veConsultas) {
    consultas = await consultasParaPresupuesto(workspace.id, contactoId);
  }
  const contacto = contactoId && puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY) ? await contactoParaPresupuesto(workspace.id, contactoId) : null;
  if (contactoId && puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY) && !contacto) notFound();
  const categorias = puedeCrearConsulta && !consultaId ? (await opcionesDeConsulta(workspace.id)).categorias.map((c) => ({ id: c.id, nombre: c.nombre })) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo presupuesto"
        description={contacto ? `Para ${contacto.nombre}.` : "Elegí la consulta o creala con su contacto."}
        actions={
          <Link href="/presupuestos" className="fo-btn fo-btn-secondary text-sm">
            Volver a Presupuestos
          </Link>
        }
      />
      <NuevoPresupuesto
        consultas={consultas}
        consultaInicial={consultaId}
        categorias={categorias}
        puedeCrearConsulta={puedeCrearConsulta && !consultaId && categorias.length > 0}
        contactoInicial={contacto}
      />
    </div>
  );
}
