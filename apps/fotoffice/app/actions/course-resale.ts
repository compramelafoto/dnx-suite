"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { appUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { cargarDueno } from "@/lib/course-marketplace/cargar";
import { correosDeDuenos } from "@/lib/course-marketplace/correos";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { buildAvisoPedidoDeReventaEmail, buildAvisoRespuestaReventaEmail } from "@/lib/course-marketplace/aviso-reventa";
import {
  ACCIONES_REVENTA,
  ESTADOS_VIGENTES,
  aplicarAccion,
  estadoAlPedir,
  porcentajeABps,
  validarDescuentoDeSocios,
  validarOferta,
  validarPedidoDeReventa,
  type AccionReventa,
  type EstadoReventa,
  type LadoReventa,
} from "@/lib/course-marketplace/reventa";

export type EstadoFormulario = { error: string | null; ok: string | null };

const RUTA_ACUERDOS = "/dashboard/mercado-de-cursos/acuerdos";

const CODIGO_OK: Record<AccionReventa, string> = {
  APROBAR: "aprobado",
  RECHAZAR: "rechazado",
  PAUSAR: "pausado",
  REANUDAR: "reanudado",
  TERMINAR: "terminado",
};

/** Dueño o admin del negocio activo, con el módulo de cursos: un acuerdo compromete plata. */
async function gestion() {
  const { user, workspace } = await requireCoursesSalesContext("MANAGE");
  const membresia = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  return isFullAccessRole(membresia?.role) ? { user, workspace } : null;
}

/** Un correo que no sale no deshace nada: el pedido o la respuesta ya quedaron guardados. */
async function avisar(correos: string[], correo: { subject: string; html: string; text: string }, contexto: Record<string, string>) {
  for (const to of correos) {
    const r = await sendTransactionalEmail({ to, subject: correo.subject, html: correo.html, text: correo.text }).catch(
      (): { status: string } => ({ status: "INTERNAL_ERROR" }),
    );
    if (r.status !== "SENT") console.error("[fotoffice][mercado-cursos] no salió un aviso de reventa", { ...contexto, motivo: r.status });
  }
}

/** El dueño ofrece (o deja de ofrecer) un curso en el Mercado y fija el % sugerido. */
export async function guardarOfertaAction(courseId: string, _prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const ctx = await gestion();
  if (!ctx) return { error: "Sólo el dueño o un administrador del negocio puede ofrecer el curso.", ok: null };
  const curso = await prisma.course.findFirst({
    where: { id: courseId, workspaceId: ctx.workspace.id },
    select: { deliveryMode: true, priceArs: true },
  });
  if (!curso) return { error: "Curso no encontrado.", ok: null };
  const ofrecido = formData.get("ofrecido") === "on";
  const sugeridoBps = porcentajeABps(formData.get("sugerido")?.toString());
  const errores = validarOferta({
    ofrecido,
    sugeridoBps,
    grabadoConPrecio: curso.deliveryMode === "RECORDED" && Number(curso.priceArs ?? 0) > 0,
  });
  if (errores.length) return { error: errores.join(" "), ok: null };
  await prisma.course.update({
    where: { id: courseId },
    data: { offeredToResellers: ofrecido, ...(ofrecido && sugeridoBps !== null ? { suggestedResellerBps: sugeridoBps } : {}) },
  });
  revalidatePath(`/dashboard/courses/${courseId}`);
  revalidatePath("/dashboard/mercado-de-cursos");
  return {
    error: null,
    ok: ofrecido
      ? "Listo: el curso aparece en el Mercado de cursos."
      : "Listo: el curso ya no se ofrece a otras instituciones. Los acuerdos vigentes siguen.",
  };
}

