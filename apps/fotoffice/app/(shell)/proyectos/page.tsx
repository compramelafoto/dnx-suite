import { redirect } from "next/navigation";
import { ArmazonProyectos } from "@/components/proyectos/armazon";
import { Tablero } from "@/components/circuitos/tablero";
import { puede } from "@/lib/access/policy";
import { cargarTablero } from "@/lib/circuitos/tablero";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { requireProyectos, prepararProyectos } from "@/lib/proyectos/pagina";
import { circuitoInicialDelTablero } from "@/lib/proyectos/tablero-inicial";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Tablero de Proyectos: las columnas son las etapas de un flujo de trabajo, que se elige arriba.
 * Sin flujo en la dirección abre el primero con proyectos en curso. Mover un proyecto o cerrarlo
 * (terminado / cancelado) pide "Gestionar" en Proyectos: lo decide el motor en cada acción.
 */
export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace } = await requireProyectos("ver");
  const sp = await searchParams;
  // La lista vive en su propia ruta: `vista` es un parámetro reservado del motor de listados.
  if (uno(sp.vista) === "lista") redirect("/proyectos/lista");
  await prepararProyectos(workspace.id);

  const circuitoParam = uno(sp.circuito);
  const responsableParam = Number(uno(sp.responsable));
  const responsable = Number.isSafeInteger(responsableParam) && responsableParam > 0 ? responsableParam : null;
  const soloVencidas = uno(sp.vencidas) === "si";
  const circuito = circuitoParam && ID_VALIDO.test(circuitoParam) ? circuitoParam : await circuitoInicialDelTablero(workspace.id);

  const [datos, role] = await Promise.all([
    cargarTablero(
      { workspaceId: workspace.id },
      circuito,
      { ...(responsable !== null ? { responsable } : {}), soloVencidas },
      new Date(),
      { tipoSujeto: "PROYECTO", clase: "TRABAJO" },
    ),
    resolveWorkspaceRole(user.id, workspace.id),
  ]);

  return (
    <ArmazonProyectos activa="tablero">
      <Tablero
        tipo="PROYECTO"
        datos={datos}
        filtros={{ circuito: datos.circuito?.id ?? null, responsable, soloVencidas }}
        puedePasarIgual={puede(role, "configurar")}
      />
    </ArmazonProyectos>
  );
}
