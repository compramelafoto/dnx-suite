/**
 * Vista previa del Informe Diario DNX — NO envía correo.
 *
 * Genera el informe contra la base configurada en DATABASE_URL y lo imprime
 * en pantalla, tal como se vería en el cuerpo del mail. Sirve para verificar
 * los números antes de que salga el envío automático de la medianoche.
 *
 * Uso:
 *   pnpm --filter compramelafoto report:preview
 *
 * Opcional: para ver otro día, pasar la fecha de corte en ISO:
 *   pnpm --filter compramelafoto report:preview -- 2026-08-20T03:00:00Z
 */

import { PrismaClient } from "@prisma/client";
import {
  buildDailyReport,
  createClfMonorepoCollector,
  createClickatonCollector,
  createFaceRecognitionCollector,
  createIncidentsCollector,
  resolveArgentinaDayWindow,
} from "@repo/ops-daily-report";

import {
  formatReportDate,
  renderAlertsBlock,
  renderFailedSectionsNote,
  renderSummaryBlock,
} from "../lib/daily-report/render-blocks";
import { createPrismaClickatonPort } from "../lib/daily-report/prisma-clickaton-port";
import { createPrismaFaceRecognitionPort } from "../lib/daily-report/prisma-face-recognition-port";
import { createPrismaSalesPort } from "../lib/daily-report/prisma-sales-port";

const prisma = new PrismaClient();

/**
 * Puerto de incidentes reducido: la versión completa depende de
 * `loadPlatformHealthSnapshot()`, que importa módulos con alias de Next y no
 * corre fuera del servidor. Acá se consultan las mismas tablas directamente.
 */
function createStandaloneIncidentsPort() {
  const MS_PER_HOUR = 60 * 60 * 1000;

  return {
    async emailQueue() {
      const [pending, failed, oldest] = await Promise.all([
        prisma.emailQueue.count({ where: { status: "PENDING" } }),
        prisma.emailQueue.count({ where: { status: "FAILED" } }),
        prisma.emailQueue.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);
      return { pending, failed, oldestPendingAt: oldest?.createdAt ?? null };
    },

    async unreconciledPaidOrders(olderThanHours: number) {
      const cutoff = new Date(Date.now() - olderThanHours * MS_PER_HOUR);
      const where = {
        status: "PAID" as const,
        isTest: false,
        digitalDeliveredAt: null,
        createdAt: { lt: cutoff },
      };
      const [count, oldest] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);
      return { count, oldestAt: oldest?.createdAt ?? null };
    },

    async openFraudAlerts() {
      const where = { status: "OPEN" };
      const [count, oldest] = await Promise.all([
        prisma.fraudAlert.count({ where }),
        prisma.fraudAlert.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);
      return { count, oldestAt: oldest?.createdAt ?? null };
    },

    async jobHealth() {
      const [zipPending, zipFailed, exifPending] = await Promise.all([
        prisma.zipGenerationJob.count({ where: { status: "PENDING" } }),
        prisma.zipGenerationJob.count({ where: { status: "FAILED" } }),
        prisma.photo.count({ where: { exifMetadataStatus: "PENDING" } }),
      ]);

      return [
        {
          label: "Generación de ZIP",
          pending: zipPending,
          failed: zipFailed,
          stuck: 0,
          oldestPendingAt: null,
        },
        {
          label: "Lectura de datos EXIF",
          pending: exifPending,
          failed: 0,
          stuck: 0,
          oldestPendingAt: null,
        },
      ];
    },
  };
}

async function main(): Promise<void> {
  const argument = process.argv[2];
  const now = argument ? new Date(argument) : new Date();

  if (Number.isNaN(now.getTime())) {
    throw new Error(`Fecha inválida: ${argument}`);
  }

  const window = resolveArgentinaDayWindow(now);
  const adminBaseUrl = process.env.APP_URL || "https://compramelafoto.com";

  const snapshot = await buildDailyReport({
    window,
    now,
    collectors: [
      createClfMonorepoCollector(createPrismaSalesPort(prisma), window, { adminBaseUrl }),
      createClickatonCollector(createPrismaClickatonPort(prisma), window, { adminBaseUrl }),
      createIncidentsCollector(createStandaloneIncidentsPort(), window, {
        adminBaseUrl,
        now,
      }),
      createFaceRecognitionCollector(createPrismaFaceRecognitionPort(prisma), window, {
        adminBaseUrl,
      }),
    ],
  });

  const separator = "═".repeat(64);

  console.log(separator);
  console.log(`INFORME DNX — ${formatReportDate(snapshot.reportDate)}`);
  console.log(`Estado: ${snapshot.status} · generado en ${snapshot.generationMs} ms`);
  console.log(`Ventana: ${window.current.start.toISOString()} → ${window.current.end.toISOString()}`);
  console.log(separator);
  console.log("");
  console.log("REQUIERE TU ATENCIÓN");
  console.log(renderAlertsBlock(snapshot.alerts));
  console.log("");
  console.log(separator);
  console.log("");
  console.log("NÚMEROS DEL DÍA");
  console.log(renderSummaryBlock(snapshot.sections));
  console.log("");

  const note = renderFailedSectionsNote(snapshot.sections);
  if (note) {
    console.log(separator);
    console.log(note);
    for (const section of snapshot.sections) {
      if (section.status === "failed") {
        console.log(`  · ${section.title}: ${section.error}`);
      }
    }
  }

  console.log(separator);
}

main()
  .catch((error) => {
    console.error("La vista previa falló:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