/** "Quiero venderlo": la institución pide revender con su % y el descuento para sus socios. */
export async function pedirReventaAction(courseId: string, _prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const ctx = await gestion();
  if (!ctx) return { error: "Sólo el dueño o un administrador del negocio puede pedir una reventa.", ok: null };
  const curso = await prisma.course.findFirst({
    where: { id: courseId, status: "PUBLISHED", deliveryMode: "RECORDED" },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      offeredToResellers: true,
      suggestedResellerBps: true,
      beneficiaries: { select: { workspaceId: true } },
      resaleAgreements: { where: { resellerWorkspaceId: ctx.workspace.id }, select: { id: true, status: true } },
    },
  });
  if (!curso) return { error: "Curso no encontrado.", ok: null };

  const pedidoBps = porcentajeABps(formData.get("porcentaje")?.toString());
  const descuentoBps = porcentajeABps(formData.get("descuento")?.toString()) ?? 0;
  const previo = curso.resaleAgreements[0] ?? null;
  const errores = validarPedidoDeReventa({
    pedidoBps,
    descuentoBps,
    ofrecido: curso.offeredToResellers,
    sugeridoBps: curso.suggestedResellerBps,
    esDueno: curso.workspaceId === ctx.workspace.id,
    esBeneficiario: curso.beneficiaries.some((b) => b.workspaceId === ctx.workspace.id),
    cantidadBeneficiarios: curso.beneficiaries.length,
    acuerdoVigente: previo !== null && ESTADOS_VIGENTES.includes(previo.status as EstadoReventa),
  });
  if (errores.length || pedidoBps === null || curso.suggestedResellerBps === null) {
    return { error: errores.join(" ") || "Pedido inválido.", ok: null };
  }

  const status = estadoAlPedir(pedidoBps, curso.suggestedResellerBps);
  const data = {
    shareBps: pedidoBps,
    memberDiscountBps: descuentoBps,
    status,
    requestedByUserId: ctx.user.id,
    approvedByUserId: null,
    approvedAt: status === "ACTIVO" ? new Date() : null,
    pausedByWorkspaceId: null,
    endedAt: null,
  };
  try {
    // Un acuerdo rechazado o terminado se reabre en la misma fila: un curso, un acuerdo por institución.
    if (previo) await prisma.courseResaleAgreement.update({ where: { id: previo.id }, data });
    else await prisma.courseResaleAgreement.create({ data: { courseId: curso.id, resellerWorkspaceId: ctx.workspace.id, ...data } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ya tenés un acuerdo para este curso. Lo ves en tus acuerdos.", ok: null };
    }
    throw error;
  }

  if (status === "PENDIENTE") {
    try {
      const [revendedor, correos] = await Promise.all([cargarDueno(ctx.workspace.id), correosDeDuenos(curso.workspaceId)]);
      const correo = buildAvisoPedidoDeReventaEmail({
        revendedor: revendedor.nombre,
        curso: curso.title,
        porcentaje: formatoPorcentaje(pedidoBps),
        sugerido: formatoPorcentaje(curso.suggestedResellerBps),
        enlace: `${appUrl()}${RUTA_ACUERDOS}`,
      });
      await avisar(correos, correo, { courseId: curso.id });
    } catch {
      // Ídem: el pedido ya quedó guardado y el dueño lo ve en sus acuerdos.
    }
  }
  revalidatePath("/dashboard/mercado-de-cursos");
  revalidatePath(RUTA_ACUERDOS);
  return {
    error: null,
    ok:
      status === "ACTIVO"
        ? "Listo: ya podés venderlo. Aparece en tu sitio y en el portal de tus socios."
        : "Pedido enviado. Como supera el % sugerido, el dueño tiene que aprobarlo.",
  };
}

