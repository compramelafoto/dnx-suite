import "server-only";
import { prisma } from "@repo/db";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { FOTOFFICE_BLOG_PLATFORM } from "@/lib/blog/scope";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import { projectStatusLabel } from "@/lib/governance/labels";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { mergeNotices, windowStart, type Notice } from "./feed";

/**
 * De dónde salen las novedades de cada socio. Cada fuente es independiente: si una falla (una
 * tabla que todavía no existe en alguna base, un módulo a medio configurar), las demás siguen.
 * Sólo se consultan las de los módulos encendidos en la institución.
 */

type Contexto = {
  workspaceId: string;
  memberId: string;
  userId: number;
  publicSlug: string | null;
  desde: Date;
  ahora: Date;
};

type Fuente = (c: Contexto) => Promise<Notice[]>;

const periodo = (p: string) => {
  const [a, m] = p.split("-");
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const i = Number(m) - 1;
  return meses[i] ? `${meses[i]} ${a}` : p;
};

const blog: Fuente = async (c) => {
  if (!c.publicSlug) return [];
  const posts = await prisma.blogPost.findMany({
    where: {
      platform: FOTOFFICE_BLOG_PLATFORM,
      workspaceKey: c.workspaceId,
      status: "PUBLISHED",
      publishedAt: { gte: c.desde, lte: c.ahora },
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true },
  });
  return posts.map((p) => ({
    key: `blog:${p.id}`,
    kind: "blog" as const,
    title: p.title,
    body: p.excerpt ? (p.excerpt.length > 140 ? `${p.excerpt.slice(0, 137)}…` : p.excerpt) : "Nuevo artículo en el blog.",
    href: `/w/${c.publicSlug}/blog/${p.slug}`,
    at: p.publishedAt!,
  }));
};

const PROYECTO_ACTIVO = ["PROPOSED", "IN_REVIEW", "POSTPONED", "APPROVED", "IN_PROGRESS"];

