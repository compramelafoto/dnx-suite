import "server-only";
import { prisma } from "@repo/db";
import { getDuesSettings } from "./settings";
import { periodOf } from "./monthly-plan";
import { monthlyDuePeriod } from "./periods";
import {
  APERTURA_PERIOD,
  chargeConceptLabel,
  chargePeriodLabel,
  fechaLegible,
  isPrintedCardCharge,
  periodoLegible,
} from "./charge-labels";
import { decimalArsToMinor } from "./money";
import {
  buildDuesReminderEmail,
  fechaConDiaYHora,
  type ReminderCharge,
  type ReminderRaffle,
} from "./dues-reminder-email";
import { planReminder, reminderWindowOpen, type ChargeForReminder } from "./dues-reminder-plan";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { DUES_EMAIL_KEYS } from "@/lib/communications/constants";
import { appUrl } from "@/lib/app-url";

/**
 * El recordatorio de cuota, enviado.
 *
 * Una vez por mes y por socio: antes de mandar se mira `SentEmailLog` y a quien ya recibió
 * el recordatorio este mes —automático o manual— no se le vuelve a escribir. Así el botón se
 * puede apretar dos veces y la tarea diaria puede correr de más sin que nadie reciba dos
 * correos iguales; y si el envío se corta a mitad de camino, la siguiente pasada sigue desde
 * donde quedó.
 */

export type ReminderReport = {
  workspace: string;
  candidatos: number;
  enviados: number;
  yaRecordados: number;
  sinEmail: number;
  fallidos: number;
  /** Título del sorteo que viaja en el correo, o `null` si no hay ninguno abierto. */
  sorteo: string | null;
};

/** Resend acepta dos envíos por segundo. Un respiro entre correos evita el rechazo por ráfaga. */
const PAUSA_ENTRE_ENVIOS_MS = 600;

export async function sendDuesReminders(input: {
  workspaceId: string;
  mode: "AUTO" | "MANUAL";
  now?: Date;
  /**
   * Cuenta sin enviar: para que la pantalla diga a cuántos les llegaría antes de apretar el
   * botón. En este modo `enviados` son los que se enviarían.
   */
  dryRun?: boolean;
}): Promise<ReminderReport> {
  const now = input.now ?? new Date();
  const settings = await getDuesSettings(input.workspaceId);
  const period = periodOf(now);
  const { dueDate } = monthlyDuePeriod(period, settings.dueDay);

  const [ctx, socios, raffle] = await Promise.all([
    loadWorkspaceEmailContext(input.workspaceId),
    prisma.member.findMany({
      where: { workspaceId: input.workspaceId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        email: true,
        userId: true,
        charges: {
          where: { balanceArs: { gt: 0 }, period: { not: APERTURA_PERIOD } },
          select: { period: true, concept: true, dueDate: true, balanceArs: true },
        },
      },
    }),
    loadOpenRaffle(input.workspaceId, now),
  ]);

  const reporte: ReminderReport = {
    workspace: ctx.organizationName,
    candidatos: 0,
    enviados: 0,
    yaRecordados: 0,
    sinEmail: 0,
    fallidos: 0,
    sorteo: raffle?.title ?? null,
  };

  const yaRecordados = await alreadyRemindedThisMonth(now);
  const base = appUrl();
  const templateKey = input.mode === "AUTO" ? DUES_EMAIL_KEYS.REMINDER : DUES_EMAIL_KEYS.REMINDER_MANUAL;

  let primero = true;
  for (const socio of socios) {
    const cargos: ChargeForReminder[] = socio.charges.map((c) => ({
      period: c.period,
      concept: c.concept,
      dueDate: c.dueDate,
      balanceMinor: decimalArsToMinor(c.balanceArs),
    }));
    const plan = planReminder({ charges: cargos, period, dueDate });
    if (!plan) continue;
    reporte.candidatos += 1;

    const email = socio.email?.trim().toLowerCase();
    if (!email) {
      reporte.sinEmail += 1;
      continue;
    }
    if (yaRecordados.has(email)) {
      reporte.yaRecordados += 1;
      continue;
    }

    if (input.dryRun) {
      reporte.enviados += 1;
      continue;
    }

    const etiqueta = (c: ChargeForReminder): ReminderCharge => ({
      label: etiquetaDeCargo(c),
      balanceMinor: c.balanceMinor,
    });

    if (!primero) await pausa(PAUSA_ENTRE_ENVIOS_MS);
    primero = false;

    const salida = await sendAndLogEmail({
      to: email,
      templateKey,
      userId: socio.userId,
      body: buildDuesReminderEmail({
        firstName: socio.firstName,
        institution: ctx.organizationName,
        current: plan.current
          ? {
              ...etiqueta(plan.current),
              dueDateLabel: fechaLegible(plan.current.dueDate),
              monthLabel: periodoLegible(period).replace(/ de \d{4}$/, ""),
            }
          : null,
        overdue: plan.overdue.map(etiqueta),
        duesUrl: base ? `${base}/portal/cuotas` : null,
        raffle: raffle ? { ...raffle, url: base ? `${base}/portal/sorteos/${raffle.id}` : null } : null,
        signature: ctx.signature,
      }),
    });

    if (salida.status === "SENT") {
      reporte.enviados += 1;
      yaRecordados.add(email);
    } else {
      reporte.fallidos += 1;
    }
  }

  return reporte;
}

