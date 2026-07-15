import { listPublicEventsV1 } from "../../../../lib/public-api/v1";
import {
  logPublicApiUnexpectedError,
  publicEventsListResponseV1,
  toPublicApiErrorResponseV1,
} from "../../../../lib/public-api/v1/http";

/** Prisma y loaders V1 requieren Node. */
export const runtime = "nodejs";

/**
 * GET /api/public/v1/events
 * Listado público: solo eventos PUBLIC listables (excluye UNLISTED y PRIVATE).
 */
export async function GET() {
  try {
    const items = await listPublicEventsV1();
    return publicEventsListResponseV1(items);
  } catch (error) {
    logPublicApiUnexpectedError({
      endpoint: "/api/public/v1/events",
      operation: "listPublicEventsV1",
      error,
    });
    return toPublicApiErrorResponseV1(error);
  }
}
