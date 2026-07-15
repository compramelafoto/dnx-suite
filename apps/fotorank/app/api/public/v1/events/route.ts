import { listPublicEventsV1 } from "../../../../lib/public-api/v1";
import { parsePublicChannelQueryParam } from "../../../../lib/public-api/v1/channel";
import {
  logPublicApiUnexpectedError,
  publicApiErrorResponseV1,
  publicEventsListResponseV1,
  toPublicApiErrorResponseV1,
} from "../../../../lib/public-api/v1/http";

/** Prisma y loaders V1 requieren Node. */
export const runtime = "nodejs";

/**
 * GET /api/public/v1/events
 * Listado público: solo eventos PUBLIC listables (excluye UNLISTED y PRIVATE).
 * Query opcional: `?channel=clickaton|fotorank` (Etapa 08C).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const channelParam = parsePublicChannelQueryParam(
      url.searchParams.get("channel"),
    );
    if (channelParam === null) {
      return publicApiErrorResponseV1("INVALID_REQUEST", {
        message: "Parámetro channel inválido. Use clickaton o fotorank.",
      });
    }

    const items = await listPublicEventsV1({
      channel: channelParam,
    });
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
