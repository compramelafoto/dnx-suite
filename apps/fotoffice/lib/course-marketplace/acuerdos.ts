import "server-only";
import { prisma } from "@repo/db";
import { nombresDeNegocios } from "./cargar";
import type { EstadoReventa } from "./reventa";

export type AcuerdoVista = {
  id: string;
  status: EstadoReventa;
  shareBps: number;
  memberDiscountBps: number;
  curso: { id: string; titulo: string; listaCentavos: number };
  otraParte: string;
  pausadoPorMi: boolean;
  /** La fecha que corresponde al estado actual, con su rótulo ("Activo desde", "Pausado el"…). */
  fecha: Date;
  fechaRotulo: string;
};

const SELECT = {
  id: true,
  status: true,
  shareBps: true,
  memberDiscountBps: true,
  resellerWorkspaceId: true,
  pausedByWorkspaceId: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  endedAt: true,
  course: { select: { id: true, title: true, priceArs: true, workspaceId: true } },
} as const;

function fechaDelEstado(a: { status: EstadoReventa; createdAt: Date; updatedAt: Date; approvedAt: Date | null; endedAt: Date | null }): { fecha: Date; fechaRotulo: string } {
  switch (a.status) {
    case "ACTIVO":
      return { fecha: a.approvedAt ?? a.createdAt, fechaRotulo: "Activo desde el" };
    case "PAUSADO":
      return { fecha: a.updatedAt, fechaRotulo: "Pausado el" };
    case "RECHAZADO":
      return { fecha: a.endedAt ?? a.updatedAt, fechaRotulo: "Rechazado el" };
    case "TERMINADO":
      return { fecha: a.endedAt ?? a.updatedAt, fechaRotulo: "Terminado el" };
    default:
      return { fecha: a.createdAt, fechaRotulo: "Pedido el" };
  }
}

/** Los acuerdos de un negocio: sobre sus cursos (como dueño) y los que revende. */
export async function cargarAcuerdos(workspaceId: string): Promise<{ comoDueno: AcuerdoVista[]; comoRevendedor: AcuerdoVista[] }> {
  const [comoDueno, comoRevendedor] = await Promise.all([
    prisma.courseResaleAgreement.findMany({ where: { course: { workspaceId } }, select: SELECT, orderBy: { createdAt: "desc" } }),
    prisma.courseResaleAgreement.findMany({ where: { resellerWorkspaceId: workspaceId }, select: SELECT, orderBy: { createdAt: "desc" } }),
  ]);
  const nombres = await nombresDeNegocios([
    ...new Set([...comoDueno.map((a) => a.resellerWorkspaceId), ...comoRevendedor.map((a) => a.course.workspaceId)]),
  ]);
  const vista = (a: (typeof comoDueno)[number], otra: string): AcuerdoVista => ({
    id: a.id,
    status: a.status,
    shareBps: a.shareBps,
    memberDiscountBps: a.memberDiscountBps,
    curso: { id: a.course.id, titulo: a.course.title, listaCentavos: Math.round(Number(a.course.priceArs ?? 0) * 100) },
    otraParte: nombres.get(otra) ?? "Negocio",
    pausadoPorMi: a.pausedByWorkspaceId === workspaceId,
    ...fechaDelEstado(a),
  });
  return {
    comoDueno: comoDueno.map((a) => vista(a, a.resellerWorkspaceId)),
    comoRevendedor: comoRevendedor.map((a) => vista(a, a.course.workspaceId)),
  };
}
