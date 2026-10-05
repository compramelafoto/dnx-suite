import "server-only";
// lib/course-classroom/mis-cursos.ts
import { prisma } from "@repo/db";
import { estadoDeAccesoAlCurso, type OrigenAcceso } from "./access-rules";
import { armarAula } from "./aula";

/**
 * Lo que ve una persona en Mis cursos: sólo los accesos que valen ahora, agrupados por
 * institución, con su avance y la clase por la que seguir.
 */

export type AccesoParaMisCursos = {
  id: string;
  origin: OrigenAcceso;
  expiresAt: Date | null;
  revokedAt: Date | null;
  course: {
    id: string;
    title: string;
    workspace: { id: string; name: string };
    lessons: Array<{ id: string; title: string; durationSeconds: number | null; videoStatus: string; sortOrder: number }>;
  };
  progress: Array<{ lessonId: string; completedAt: Date | null; lastPositionSeconds: number }>;
};

export type CursoDeMisCursos = {
  accessId: string;
  courseId: string;
  title: string;
  origin: OrigenAcceso;
  expiresAt: Date | null;
  porcentaje: number;
  siguienteClaseId: string | null;
};

export type GrupoDeMisCursos = { workspace: { id: string; name: string }; cursos: CursoDeMisCursos[] };

export function agruparMisCursos(
  accesos: AccesoParaMisCursos[],
  sociaActivaEn: ReadonlySet<string>,
  ahora: Date,
): GrupoDeMisCursos[] {
  const grupos = new Map<string, GrupoDeMisCursos>();
  for (const a of accesos) {
    const estado = estadoDeAccesoAlCurso(a, { esSocioActivo: sociaActivaEn.has(a.course.workspace.id) }, ahora);
    if (estado !== "VIGENTE") continue;
    const { clases, porcentaje } = armarAula(a.course.lessons, a.progress);
    const siguiente = clases.find((c) => !c.completada) ?? clases[0] ?? null;
    const grupo = grupos.get(a.course.workspace.id) ?? { workspace: a.course.workspace, cursos: [] };
    grupo.cursos.push({
      accessId: a.id,
      courseId: a.course.id,
      title: a.course.title,
      origin: a.origin,
      expiresAt: a.expiresAt,
      porcentaje,
      siguienteClaseId: siguiente?.id ?? null,
    });
    grupos.set(a.course.workspace.id, grupo);
  }
  return [...grupos.values()];
}

async function institucionesDondeEsSociaActiva(userId: number): Promise<Set<string>> {
  const fichas = await prisma.member.findMany({
    where: { userId, status: "ACTIVE" },
    select: { workspaceId: true },
  });
  return new Set(fichas.map((f) => f.workspaceId));
}

const seleccionDeLecciones = {
  orderBy: { sortOrder: "asc" as const },
  select: { id: true, title: true, description: true, durationSeconds: true, videoStatus: true, videoUid: true, sortOrder: true },
};

export async function cargarMisCursos(userId: number): Promise<GrupoDeMisCursos[]> {
  const [accesos, socia] = await Promise.all([
    prisma.courseAccess.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        origin: true,
        expiresAt: true,
        revokedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            workspace: { select: { id: true, name: true } },
            lessons: seleccionDeLecciones,
          },
        },
        progress: { select: { lessonId: true, completedAt: true, lastPositionSeconds: true } },
      },
    }),
    institucionesDondeEsSociaActiva(userId),
  ]);
  return agruparMisCursos(accesos, socia, new Date());
}

/** El acceso de esta persona a este curso, sólo si vale ahora. Lo usan la clase y el avance. */
export async function cargarAccesoVigente(userId: number, courseId: string) {
  const acceso = await prisma.courseAccess.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      origin: true,
      expiresAt: true,
      revokedAt: true,
      enrollment: { select: { id: true, name: true, dni: true } },
      course: { select: { id: true, title: true, workspaceId: true, lessons: seleccionDeLecciones } },
      progress: { select: { lessonId: true, completedAt: true, lastPositionSeconds: true } },
    },
  });
  if (!acceso) return null;
  const socia = acceso.origin === "MEMBER_BENEFIT" ? await institucionesDondeEsSociaActiva(userId) : new Set<string>();
  const estado = estadoDeAccesoAlCurso(acceso, { esSocioActivo: socia.has(acceso.course.workspaceId) }, new Date());
  return estado === "VIGENTE" ? acceso : null;
}

export type AccesoVigente = NonNullable<Awaited<ReturnType<typeof cargarAccesoVigente>>>;
