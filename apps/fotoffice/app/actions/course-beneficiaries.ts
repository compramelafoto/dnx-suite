"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { appUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { esSinReparto, validarFilas, type FilaBeneficiario } from "@/lib/course-marketplace/beneficiarios";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { buildAvisoBeneficiarioEmail } from "@/lib/course-marketplace/aviso-beneficiario";
import { cargarDueno } from "@/lib/course-marketplace/cargar";

const ROLES: Record<FilaBeneficiario["role"], string> = {
  DOCENTE: "Docente",
  PRODUCTOR: "Productor",
  INSTITUCION: "Institución",
  OTRO: "Otro",
};

/** Correos de los dueños y administradores de un negocio, para avisarles. */
async function correosDeDuenos(workspaceId: string): Promise<string[]> {
  const filas = await prisma.workspaceMembership.findMany({
    where: { workspaceId, role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
    select: { user: { select: { email: true } } },
  });
  return filas.map((f) => f.user.email).filter(Boolean);
}

/**
 * Guarda la lista completa de beneficiarios de un curso (reemplaza la anterior).
 *
 * - El dueño queda ACEPTADO solo. Los demás nuevos quedan INVITADOS y reciben un correo.
 * - Si a un beneficiario que ya había aceptado le cambian el % o el rol, vuelve a INVITADO:
 *   tiene que aceptar las condiciones nuevas.
 * - Si el curso deja de ser "sin reparto" y tenía "gratis para socios", se apaga: regalarlo
 *   dejaría sin cobrar a los demás (spec, sección 4.4).
 */
export async function guardarBeneficiariosAction(
  courseId: string,
  filas: FilaBeneficiario[],
): Promise<{ ok: true; aviso?: string } | { ok: false; errores: string[] }> {
  const { workspace } = await requireCoursesSalesContext("MANAGE");
  const curso = await prisma.course.findFirst({
    where: { id: courseId, workspaceId: workspace.id },
    select: { id: true, title: true, workspaceId: true, freeForMembers: true },
  });
  if (!curso) return { ok: false, errores: ["Curso no encontrado."] };

  const limpias = filas.map((f) => ({
    ...f,
    invitedEmail: f.invitedEmail?.trim().toLowerCase() || null,
    workspaceId: f.workspaceId || null,
  }));
  const errores = validarFilas(limpias);
  if (errores.length) return { ok: false, errores };

  const existentes = await prisma.courseBeneficiary.findMany({ where: { courseId } });
  const porId = new Map(existentes.map((e) => [e.id, e]));
  const avisar: Array<{ correos: string[]; porcentaje: string; rol: string }> = [];

  await prisma.$transaction(async (tx) => {
    const conservados = limpias.map((f) => f.id).filter((id): id is string => Boolean(id));
    await tx.courseBeneficiary.deleteMany({ where: { courseId, id: { notIn: conservados } } });
    for (const f of limpias) {
      const previo = f.id ? porId.get(f.id) : undefined;
      const esDueno = f.workspaceId === curso.workspaceId;
      const cambiaron =
        !previo ||
        previo.shareBps !== f.shareBps ||
        previo.role !== f.role ||
        previo.workspaceId !== f.workspaceId ||
        previo.invitedEmail !== f.invitedEmail;
      const status = esDueno ? "ACEPTADO" : cambiaron ? "INVITADO" : previo!.status;
      const data = {
        workspaceId: f.workspaceId,
        invitedEmail: f.invitedEmail,
        role: f.role,
        shareBps: f.shareBps,
        absorbsProcessorFee: f.absorbsProcessorFee,
        status,
        respondedAt: status === "INVITADO" ? null : (previo?.respondedAt ?? new Date()),
      } as const;
      if (previo) await tx.courseBeneficiary.update({ where: { id: previo.id }, data });
      else await tx.courseBeneficiary.create({ data: { courseId, ...data } });
      if (!esDueno && cambiaron) {
        avisar.push({
          correos: f.workspaceId ? await correosDeDuenos(f.workspaceId) : [f.invitedEmail!],
          porcentaje: formatoPorcentaje(f.shareBps),
          rol: ROLES[f.role],
        });
      }
    }
  });

  let aviso: string | undefined;
  if (curso.freeForMembers && !esSinReparto(curso.workspaceId, limpias)) {
    await prisma.course.update({ where: { id: courseId }, data: { freeForMembers: false } });
    aviso = 'Se apagó "Gratis para socios": con varios beneficiarios, regalarlo dejaría sin cobrar a los demás.';
  }

  // Un correo que no sale no deshace lo guardado: la invitación igual aparece en el panel.
  try {
    const dueno = await cargarDueno(curso.workspaceId);
    const enlace = `${appUrl()}/dashboard/cursos-compartidos`;
    for (const a of avisar) {
      const correo = buildAvisoBeneficiarioEmail({ dueno: dueno.nombre, curso: curso.title, porcentaje: a.porcentaje, rol: a.rol, enlace });
      for (const to of a.correos) {
        await sendTransactionalEmail({ to, subject: correo.subject, html: correo.html, text: correo.text }).catch(() => null);
      }
    }
  } catch {
    // Ídem: nada de lo de arriba debe romper el guardado.
  }

  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true, aviso };
}

/** Busca negocios de FOTOFFICE por nombre o dirección pública, para sumarlos como beneficiarios. */
export async function buscarNegociosAction(
  texto: string,
): Promise<Array<{ workspaceId: string; nombre: string; slug: string }>> {
  await requireCoursesSalesContext("MANAGE");
  const q = texto.trim();
  if (q.length < 2) return [];
  const filas = await prisma.fotofficeWorkspaceBranding.findMany({
    where: {
      OR: [
        { commercialName: { contains: q, mode: "insensitive" } },
        { publicSlug: { contains: q.toLowerCase() } },
      ],
    },
    select: { workspaceId: true, commercialName: true, publicSlug: true },
    take: 8,
    orderBy: { commercialName: "asc" },
  });
  return filas.map((f) => ({ workspaceId: f.workspaceId, nombre: f.commercialName, slug: f.publicSlug }));
}
