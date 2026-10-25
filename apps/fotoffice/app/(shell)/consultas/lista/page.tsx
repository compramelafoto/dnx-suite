import { redirect } from "next/navigation";
import { ArmazonCaptacion } from "@/components/captacion/armazon";
import { Listado } from "@/components/listado/listado";
import { puedeEnContexto } from "@/lib/access/policy";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { cargarListadoCaptacion } from "@/lib/service-leads/listado";
import { prepararCaptacion } from "@/lib/service-leads/preparar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function CaptacionListaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  // Con el acceso resuelto (modelo de main): Exportar y las acciones se deciden con la misma regla
  // que después aplican la ruta de exportación y las acciones en lote.
  const ctx = await contextoListadoDePagina(user, workspace, SERVICE_LEADS_MODULE_KEY);
  const { quedan } = await prepararCaptacion(workspace.id);

  return (
    <ArmazonCaptacion activa="lista" quedan={quedan} puedeCrear={puedeEnContexto(ctx, "operar", SERVICE_LEADS_MODULE_KEY)}>
      <Listado def={await cargarListadoCaptacion(ctx)} ctx={ctx} ruta="/consultas/lista" searchParams={searchParams} />
    </ArmazonCaptacion>
  );
}
