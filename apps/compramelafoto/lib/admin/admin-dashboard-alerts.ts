import type { PrismaClient } from "@prisma/client";

const TZ = "America/Argentina/Buenos_Aires";

export type AdminDashboardAlert = {
  /** Clave estable para UI / desestimar en cliente */
  id: string;
  type: string;
  category: "soporte" | "pagos" | "escuelas" | "seguridad" | "comunidad" | "marketing" | "sistema";
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  count: number;
  link: string;
};

type ConfigSlice = { stuckOrderDays?: number };

function pushAlert(
  out: AdminDashboardAlert[],
  a: Omit<AdminDashboardAlert, "id"> & { id?: string }
) {
  const id = a.id ?? `${a.type}:${a.link}`;
  out.push({ ...a, id });
}

/**
 * Alertas operativas para admin (dashboard y campanita).
 * Incluye conteos propios; no depende del resto del handler del dashboard.
 */
export async function getAdminDashboardAlerts(
  prisma: PrismaClient,
  config: ConfigSlice
): Promise<AdminDashboardAlert[]> {
  const stuckDays = config.stuckOrderDays ?? 7;
  const alerts: AdminDashboardAlert[] = [];

  const labsPending = await prisma.lab.count({
    where: { approvalStatus: "PENDING" },
  });
  if (labsPending > 0) {
    pushAlert(alerts, {
      type: "LABS_PENDING",
      category: "sistema",
      severity: "warning",
      title: "Laboratorios sin aprobar",
      message: `${labsPending} laboratorio(s) pendiente(s) de aprobación`,
      count: labsPending,
      link: "/admin/laboratorios?status=PENDING",
    });
  }

  const productionThreshold = new Date();
  productionThreshold.setDate(productionThreshold.getDate() - stuckDays);
  const stuckInProduction = await prisma.printOrder.count({
    where: {
      status: "IN_PRODUCTION",
      statusUpdatedAt: { lt: productionThreshold },
    },
  });
  if (stuckInProduction > 0) {
    pushAlert(alerts, {
      type: "STUCK_IN_PRODUCTION",
      category: "sistema",
      severity: "warning",
      title: "Pedidos en producción demorados",
      message: `${stuckInProduction} pedido(s) en producción hace más de ${stuckDays} días`,
      count: stuckInProduction,
      link: "/admin/pedidos?status=IN_PRODUCTION",
    });
  }

  const readyThreshold = new Date();
  readyThreshold.setDate(readyThreshold.getDate() - 3);
  const stuckReady = await prisma.printOrder.count({
    where: {
      status: "READY_TO_PICKUP",
      statusUpdatedAt: { lt: readyThreshold },
    },
  });
  if (stuckReady > 0) {
    pushAlert(alerts, {
      type: "STUCK_READY",
      category: "sistema",
      severity: "info",
      title: "Listos para retiro",
      message: `${stuckReady} pedido(s) listo(s) para retirar hace más de 3 días`,
      count: stuckReady,
      link: "/admin/pedidos?status=READY_TO_PICKUP",
    });
  }

  const nowClock = new Date();
  const monthParts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nowClock);
  const yy = parseInt(monthParts.find((p) => p.type === "year")!.value, 10);
  const mm = parseInt(monthParts.find((p) => p.type === "month")!.value, 10) - 1;
  const monthStartAR = new Date(Date.UTC(yy, mm, 1, 3, 0, 0, 0));
  const failedPayments = await prisma.printOrder.count({
    where: {
      paymentStatus: "FAILED",
      createdAt: { gte: monthStartAR },
    },
  });
  if (failedPayments > 0) {
    pushAlert(alerts, {
      type: "FAILED_PAYMENTS",
      category: "pagos",
      severity: "error",
      title: "Pagos fallidos",
      message: `${failedPayments} pago(s) fallido(s) este mes`,
      count: failedPayments,
      link: "/admin/pedidos?paymentStatus=FAILED",
    });
  }

  let openTickets = 0;
  try {
    openTickets = await prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
  } catch {
    openTickets = 0;
  }
  if (openTickets > 0) {
    pushAlert(alerts, {
      type: "OPEN_TICKETS",
      category: "soporte",
      severity: "warning",
      title: "Incidencias abiertas",
      message: `${openTickets} incidencia(s) abierta(s) o en curso`,
      count: openTickets,
      link: "/admin/soporte?status=OPEN",
    });
  }

  try {
    const userReplyNotices = await prisma.adminSystemMessage.findMany({
      where: {
        isRead: false,
        type: { startsWith: "SUPPORT_USER_REPLY:" },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    for (const row of userReplyNotices) {
      const m = row.type.match(/^SUPPORT_USER_REPLY:(\d+)$/);
      const ticketId = m?.[1];
      if (!ticketId) continue;
      const summary =
        row.body?.split("\n").slice(0, 2).join(" · ") ||
        `Ticket #${ticketId} · nueva respuesta de usuario`;
      pushAlert(alerts, {
        id: `support-user-reply-asm:${row.id}`,
        type: "SUPPORT_USER_REPLY",
        category: "soporte",
        severity: "warning",
        title: row.title || "Nueva respuesta en soporte",
        message: summary.length > 240 ? `${summary.slice(0, 240)}…` : summary,
        count: 1,
        link: `/admin/soporte/${ticketId}`,
      });
    }
  } catch {
    /* opcional */
  }

  const dayAgo = new Date();
  dayAgo.setDate(dayAgo.getDate() - 1);
  try {
    const recentTickets = await prisma.supportTicket.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        createdAt: { gte: dayAgo },
      },
    });
    if (recentTickets > 0) {
      pushAlert(alerts, {
        type: "RECENT_SUPPORT_TICKETS",
        category: "soporte",
        severity: "info",
        title: "Tickets recientes",
        message: `${recentTickets} ticket(s) de soporte en las últimas 24 h`,
        count: recentTickets,
        link: "/admin/soporte",
      });
    }
  } catch {
    /* modelo opcional */
  }

  const photographersWithoutMP = await prisma.user.count({
    where: {
      role: "PHOTOGRAPHER",
      isBlocked: false,
      OR: [{ mpAccessToken: null }, { mpUserId: null }],
    },
  });
  if (photographersWithoutMP > 0) {
    pushAlert(alerts, {
      type: "PHOTOGRAPHERS_WITHOUT_MP",
      category: "pagos",
      severity: "warning",
      title: "Fotógrafos sin Mercado Pago",
      message: `${photographersWithoutMP} fotógrafo(s) sin Mercado Pago conectado`,
      count: photographersWithoutMP,
      link: "/admin/usuarios?role=PHOTOGRAPHER",
    });
  }

  const labsWithoutMP = await prisma.lab.count({
    where: {
      approvalStatus: "APPROVED",
      isActive: true,
      isSuspended: false,
      OR: [{ mpAccessToken: null }, { mpUserId: null }],
    },
  });
  if (labsWithoutMP > 0) {
    pushAlert(alerts, {
      type: "LABS_WITHOUT_MP",
      category: "pagos",
      severity: "warning",
      title: "Laboratorios sin Mercado Pago",
      message: `${labsWithoutMP} laboratorio(s) aprobado(s) sin Mercado Pago conectado`,
      count: labsWithoutMP,
      link: "/admin/laboratorios?status=APPROVED",
    });
  }

  try {
    const pendingReferralPayouts = await prisma.referralPayoutRequest.count({
      where: { status: "PENDING" },
    });
    if (pendingReferralPayouts > 0) {
      pushAlert(alerts, {
        type: "REFERRAL_PAYOUTS_PENDING",
        category: "pagos",
        severity: "warning",
        title: "Cobros de comisiones (referidos)",
        message: `${pendingReferralPayouts} solicitud(es) de cobro por comisiones de referidos pendientes`,
        count: pendingReferralPayouts,
        link: "/admin/referral-payouts",
      });
    }
  } catch {
    /* */
  }

  try {
    const orgCommissions = await prisma.organizerCommission.count({
      where: { status: { in: ["PENDING", "REQUESTED"] } },
    });
    if (orgCommissions > 0) {
      pushAlert(alerts, {
        type: "ORGANIZER_COMMISSIONS_PENDING",
        category: "pagos",
        severity: "warning",
        title: "Comisiones institucionales",
        message: `${orgCommissions} comisión(es) de organizador pendiente(s) de liquidar`,
        count: orgCommissions,
        link: "/admin/escuelas",
      });
    }
  } catch {
    /* */
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const newLabRecs = await prisma.labRecommendation.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    if (newLabRecs > 0) {
      pushAlert(alerts, {
        type: "LAB_RECOMMENDATIONS_NEW",
        category: "comunidad",
        severity: "info",
        title: "Laboratorios recomendados",
        message: `${newLabRecs} alta(s) de laboratorio recomendado en los últimos 7 días`,
        count: newLabRecs,
        link: "/admin/recomendados",
      });
    }
  } catch {
    /* */
  }

  try {
    const newSchools = await prisma.school.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    if (newSchools > 0) {
      pushAlert(alerts, {
        type: "SCHOOLS_NEW",
        category: "escuelas",
        severity: "info",
        title: "Escuelas nuevas",
        message: `${newSchools} escuela(s) creada(s) en los últimos 7 días`,
        count: newSchools,
        link: "/admin/escuelas",
      });
    }
  } catch {
    /* */
  }

  try {
    const schoolLeadsNew = await prisma.schoolLead.count({
      where: { status: "NEW" },
    });
    if (schoolLeadsNew > 0) {
      pushAlert(alerts, {
        type: "SCHOOL_LEADS_NEW",
        category: "escuelas",
        severity: "warning",
        title: "Leads escolares sin contactar",
        message: `${schoolLeadsNew} consulta(s) de escuelas en estado nuevo`,
        count: schoolLeadsNew,
        link: "/admin/escuelas",
      });
    }
  } catch {
    /* */
  }

  try {
    const talkLeads = await prisma.talkLead.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    if (talkLeads > 0) {
      pushAlert(alerts, {
        type: "TALK_LEADS",
        category: "marketing",
        severity: "info",
        title: "Inscriptos a charlas",
        message: `${talkLeads} inscripción(es) a charlas / capacitaciones en los últimos 7 días`,
        count: talkLeads,
        link: "/admin/marketing/charlas",
      });
    }
  } catch {
    /* */
  }

  try {
    const charlaLeads = await prisma.charlaFotoEscolarLead.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    if (charlaLeads > 0) {
      pushAlert(alerts, {
        type: "CHARLA_FOTO_ESCOLAR_LEADS",
        category: "marketing",
        severity: "info",
        title: "Leads charla foto escolar",
        message: `${charlaLeads} lead(s) desde el formulario legacy en los últimos 7 días`,
        count: charlaLeads,
        link: "/admin/marketing/charlas",
      });
    }
  } catch {
    /* */
  }

  try {
    const privacyPending = await prisma.privacyRequest.count({
      where: { status: "RECEIVED" },
    });
    if (privacyPending > 0) {
      pushAlert(alerts, {
        type: "PRIVACY_REQUESTS",
        category: "seguridad",
        severity: "warning",
        title: "Solicitudes ARCO pendientes",
        message: `${privacyPending} solicitud(es) de privacidad sin iniciar trámite`,
        count: privacyPending,
        link: "/admin/privacidad/solicitudes",
      });
    }
  } catch {
    /* */
  }

  try {
    const uncollectedFees = await prisma.uncollectedPlatformFee.count({
      where: { status: "PENDING" },
    });
    if (uncollectedFees > 0) {
      pushAlert(alerts, {
        type: "UNCOLLECTED_PLATFORM_FEES",
        category: "seguridad",
        severity: "error",
        title: "Fees de plataforma sin cobrar",
        message: `${uncollectedFees} caso(s) registrado(s) de fee de plataforma pendiente de recuperar`,
        count: uncollectedFees,
        link: "/admin/finanzas",
      });
    }
  } catch {
    /* */
  }

  const order: Record<AdminDashboardAlert["severity"], number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}
