import { getPublicEventV1BySlug } from "../../../../../lib/public-api/v1";
import { parsePublicChannelQueryParam } from "../../../../../lib/public-api/v1/channel";
import {
  logPublicApiUnexpectedError,
  publicApiErrorResponseV1,
  publicEventDetailResponseV1,
  toPublicApiErrorResponseV1,
} from "../../../../../lib/public-api/v1/http";
import { assertPublicEventSlugV1 } from "../../../../../lib/public-api/v1/slug";

/** Prisma y loaders V1 requieren Node. */
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/public/v1/events/[slug]
 * Detalle público: PUBLIC y UNLISTED routable. PRIVATE / inexistente → 404.
 * Query opcional: `?channel=clickaton|fotorank` — si no coincide → 404.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = assertPublicEventSlugV1(rawSlug);
    if (!slug) {
      return publicApiErrorResponseV1("INVALID_REQUEST", {
        message: "El identificador del evento no es válido.",
      });
    }

    const url = new URL(request.url);
    const channelParam = parsePublicChannelQueryParam(
      url.searchParams.get("channel"),
    );
    if (channelParam === null) {
      return publicApiErrorResponseV1("INVALID_REQUEST", {
        message: "Parámetro channel inválido. Use clickaton o fotorank.",
      });
    }

    const event = await getPublicEventV1BySlug(slug, {
      channel: channelParam,
    });
    if (!event) {
      return publicApiErrorResponseV1("EVENT_NOT_FOUND");
    }

    return publicEventDetailResponseV1(event);
  } catch (error) {
    logPublicApiUnexpectedError({
      endpoint: "/api/public/v1/events/[slug]",
      operation: "getPublicEventV1BySlug",
      error,
    });
    return toPublicApiErrorResponseV1(error);
  }
}
