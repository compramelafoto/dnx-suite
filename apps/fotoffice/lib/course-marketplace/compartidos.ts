import "server-only";
import { prisma } from "@repo/db";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { nombresDeNegocios } from "./cargar";
import { ESTADOS_VIGENTES, type EstadoReventa } from "./reventa";

/**
 * Los cursos compartidos entre espacios (spec 2026-11-13): a quién se le puede compartir un curso,
 * con quién está compartido y la vista de sólo lectura que ven las dos puntas del acuerdo.
 */

export type EspacioParaCompartir = { id: string; nombre: string };

/** Espacios con el módulo de cursos encendido, menos el propio y los que ya tienen un acuerdo vigente. */
export async function espaciosParaCompartir(workspaceId: string, courseId: string): Promise<EspacioParaCompartir[]> {
  const filas = await prisma.workspace.findMany({
    where: {
      id: { not: workspaceId },
      featureModules: { some: { moduleKey: COURSES_SALES_MODULE_KEY, enabled: true } },
      courseResaleAgreements: { none: { courseId, status: { in: [...ESTADOS_VIGENTES] } } },
    },
    select: { id: true },
    take: 300,
  });
  const nombres = await nombresDeNegocios(filas.map((f) => f.id));
  return filas
    .map((f) => ({ id: f.id, nombre: nombres.get(f.id) ?? "Espacio" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export type CompartidoDelCurso = {
  id: string;
  espacio: string;
  status: EstadoReventa;
  shareBps: number;
  membersFree: boolean;
  invitadoPorDueno: boolean;
  alumnos: number;
};

/** Con quién está compartido un curso (todos los acuerdos, vigentes o no), con sus alumnos. */
export async function compartidosDelCurso(courseId: string): Promise<CompartidoDelCurso[]> {
  const [acuerdos, conteos] = await Promise.all([
    prisma.courseResaleAgreement.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      select: { id: true, resellerWorkspaceId: true, status: true, shareBps: true, membersFree: true, invitedByOwner: true },
    }),
    prisma.courseAccess.groupBy({ by: ["workspaceId"], where: { courseId }, _count: { _all: true } }),
  ]);
  const nombres = await nombresDeNegocios(acuerdos.map((a) => a.resellerWorkspaceId));
  return acuerdos.map((a) => ({
    id: a.id,
    espacio: nombres.get(a.resellerWorkspaceId) ?? "Espacio",
    status: a.status,
    shareBps: a.shareBps,
    membersFree: a.membersFree,
    invitadoPorDueno: a.invitedByOwner,
    alumnos: conteos.find((c) => c.workspaceId === a.resellerWorkspaceId)?._count._all ?? 0,
  }));
}

export type AlumnoDelCompartido = { id: string; nombre: string; correo: string; origen: "PURCHASE" | "MEMBER_BENEFIT" | "INVITATION"; porcentaje: number };

export type CursoCompartidoVista = {
  acuerdo: { id: string; status: EstadoReventa; shareBps: number; membersFree: boolean; invitadoPorDueno: boolean };
  soyDueno: boolean;
  dueno: string;
  espacio: string;
  curso: { id: string; titulo: string; descripcion: string | null; docente: string | null; precioArs: string | null; portada: string | null };
  clases: Array<{ id: string; titulo: string; minutos: number | null; muestra: boolean; lista: boolean }>;
  alumnos: AlumnoDelCompartido[];
};

/** % visto: clases terminadas sobre clases listas. Puro, para el test. */
export function porcentajeVisto(clasesListas: number, terminadas: number): number {
  if (clasesListas <= 0) return 0;
  return Math.min(100, Math.round((terminadas / clasesListas) * 100));
}

/**
 * La vista de sólo lectura de un curso compartido. Sólo la ven las dos puntas del acuerdo: el
 * dueño y el espacio que lo recibe. Los alumnos que se listan son los del espacio que lo recibe.
 */
export async function cargarCursoCompartido(agreementId: string, workspaceId: string): Promise<CursoCompartidoVista | null> {
  const a = await prisma.courseResaleAgreement.findFirst({
    where: { id: agreementId, OR: [{ resellerWorkspaceId: workspaceId }, { course: { workspaceId } }] },
    select: {
      id: true,
      status: true,
      shareBps: true,
      membersFree: true,
      invitedByOwner: true,
      resellerWorkspaceId: true,
      course: {
        select: {
          id: true,
          title: true,
          shortDescription: true,
          instructorName: true,
          priceArs: true,
          coverImageUrl: true,
          workspaceId: true,
          lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, durationSeconds: true, isPreview: true, videoStatus: true } },
        },
      },
    },
  });
  if (!a) return null;
  const [accesos, nombres] = await Promise.all([
    prisma.courseAccess.findMany({
      where: { courseId: a.course.id, workspaceId: a.resellerWorkspaceId },
      orderBy: { grantedAt: "desc" },
      take: 500,
      select: {
        id: true,
        origin: true,
        enrollment: { select: { name: true, email: true } },
        progress: { where: { completedAt: { not: null } }, select: { lessonId: true } },
      },
    }),
    nombresDeNegocios([a.course.workspaceId, a.resellerWorkspaceId]),
  ]);
  const listas = a.course.lessons.filter((l) => l.videoStatus === "READY").length;
  return {
    acuerdo: { id: a.id, status: a.status, shareBps: a.shareBps, membersFree: a.membersFree, invitadoPorDueno: a.invitedByOwner },
    soyDueno: a.course.workspaceId === workspaceId,
    dueno: nombres.get(a.course.workspaceId) ?? "El dueño",
    espacio: nombres.get(a.resellerWorkspaceId) ?? "Espacio",
    curso: {
      id: a.course.id,
      titulo: a.course.title,
      descripcion: a.course.shortDescription,
      docente: a.course.instructorName,
      precioArs: a.course.priceArs?.toString() ?? null,
      portada: a.course.coverImageUrl,
    },
    clases: a.course.lessons.map((l) => ({
      id: l.id,
      titulo: l.title,
      minutos: l.durationSeconds ? Math.max(1, Math.round(l.durationSeconds / 60)) : null,
      muestra: l.isPreview,
      lista: l.videoStatus === "READY",
    })),
    alumnos: accesos.map((x) => ({
      id: x.id,
      nombre: x.enrollment.name,
      correo: x.enrollment.email,
      origen: x.origin,
      porcentaje: porcentajeVisto(listas, x.progress.length),
    })),
  };
}
