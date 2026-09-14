/**
 * Adaptador Prisma del puerto de incidentes técnicos.
 *
 * Se apoya en `loadPlatformHealthSnapshot()`, que ya calcula el estado de las
 * colas y los trabajos en segundo plano para el panel de salud de plataforma.
 */

import type { PrismaClient } from "@prisma/client";
import type { IncidentsPort, JobHealth, QueueHealth } from "@repo/ops-daily-report";

import { loadPlatformHealthSnapshot } from "@/lib/admin/platform-health";

const MS_PER_HOUR = 60 * 60 * 1000;

export function createPrismaIncidentsPort(client: PrismaClient): IncidentsPort {
  return {
    async emailQueue(): Promise<QueueHealth> {
      const [pending, failed, oldest] = await Promise.all([
        client.emailQueue.count({ where: { status: "PENDING" } }),
        client.emailQueue.count({ where: { status: "FAILED" } }),
        client.emailQueue.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return { pending, failed, oldestPendingAt: oldest?.createdAt ?? null };
    },

    async unreconciledPaidOrders(olderThanHours: number) {
      const cutoff = new Date(Date.now() - olderThanHours * MS_PER_HOUR);

      // Cobrado pero con fotos digitales sin entregar.
      //
      // Las dos condiciones de abajo no son un detalle: sin ellas el alerta
      // contaba 32 casos donde sólo 8 eran reales, y por gritar lobo tres de
      // cada cuatro veces se dejó de leer.
      //
      // - Un pedido de sólo impresión NUNCA va a tener entrega digital, así
      //   que aparecía como pendiente para siempre.
      // - Un pack de preventa se paga antes de que existan las fotos: no tiene
      //   ítems hasta que el cliente canjea, y no hay nada que entregar todavía.
      const where = {
        status: "PAID" as const,
        isTest: false,
        digitalDeliveredAt: null,
        createdAt: { lt: cutoff },
        origin: { not: "PREVENTA_PACK" as const },
        items: { some: { productType: "DIGITAL" as const } },
      };

      const [count, oldest] = await Promise.all([
        client.order.count({ where }),
        client.order.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return { count, oldestAt: oldest?.createdAt ?? null };
    },

    async openFraudAlerts() {
      // `FraudAlert.status` guarda OPEN / ACKNOWLEDGED / RESOLVED / FALSE_POSITIVE.
      // Solo OPEN significa "nadie la miró todavía".
      const where = { status: "OPEN" };

      const [count, oldest] = await Promise.all([
        client.fraudAlert.count({ where }),
        client.fraudAlert.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return { count, oldestAt: oldest?.createdAt ?? null };
    },

    async jobHealth(): Promise<JobHealth[]> {
      const health = await loadPlatformHealthSnapshot();

      return [
        {
          label: "Generación de ZIP",
          pending: health.zip.byStatus.PENDING ?? 0,
          failed: health.zip.byStatus.FAILED ?? 0,
          stuck: health.zip.stuckOver1h,
          oldestPendingAt: null,
        },
        {
          label: "Ingesta de cámara",
          pending: health.ftp.queuePending,
          failed: health.ftp.queueFailed,
          // Con el worker caído, todo lo que espera está efectivamente trabado.
          stuck: health.ftp.workerStatus === "offline" ? health.ftp.queuePending : 0,
          oldestPendingAt: null,
        },
        {
          label: "Lectura de datos EXIF",
          pending: health.exif.pending,
          failed: health.exif.byStatus.ERROR ?? 0,
          stuck: 0,
          oldestPendingAt: null,
        },
      ];
    },
  };
}