/** Aprobar, rechazar, pausar, reanudar o terminar un acuerdo, desde cualquiera de los dos lados. */
export async function cambiarEstadoDeReventaAction(agreementId: string, accion: AccionReventa): Promise<void> {
  // La acción viaja desde el navegador: se valida contra la lista cerrada.
  if (!ACCIONES_REVENTA.includes(accion)) redirect(`${RUTA_ACUERDOS}?r=no-encontrado`);
  const ctx = await gestion();
  if (!ctx) redirect(`${RUTA_ACUERDOS}?r=sin-permiso`);
  const acuerdo = await prisma.courseResaleAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      status: true,
      pausedByWorkspaceId: true,
      resellerWorkspaceId: true,
      course: { select: { id: true, title: true, workspaceId: true } },
    },
  });
  const lado: LadoReventa | null = !acuerdo
    ? null
    : acuerdo.course.workspaceId === ctx.workspace.id
      ? "DUENO"
      : acuerdo.resellerWorkspaceId === ctx.workspace.id
        ? "REVENDEDOR"
        : null;
  if (!acuerdo || !lado) redirect(`${RUTA_ACUERDOS}?r=no-encontrado`);

  const pausadoPor: LadoReventa | null =
    acuerdo.pausedByWorkspaceId === null ? null : acuerdo.pausedByWorkspaceId === acuerdo.course.workspaceId ? "DUENO" : "REVENDEDOR";
  const r = aplicarAccion({ status: acuerdo.status as EstadoReventa, pausadoPor }, accion, lado);
  if (!r.ok) redirect(`${RUTA_ACUERDOS}?r=${r.codigo}`);

  const ahora = new Date();
  // Atómico: sólo cambia si el estado sigue siendo el que se leyó (doble clic, los dos lados a la vez).
  const { count } = await prisma.courseResaleAgreement.updateMany({
    where: { id: acuerdo.id, status: acuerdo.status },
    data: {
      status: r.status,
      pausedByWorkspaceId: r.pausadoPor === null ? null : r.pausadoPor === "DUENO" ? acuerdo.course.workspaceId : acuerdo.resellerWorkspaceId,
      ...(accion === "APROBAR" ? { approvedAt: ahora, approvedByUserId: ctx.user.id } : {}),
      ...(r.status === "TERMINADO" || r.status === "RECHAZADO" ? { endedAt: ahora } : {}),
    },
  });
  if (count === 0) redirect(`${RUTA_ACUERDOS}?r=no-pendiente`);

  if (accion === "APROBAR" || accion === "RECHAZAR") {
    try {
      const [dueno, correos] = await Promise.all([cargarDueno(acuerdo.course.workspaceId), correosDeDuenos(acuerdo.resellerWorkspaceId)]);
      const correo = buildAvisoRespuestaReventaEmail({
        dueno: dueno.nombre,
        curso: acuerdo.course.title,
        aprobado: accion === "APROBAR",
        enlace: `${appUrl()}${RUTA_ACUERDOS}`,
      });
      await avisar(correos, correo, { agreementId: acuerdo.id });
    } catch {
      // La respuesta ya quedó guardada.
    }
  }
  revalidatePath(RUTA_ACUERDOS);
  revalidatePath("/dashboard/mercado-de-cursos");
  redirect(`${RUTA_ACUERDOS}?r=${CODIGO_OK[accion]}`);
}

/** El revendedor cambia el descuento para sus socios: de 0 hasta su %. Vale para las ventas nuevas. */
export async function cambiarDescuentoDeReventaAction(agreementId: string, formData: FormData): Promise<void> {
  const ctx = await gestion();
  if (!ctx) redirect(`${RUTA_ACUERDOS}?r=sin-permiso`);
  const acuerdo = await prisma.courseResaleAgreement.findFirst({
    where: { id: agreementId, resellerWorkspaceId: ctx.workspace.id },
    select: { id: true, shareBps: true, status: true },
  });
  if (!acuerdo || !ESTADOS_VIGENTES.includes(acuerdo.status as EstadoReventa)) redirect(`${RUTA_ACUERDOS}?r=no-encontrado`);
  const descuentoBps = porcentajeABps(formData.get("descuento")?.toString()) ?? 0;
  if (validarDescuentoDeSocios(descuentoBps, acuerdo.shareBps).length > 0) redirect(`${RUTA_ACUERDOS}?r=descuento-invalido`);
  await prisma.courseResaleAgreement.update({ where: { id: acuerdo.id }, data: { memberDiscountBps: descuentoBps } });
  revalidatePath(RUTA_ACUERDOS);
  redirect(`${RUTA_ACUERDOS}?r=descuento`);
}