const gobierno: Fuente = async (c) => {
  const [libres, asignadas, cambios] = await Promise.all([
    // Tareas nuevas que nadie tomó todavía, de proyectos visibles.
    prisma.govProjectTask.findMany({
      where: {
        assigneeMemberId: null,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        createdAt: { gte: c.desde },
        project: { workspaceId: c.workspaceId, visibleToMembers: true, status: { in: PROYECTO_ACTIVO } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, createdAt: true, project: { select: { title: true } } },
    }),
    // Tareas que me asignaron (no las que tomé yo).
    prisma.govProjectEvent.findMany({
      where: {
        type: "TASK_ASSIGNED",
        createdAt: { gte: c.desde },
        NOT: { actorUserId: c.userId },
        project: { workspaceId: c.workspaceId, tasks: { some: { assigneeMemberId: c.memberId } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, taskId: true, createdAt: true, data: true, project: { select: { title: true } } },
    }),
    // Cambios de estado en mis propuestas y en los proyectos visibles.
    prisma.govProjectEvent.findMany({
      where: {
        type: "STATUS_CHANGED",
        createdAt: { gte: c.desde },
        project: {
          workspaceId: c.workspaceId,
          OR: [{ proposedByMemberId: c.memberId }, { visibleToMembers: true }],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        createdAt: true,
        data: true,
        project: { select: { id: true, title: true, proposedByMemberId: true } },
      },
    }),
  ]);
  const misTareas = new Set(
    (
      await prisma.govProjectTask.findMany({
        where: { assigneeMemberId: c.memberId, id: { in: asignadas.flatMap((a) => (a.taskId ? [a.taskId] : [])) } },
        select: { id: true },
      })
    ).map((t) => t.id),
  );
  const out: Notice[] = [];
  for (const t of libres) {
    out.push({
      key: `task_open:${t.id}`,
      kind: "task_open",
      title: t.title,
      body: `${t.project.title}: todavía no tiene a nadie a cargo. ¿Te sumás?`,
      href: "/portal/tareas#ayudar",
      at: t.createdAt,
    });
  }
  for (const e of asignadas) {
    if (!e.taskId || !misTareas.has(e.taskId)) continue;
    const d = (e.data ?? {}) as { title?: string };
    out.push({
      key: `task_assigned:${e.id}`,
      kind: "task_assigned",
      title: `Te asignaron «${d.title ?? "una tarea"}»`,
      body: e.project.title,
      href: `/portal/tareas/${e.taskId}`,
      at: e.createdAt,
    });
  }
  for (const e of cambios) {
    const d = (e.data ?? {}) as { to?: string };
    const mia = e.project.proposedByMemberId === c.memberId;
    const estado = d.to ? projectStatusLabel(d.to) : "otro estado";
    out.push({
      key: `project:${e.id}`,
      kind: mia ? "proposal" : "project",
      title: mia ? `Tu propuesta «${e.project.title}» pasó a «${estado}»` : `«${e.project.title}»: ${estado}`,
      body: null,
      href: `/portal/proyectos/${e.project.id}`,
      at: e.createdAt,
    });
  }
  return out;
};

const sorteos: Fuente = async (c) => {
  const [eventos, premios] = await Promise.all([
    prisma.raffleEvent.findMany({
      where: {
        type: { in: ["ANUNCIADO", "SORTEADO"] },
        createdAt: { gte: c.desde },
        raffle: { workspaceId: c.workspaceId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, createdAt: true, raffle: { select: { id: true, title: true } } },
    }),
    prisma.rafflePrizeAward.findMany({
      where: { memberId: c.memberId, createdAt: { gte: c.desde }, status: { not: "ANULADO" } },
      select: { id: true, createdAt: true, raffleId: true, prize: { select: { title: true } }, raffle: { select: { title: true } } },
    }),
  ]);
  return [
    ...eventos.map((e) => ({
      key: `raffle:${e.id}`,
      kind: "raffle" as const,
      title: e.type === "ANUNCIADO" ? `Nuevo sorteo: ${e.raffle.title}` : `Resultados del sorteo: ${e.raffle.title}`,
      body: e.type === "ANUNCIADO" ? "Participan los socios al día." : "Mirá quiénes ganaron.",
      href: `/portal/sorteos/${e.raffle.id}`,
      at: e.createdAt,
    })),
    ...premios.map((p) => ({
      key: `raffle_win:${p.id}`,
      kind: "raffle_win" as const,
      title: `¡Ganaste ${p.prize.title}!`,
      body: `En el sorteo ${p.raffle.title}. Entrá para ver cómo retirarlo.`,
      href: `/portal/sorteos/${p.raffleId}`,
      at: p.createdAt,
    })),
  ];
};

const cursos: Fuente = async (c) => {
  const nuevos = await prisma.course.findMany({
    where: { workspaceId: c.workspaceId, status: { in: ["PUBLISHED", "UPCOMING"] }, createdAt: { gte: c.desde } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, createdAt: true },
  });
  return nuevos.map((x) => ({
    key: `course:${x.id}`,
    kind: "course" as const,
    title: `Nuevo curso: ${x.title}`,
    body: "Mirá las fechas y si te toca gratis por ser socio.",
    href: "/portal/cursos",
    at: x.createdAt,
  }));
};

const cuotas: Fuente = async (c) => {
  const cargos = await prisma.membershipCharge.findMany({
    where: {
      memberId: c.memberId,
      OR: [{ createdAt: { gte: c.desde } }, { dueDate: { gte: c.desde, lte: c.ahora }, balanceArs: { gt: 0 } }],
    },
    select: { id: true, period: true, createdAt: true, dueDate: true, balanceArs: true },
  });
  const out: Notice[] = [];
  for (const g of cargos) {
    if (g.createdAt >= c.desde) {
      out.push({
        key: `dues_new:${g.id}`,
        kind: "dues",
        title: `Nueva cuota: ${periodo(g.period)}`,
        body: "Podés pagarla desde Mis cuotas.",
        href: "/portal/cuotas",
        at: g.createdAt,
      });
    }
    if (Number(g.balanceArs) > 0 && g.dueDate <= c.ahora && g.dueDate >= c.desde) {
      out.push({
        key: `dues_overdue:${g.id}`,
        kind: "dues",
        title: `Venció tu cuota de ${periodo(g.period)}`,
        body: "Pagala para seguir al día (y participar de los sorteos).",
        href: "/portal/cuotas",
        at: g.dueDate,
      });
    }
  }
  return out;
};

const coberturas: Fuente = async (c) => {
  const llamados = await prisma.coverageCall.findMany({
    where: { workspaceId: c.workspaceId, status: "PUBLICADA", publishedAt: { gte: c.desde, lte: c.ahora } },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: { id: true, title: true, publishedAt: true },
  });
  return llamados.map((l) => ({
    key: `coverage:${l.id}`,
    kind: "coverage" as const,
    title: `Convocatoria abierta: ${l.title}`,
    body: "Anotate si querés cubrirla.",
    href: `/portal/coberturas/${l.id}`,
    at: l.publishedAt!,
  }));
};

const socioDeLaSemana: Fuente = async (c) => {
  const destacados = await prisma.memberSpotlight.findMany({
    where: { workspaceId: c.workspaceId, publishedAt: { gte: c.desde, lte: c.ahora }, skippedAt: null },
    orderBy: { publishedAt: "desc" },
    take: 4,
    select: { id: true, memberId: true, publishedAt: true, member: { select: { firstName: true, lastName: true } } },
  });
  return destacados.map((d) => {
    const yo = d.memberId === c.memberId;
    return {
      key: `spotlight:${d.id}`,
      kind: "spotlight" as const,
      title: yo ? "¡Sos el socio de la semana!" : `Socio de la semana: ${d.member.firstName} ${d.member.lastName}`.trim(),
      body: yo ? "Tu placa ya está publicada. ¡Felicitaciones!" : "Conocé su trabajo.",
      href: "/portal",
      at: d.publishedAt!,
    };
  });
};

const reservas: Fuente = async (c) => {
  const rs = await prisma.booking.findMany({
    where: { memberId: c.memberId, workspaceId: c.workspaceId, status: { in: ["CONFIRMED", "CANCELLED"] }, updatedAt: { gte: c.desde } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, status: true, startAt: true, updatedAt: true, space: { select: { name: true } } },
  });
  const fecha = (d: Date) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return rs.map((r) => ({
    key: `booking:${r.id}:${r.status}`,
    kind: "booking" as const,
    title: r.status === "CONFIRMED" ? `Reserva confirmada: ${r.space.name}` : `Reserva cancelada: ${r.space.name}`,
    body: `Para el ${fecha(r.startAt)} h.`,
    href: "/portal/reservas",
    at: r.updatedAt,
  }));
};

const FUENTES: { modulos: string[]; fuente: Fuente; nombre: string }[] = [
  { nombre: "blog", modulos: [WEBSITE_MODULE_KEY], fuente: blog },
  { nombre: "gobierno", modulos: [GOVERNANCE_MODULE_KEY], fuente: gobierno },
  { nombre: "sorteos", modulos: [RAFFLES_MODULE_KEY], fuente: sorteos },
  { nombre: "cursos", modulos: [COURSES_SALES_MODULE_KEY], fuente: cursos },
  { nombre: "cuotas", modulos: [MEMBERSHIP_DUES_MODULE_KEY, MEMBERS_MODULE_KEY], fuente: cuotas },
  { nombre: "coberturas", modulos: [COVERAGES_MODULE_KEY], fuente: coberturas },
  { nombre: "socio-de-la-semana", modulos: [COMMUNICATIONS_MODULE_KEY], fuente: socioDeLaSemana },
  { nombre: "reservas", modulos: [BOOKINGS_MODULE_KEY], fuente: reservas },
];

export async function loadMemberNotices(input: { workspaceId: string; memberId: string; userId: number; now?: Date }) {
  const ahora = input.now ?? new Date();
  const [encendidos, branding, visto] = await Promise.all([
    getEnabledModuleKeysForWorkspace(input.workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: input.workspaceId }, select: { publicSlug: true } }),
    prisma.memberNotificationSeen.findUnique({ where: { memberId: input.memberId }, select: { lastSeenAt: true } }).catch(() => null),
  ]);
  const c: Contexto = {
    workspaceId: input.workspaceId,
    memberId: input.memberId,
    userId: input.userId,
    publicSlug: branding?.publicSlug ?? null,
    desde: windowStart(ahora),
    ahora,
  };
  const grupos = await Promise.all(
    FUENTES.filter((f) => f.modulos.some((m) => encendidos.has(m))).map((f) =>
      f.fuente(c).catch((error: unknown) => {
        console.error(`[fotoffice][novedades] falló la fuente ${f.nombre}`, {
          detalle: error instanceof Error ? error.message : "error desconocido",
        });
        return [] as Notice[];
      }),
    ),
  );
  return { items: mergeNotices(grupos, ahora), lastSeenAt: visto?.lastSeenAt ?? null };
}

/** El socio abrió la campanita: todo lo anterior a este momento ya está visto. */
export async function markNoticesSeen(memberId: string, at: Date = new Date()): Promise<void> {
  await prisma.memberNotificationSeen.upsert({
    where: { memberId },
    create: { memberId, lastSeenAt: at },
    update: { lastSeenAt: at },
  });
}
