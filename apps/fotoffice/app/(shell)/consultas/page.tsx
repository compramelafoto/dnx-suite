import { redirect } from "next/navigation";
import { ArmazonCaptacion } from "@/components/captacion/armazon";
import { Tablero } from "@/components/circuitos/tablero";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { cargarTablero } from "@/lib/circuitos/tablero";
import { opcionesDeConsulta } from "@/lib/consultas/ficha";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { prepararCaptacion } from "@/lib/service-leads/preparar";
import { resolveWorkspaceRole } from "@/lib/workspace-role";

export const dynamic = "force-dynamic";
// Enganchar las consultas anteriores puede llevar un rato la primera vez.
export const maxDuration = 300;

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CaptacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const sp = await searchParams;
  const vista = uno(sp.vista);
  // La lista y el informe viven en sus propias rutas: `vista` es un parámetro reservado del
  // motor de listados (vistas guardadas) y se perdería al buscar, filtrar o paginar.
  if (vista === "lista") redirect("/consultas/lista");
  if (vista === "informe") redirect("/consultas/informe");

  // Filtros de la dirección: lo que no tiene forma válida se ignora.
  const circuitoParam = uno(sp.circuito);
  const circuito = circuitoParam && ID_VALIDO.test(circuitoParam) ? circuitoParam : null;
  const responsableParam = Number(uno(sp.responsable));
  const responsable = Number.isSafeInteger(responsableParam) && responsableParam > 0 ? responsableParam : null;
  const soloVencidas = uno(sp.vencidas) === "si";

  const { quedan } = await prepararCaptacion(workspace.id);
  const [datos, role, acceso] = await Promise.all([
    cargarTablero(
      { workspaceId: workspace.id },
      circuito,
      { ...(responsable !== null ? { responsable } : {}), soloVencidas },
      new Date(),
    ),
    resolveWorkspaceRole(user.id, workspace.id),
    resolverAcceso(user.id, workspace.id),
  ]);
  // "Nueva consulta" y el alta rápida, sólo con "Gestionar" en Consultas.
  const puedeCrear = puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY);
  const categorias = puedeCrear ? (await opcionesDeConsulta(workspace.id)).categorias : [];

  return (
    <ArmazonCaptacion activa="tablero" quedan={quedan} puedeCrear={puedeCrear}>
      <Tablero
        datos={datos}
        filtros={{ circuito: datos.circuito?.id ?? null, responsable, soloVencidas }}
        puedePasarIgual={puede(role, "configurar")}
        altaRapida={puedeCrear ? { categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre })) } : null}
      />
    </ArmazonCaptacion>
  );
}
