/**
 * Orquestación del Informe Diario DNX: arma el informe, lo guarda y lo envía.
 */

import {
  communications,
  hasCommunicationProvider,
  registerCommunicationProvider,
} from "@repo/communications";
import { createResendEmailRuntime } from "@repo/communications/email/resend-runtime";
import {
  countCriticalAlerts,
  recordDailyReportDelivery,
  saveDailyReportSnapshot,
} from "@repo/db/daily-report-repository";
import {
  buildDailyReport,
  createClfMonorepoCollector,
  createClickatonCollector,
  createFaceRecognitionCollector,
  createFotofficeCollector,
  createFotorankCollector,
  createIncidentsCollector,
  createInfoSpotCollector,
  resolveArgentinaDayWindow,
} from "@repo/ops-daily-report";

import { prisma } from "@/lib/prisma";
import { createClfLegacyCollector } from "./clf-legacy-collector";
import { createPrismaClickatonPort } from "./prisma-clickaton-port";
import { createPrismaFotofficePort } from "./prisma-fotoffice-port";
import { createPrismaFotorankPort } from "./prisma-fotorank-port";
import { createPrismaInfoSpotPort } from "./prisma-infospot-port";
import { createPrismaFaceRecognitionPort } from "./prisma-face-recognition-port";
import { createPrismaIncidentsPort } from "./prisma-incidents-port";
import { createPrismaSalesPort } from "./prisma-sales-port";
import {
  formatReportDate,
  renderAlertsBlock,
  renderFailedSectionsNote,
  renderSummaryBlock,
} from "./render-blocks";

const STATUS_LABELS = {
  complete: "Completo",
  partial: "Parcial",
  failed: "Fallido",
} as const;

const DEFAULT_RECIPIENT = "dnxfotografia@gmail.com";

function resolveRecipients(): string[] {
  const raw = process.env.DAILY_REPORT_RECIPIENTS?.trim();
  if (!raw) return [DEFAULT_RECIPIENT];
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [DEFAULT_RECIPIENT];
}

/** URL pública de una app hermana, con respaldo si no está configurada. */
function resolveAppUrl(envKey: string, fallback: string): string {
  return (process.env[envKey] || fallback).replace(/\/$/, "");
}

function resolveClickatonBaseUrl(): string {
  return (
    process.env.CLICKATON_PUBLIC_URL ||
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL ||
    "https://clickaton.com"
  ).replace(/\/$/, "");
}

function resolveBaseUrl(): string {
  return (process.env.APP_URL || "https://compramelafoto.com").replace(/\/$/, "");
}

/**
 * Registra el proveedor Resend de DNX Comunicaciones.
 *
 * El módulo trae un candado deliberado: no envía nada real salvo que
 * COMMUNICATIONS_LIVE_SEND sea "true", el destinatario esté en
 * RESEND_ALLOWED_RECIPIENTS, y el llamador confirme el envío. `confirmLiveSend`
 * existe para que un script interactivo no mande correos por accidente; acá el
 * envío es la razón de ser del cron, así que se confirma en el código.
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

export type RunDailyReportResult = {
  reportDate: string;
  status: string;
  delivered: boolean;
  criticalAlerts: number;
  dryRun: boolean;
};

export async function runDailyReport(options: { now: Date }): Promise<RunDailyReportResult> {
  const window = resolveArgentinaDayWindow(options.now);
  const adminBaseUrl = resolveBaseUrl();
  const clickatonBaseUrl = resolveClickatonBaseUrl();

  const snapshot = await buildDailyReport({
    window,
    now: options.now,
    collectors: [
      createClfMonorepoCollector(createPrismaSalesPort(prisma), window, { adminBaseUrl }),
      createClfLegacyCollector(window, { adminBaseUrl }),
      createClickatonCollector(createPrismaClickatonPort(prisma), window, {
        adminBaseUrl: clickatonBaseUrl,
      }),
      createFotorankCollector(createPrismaFotorankPort(prisma), window, {
        adminBaseUrl: resolveAppUrl("FOTORANK_PUBLIC_URL", "https://fotorank.dnxsuite.com"),
      }),
      createInfoSpotCollector(createPrismaInfoSpotPort(prisma), window, {
        adminBaseUrl: resolveAppUrl("NEXT_PUBLIC_INFOSPOT_URL", "https://infospot.dnxsuite.com"),
      }),
      createFotofficeCollector(createPrismaFotofficePort(prisma), window, {
        adminBaseUrl: resolveAppUrl("FOTOFFICE_PUBLIC_URL", "https://fotoffice.dnxsuite.com"),
      }),
      createIncidentsCollector(createPrismaIncidentsPort(prisma), window, {
        adminBaseUrl,
        now: options.now,
      }),
      createFaceRecognitionCollector(createPrismaFaceRecognitionPort(prisma), window, {
        adminBaseUrl,
      }),
    ],
  });

  const saved = await saveDailyReportSnapshot(prisma, snapshot);
  const criticalAlerts = countCriticalAlerts(snapshot);
  const failedSectionsNote = renderFailedSectionsNote(snapshot.sections);

  const mailer = ensureEmailProvider();

  const rendered = await communications.render({
    templateId: "ops.daily-report",
    brandId: "dnx",
    locale: "es-AR",
    data: {
      reportDate: formatReportDate(snapshot.reportDate),
      status: STATUS_LABELS[snapshot.status],
      criticalCount: criticalAlerts,
      alertsBlock: renderAlertsBlock(snapshot.alerts),
      summaryBlock: renderSummaryBlock(snapshot.sections),
      panelUrl: `${adminBaseUrl}/admin/informe-diario`,
      ...(failedSectionsNote ? { failedSectionsNote } : {}),
    },
  });

  if (!rendered.ok) {
    throw new Error(
      `No se pudo generar el correo del informe: ${rendered.errorCode ?? "error desconocido"}`,
    );
  }

  let delivered = false;

  for (const recipient of resolveRecipients()) {
    try {
      const result = await communications.send({
        channel: "email",
        to: [{ email: recipient }],
        ...(mailer.from ? { from: mailer.from } : {}),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      // `ok` es true solo cuando status === "success".
      delivered = delivered || result.ok;

      await recordDailyReportDelivery(prisma, {
        snapshotId: saved.id,
        recipient,
        status: result.ok ? "SENT" : result.status === "skipped" ? "SKIPPED" : "FAILED",
        providerMessageId: result.providerMessageId ?? null,
        error: result.ok
          ? null
          : (result.errorMessage ??
            mailer.blockMessage ??
            "Envío no confirmado por el proveedor."),
      });
    } catch (error) {
      await recordDailyReportDelivery(prisma, {
        snapshotId: saved.id,
        recipient,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Error desconocido al enviar.",
      });
    }
  }

  return {
    reportDate: snapshot.reportDate,
    status: snapshot.status,
    delivered,
    criticalAlerts,
    dryRun: mailer.dryRun,
  };
}
