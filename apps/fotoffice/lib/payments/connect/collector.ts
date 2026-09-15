import "server-only";
import { prisma } from "@repo/db";
import {
  resolveCollector,
  type CollectorProblem,
  type CollectorResult,
  type Collector as CollectorCompartido,
} from "@repo/payments/mercado-pago-connect";
import { FOTOFFICE_PRODUCT_KEY, workspaceOrganizationRef } from "./constants";
import { readMpConnectConfig } from "./config";

/**
 * Con quién cobra la institución.
 *
 * El flujo —leer la cuenta, descifrar la credencial, refrescar el token si está por
 * vencer— vive en `@repo/payments/mercado-pago-connect` desde el 2026-09-14, cuando Subí
 * la Foto necesitó lo mismo. Acá queda sólo que quien cobra es un workspace.
 */

export type WorkspaceCollector = CollectorCompartido;
export type { CollectorProblem, CollectorResult };

export async function resolveWorkspaceCollector(
  workspaceId: string,
  opciones: { now?: Date } = {},
): Promise<CollectorResult> {
  return resolveCollector({
    organizationRef: workspaceOrganizationRef(workspaceId),
    prisma: prisma as never,
    config: readMpConnectConfig(),
    productKey: FOTOFFICE_PRODUCT_KEY,
    now: opciones.now,
  });
}
