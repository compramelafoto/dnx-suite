import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PROJECTS_MODULE_KEY } from "./acceso";
import { fechaValida } from "./fechas";
import { entregasDeLaSemana, type EntregaDeLaSemana } from "./entregas-puro";

export type { EntregaDeLaSemana } from "./entregas-puro";

const TOPE = 100;

/**
 * "Mis entregas de la semana" del inicio: los proyectos de quien entra (es su responsable) con
 * fecha final dentro de los próximos 7 días o ya vencida, que siguen vivos (ni suspendidos ni
 * terminados). Sólo con "Ver" en Proyectos y el módulo encendido. Vacío o con error, null: el
 * inicio nunca se rompe por esto (el error se registra sin datos personales).
 */
export async function misEntregasDelInicio(
  user: { id: number },
  workspaceId: string,
  ahora: Date,
): Promise<EntregaDeLaSemana[] | null> {
  try {
    const acceso = await resolverAcceso(user.id, workspaceId);
    if (!puede(acceso, "ver", PROJECTS_MODULE_KEY)) return null;
    if (!(await isModuleEnabledForWorkspace(workspaceId, PROJECTS_MODULE_KEY))) return null;
    const hoy = hoyEnBuenosAires(ahora);
    const limite = new Date(`${hoy}T00:00:00.000Z`);
    limite.setUTCDate(limite.getUTCDate() + 7);
    const filas = await prisma.fotofficeProyecto.findMany({
      where: { workspaceId, ownerUserId: user.id, suspendedAt: null, finalDueDate: { not: null, lte: limite } },
      select: { id: true, number: true, name: true, finalDueDate: true },
      orderBy: [{ finalDueDate: "asc" }, { id: "asc" }],
      take: TOPE,
    });
    if (filas.length === 0) return null;
    // Sigue vivo = tiene un recorrido abierto (uno terminado o cancelado ya no se entrega).
    const abiertos = await prisma.fotofficeJourney.findMany({
      where: { workspaceId, subjectType: "PROYECTO", closedAt: null, subjectId: { in: filas.map((f) => f.id) } },
      select: { subjectId: true },
    });
    const vivos = new Set(abiertos.map((a) => a.subjectId as string));
    const r = entregasDeLaSemana(
      filas.map((f) => ({ id: f.id, numero: f.number, nombre: f.name, finalDueDate: fechaValida(f.finalDueDate), suspendido: false, cerrado: !vivos.has(f.id) })),
      hoy,
    );
    return r.length > 0 ? r : null;
  } catch (error) {
    const tipo = error instanceof Error ? error.name : typeof error;
    const codigo = (error as { code?: unknown } | null)?.code;
    console.error("[inicio] No se pudieron cargar Mis entregas", { tipo, ...(typeof codigo === "string" ? { codigo } : {}) });
    return null;
  }
}
