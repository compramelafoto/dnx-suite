/**
 * Colector de ComprameLaFoto legacy.
 *
 * Reutiliza el mismo colector de ventas del monorepo, porque ambas
 * instalaciones comparten modelo de datos. Lo único que cambia es la base:
 * acá se usa el cliente de SOLO LECTURA (`CLF_READONLY_DATABASE_URL`), que
 * bloquea cualquier escritura por diseño.
 *
 * Si la variable no está configurada, el colector falla de forma controlada y
 * el informe sale igual con esa sección marcada como no disponible.
 */

import type { PrismaClient } from "@prisma/client";
import { getClfReadonlyClient, getClfReadonlyConnectionInfo } from "@repo/db";
import { createClfMonorepoCollector, type Collector, type DayWindow } from "@repo/ops-daily-report";

import { createPrismaSalesPort } from "./prisma-sales-port";

export const CLF_LEGACY_SECTION_KEY = "clf-legacy";
export const CLF_LEGACY_SECTION_TITLE = "ComprameLaFoto (legacy)";

export function createClfLegacyCollector(
  window: DayWindow,
  options: { adminBaseUrl: string },
): Collector {
  return {
    key: CLF_LEGACY_SECTION_KEY,
    title: CLF_LEGACY_SECTION_TITLE,
    async run() {
      const connection = getClfReadonlyConnectionInfo();

      if (!connection.configured) {
        throw new Error(
          "CLF_READONLY_DATABASE_URL no está configurada: no se puede leer la base legacy.",
        );
      }
      if (connection.isBlockedStagingEmptyHost) {
        throw new Error(
          `La conexión legacy apunta a un host bloqueado (${connection.reason ?? "staging"}).`,
        );
      }

      const client = getClfReadonlyClient() as unknown as PrismaClient;

      const inner = createClfMonorepoCollector(createPrismaSalesPort(client), window, {
        adminBaseUrl: options.adminBaseUrl,
        sectionKey: CLF_LEGACY_SECTION_KEY,
        sectionTitle: CLF_LEGACY_SECTION_TITLE,
        platform: "clf-legacy",
      });

      return inner.run();
    },
  };
}
