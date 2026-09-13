/**
 * Orquestación del aviso diario de Finanzas DNX: junta facturas vencidas e
 * impagas y proveedores sin cargar este mes, arma el correo (si hay algo que
 * avisar) y lo envía. Las decisiones de qué avisar y cómo redactarlo viven
 * en `alerts.ts`, ya probadas; acá sólo se conectan con Prisma y el email.
 */
import {
  communications,
  hasCommunicationProvider,
  registerCommunicationProvider,
} from "@repo/communications";
import { createResendEmailRuntime } from "@repo/communications/email/resend-runtime";
import type { ExpenseStatus } from "@repo/finance-control";

import { prisma } from "@/lib/prisma";
import {
  buildAlertEmail,
  shouldNagAboutMissingExpenses,
  type MissingVendorAlert,
  type OverdueInvoiceAlert,
} from "./alerts";
import { daysOverdue, diaCalendarioArgentina, isOverdueUnpaid } from "./due-date";
import { previousPeriod } from "./expense-form";

const DEFAULT_RECIPIENT = "dnxfotografia@gmail.com";

function resolveRecipients(): string[] {
  const raw = process.env.FINANCE_DNX_ALERTS_RECIPIENTS?.trim();
  if (!raw) return [DEFAULT_RECIPIENT];
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [DEFAULT_RECIPIENT];
}

/**
 * Registra el proveedor Resend de DNX Comunicaciones (mismo patrón que el
 * Informe Diario: `confirmLiveSend: true` porque el envío es la razón de ser
 * de este cron, no un efecto secundario que haya que confirmar a mano).
 */
function ensureEmailProvider(): {
  from: { email: string; name: string } | null;
  dryRun: boolean;
  blockMessage?: string;
} {
  const runtime = createResendEmailRuntime({
    env: process.env,
    confirmLiveSend: true,
  });

  if (!hasCommunicationProvider("email")) {
    registerCommunicationProvider("email", runtime.provider);
  }

  return {
    from: runtime.from,
    dryRun: runtime.dryRun,
    ...(runtime.blockMessage ? { blockMessage: runtime.blockMessage } : {}),
  };
}

export type RunFinanceDnxAlertsResult = {
  /** true si el correo se armó y al menos un destinatario lo recibió. */
  sent: boolean;
  /** true cuando no había nada que avisar: el resultado esperado casi todos los días. */
  nothingToReport: boolean;
  overdueCount: number;
  missingCount: number;
  dryRun: boolean;
};

export async function runFinanceDnxAlerts(options: {
  now: Date;
}): Promise<RunFinanceDnxAlertsResult> {
  const { now } = options;
  const [yearStr, monthStr, dayStr] = diaCalendarioArgentina(now).split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // 1. Facturas vencidas e impagas (el caso Neon: rechazos que nadie mira).
  const candidatas = await prisma.expenseEntry.findMany({
    where: { status: { in: ["RECHAZADO", "IMPAGO"] }, dueDate: { not: null } },
    include: { vendor: true },
  });

  const overdueInvoices: OverdueInvoiceAlert[] = [];
  for (const entry of candidatas) {
    if (!entry.dueDate) continue;
    const status = entry.status as ExpenseStatus;
    if (!isOverdueUnpaid(entry.dueDate, status, now)) continue;
    overdueInvoices.push({
      vendorName: entry.vendor.name,
      periodMonth: entry.periodMonth,
      status: status as "RECHAZADO" | "IMPAGO",
      amountArs: entry.amountArs.toNumber(),
      amountOriginal: entry.amountOriginal.toNumber(),
      currency: entry.currency as "USD" | "ARS",
      daysOverdue: daysOverdue(entry.dueDate, now),
    });
  }

  // 2. Proveedores activos con gasto el mes pasado y ninguno este mes.
  // Antes del día 5 todavía pueden no haber llegado todas las facturas.
  let missingVendors: MissingVendorAlert[] = [];
  let missingPeriod: { year: number; month: number } | null = null;

  if (shouldNagAboutMissingExpenses(day)) {
    const anterior = previousPeriod(year, month);
    missingPeriod = anterior;

    const entradasEsteMes = await prisma.expenseEntry.findMany({
      where: { periodYear: year, periodMonth: month },
      select: { vendorId: true },
    });
    const cargadosEsteMes = new Set(entradasEsteMes.map((e) => e.vendorId));

    const entradasMesAnterior = await prisma.expenseEntry.findMany({
      where: {
        periodYear: anterior.year,
        periodMonth: anterior.month,
        vendor: { active: true },
        vendorId: { notIn: [...cargadosEsteMes] },
      },
      include: { vendor: true },
    });

    const vistos = new Set<number>();
    for (const entry of entradasMesAnterior) {
      if (vistos.has(entry.vendorId)) continue;
      vistos.add(entry.vendorId);
      missingVendors.push({ vendorName: entry.vendor.name });
    }
  }

  const email = buildAlertEmail({ overdueInvoices, missingVendors, missingPeriod });

  if (!email) {
    return {
      sent: false,
      nothingToReport: true,
      overdueCount: 0,
      missingCount: 0,
      dryRun: false,
    };
  }

  const mailer = ensureEmailProvider();
  let sent = false;

  for (const recipient of resolveRecipients()) {
    const result = await communications.send({
      channel: "email",
      to: [{ email: recipient }],
      ...(mailer.from ? { from: mailer.from } : {}),
      subject: email.subject,
      html: email.html,
    });
    sent = sent || result.ok;
  }

  return {
    sent,
    nothingToReport: false,
    overdueCount: overdueInvoices.length,
    missingCount: missingVendors.length,
    dryRun: mailer.dryRun,
  };
}