/**
 * La tarea diaria: manda el recordatorio de cada institución en su día.
 *
 * Igual que la generación de cuotas, corre todos los días y cada institución decide su día.
 * La ventana de tres días es para que una corrida perdida no deje el mes sin recordatorio; el
 * registro de envíos impide que esos tres días sean tres correos.
 */
export async function sendDueRemindersForAllWorkspaces(now = new Date()): Promise<ReminderReport[]> {
  const workspaces = await prisma.workspace.findMany({
    where: {
      institutionalMembers: { some: { status: "ACTIVE" } },
      featureModules: { some: { moduleKey: "membership-dues", enabled: true } },
    },
    select: { id: true },
  });

  const reportes: ReminderReport[] = [];
  for (const ws of workspaces) {
    const settings = await getDuesSettings(ws.id);
    if (!reminderWindowOpen({ today: now.getUTCDate(), reminderDay: settings.reminderDay })) continue;
    reportes.push(await sendDuesReminders({ workspaceId: ws.id, mode: "AUTO", now }));
  }
  return reportes;
}

/** Direcciones que ya recibieron un recordatorio este mes, por cualquiera de las dos vías. */
async function alreadyRemindedThisMonth(now: Date): Promise<Set<string>> {
  const inicioDeMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const filas = await prisma.sentEmailLog.findMany({
    where: {
      templateKey: { in: [DUES_EMAIL_KEYS.REMINDER, DUES_EMAIL_KEYS.REMINDER_MANUAL] },
      status: "SENT",
      createdAt: { gte: inicioDeMes },
    },
    select: { to: true },
  });
  return new Set(filas.map((f) => f.to.trim().toLowerCase()));
}

/**
 * El sorteo que todavía admite socios: anunciado y con el padrón abierto.
 *
 * Un borrador no va —todavía puede cambiar de fecha o de premios— y uno con el padrón ya
 * cerrado tampoco: invitar a ponerse al día para un sorteo en el que ya no se puede entrar
 * sería prometer algo que no se cumple.
 */
async function loadOpenRaffle(
  workspaceId: string,
  now: Date,
): Promise<(Omit<ReminderRaffle, "url"> & { id: string }) | null> {
  const sorteo = await prisma.raffle.findFirst({
    where: { workspaceId, status: "ANUNCIADO", entriesCloseAt: { gt: now } },
    orderBy: { drawsAt: "asc" },
    select: {
      id: true,
      title: true,
      entriesCloseAt: true,
      drawsAt: true,
      prizes: {
        orderBy: { order: "asc" },
        select: { title: true, description: true, partnerNameSnapshot: true, partnerLogoSnapshot: true },
      },
    },
  });
  if (!sorteo || sorteo.prizes.length === 0) return null;

  return {
    id: sorteo.id,
    title: sorteo.title,
    drawsAtLabel: fechaConDiaYHora(sorteo.drawsAt),
    entriesCloseAtLabel: fechaConDiaYHora(sorteo.entriesCloseAt),
    prizes: sorteo.prizes.map((p) => ({
      title: p.title,
      description: p.description,
      partnerName: p.partnerNameSnapshot,
      // Sólo direcciones completas: una relativa en un correo es una imagen rota.
      logoUrl: /^https:\/\//i.test(p.partnerLogoSnapshot ?? "") ? p.partnerLogoSnapshot : null,
    })),
  };
}

/** «Cuota de septiembre de 2026», «Cuota de ingreso de octubre de 2026», «Carnet impreso». */
function etiquetaDeCargo(c: ChargeForReminder): string {
  if (isPrintedCardCharge(c.period)) return chargePeriodLabel(c.period);
  const concepto = c.concept === "MENSUAL" ? "Cuota" : chargeConceptLabel(c.concept, c.period);
  return `${concepto} de ${chargePeriodLabel(c.period)}`;
}

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
