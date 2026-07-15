/**
 * Cliente HTTP server-to-server hacia FotoRank Public API V1.
 * Única capa autorizada para `fetch` a FotoRank desde Clickaton.
 */

import "server-only";

import {
  PublicMarathonNotFoundError,
  PublicMarathonPayloadError,
  PublicMarathonSourceUnavailableError,
} from "@/data/public-marathons/errors";
import type {
  FotorankPublicCapabilitiesV1,
  FotorankPublicEventListItemV1,
  FotorankPublicEventV1,
  FotorankPublicErrorEnvelopeV1,
} from "@/data/public-marathons/fotorank-v1-types";

const DEFAULT_REVALIDATE_SECONDS = 60;
/** Timeout conservador server-to-server (alineado a patrones del monorepo). */
const DEFAULT_TIMEOUT_MS = 8_000;

export type FotorankPublicClientOptions = {
  baseUrl: string;
  /** ISR / fetch cache. Default 60s alineado a Cache-Control de FR. */
  revalidateSeconds?: number;
  /** Abort por timeout. Default 8000ms. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function assertSafePublicApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PublicMarathonPayloadError(
      "FOTORANK_PUBLIC_API_BASE_URL is not a valid URL",
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PublicMarathonPayloadError(
      "FOTORANK_PUBLIC_API_BASE_URL must use http or https",
    );
  }
  if (parsed.username || parsed.password) {
    throw new PublicMarathonPayloadError(
      "FOTORANK_PUBLIC_API_BASE_URL must not include credentials",
    );
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorEnvelope(body: unknown): body is FotorankPublicErrorEnvelopeV1 {
  if (!isRecord(body) || !isRecord(body.error)) return false;
  return typeof body.error.message === "string";
}

function isCapabilities(value: unknown): value is FotorankPublicCapabilitiesV1 {
  if (!isRecord(value)) return false;
  return (
    typeof value.canViewRules === "boolean" &&
    typeof value.canViewJury === "boolean" &&
    typeof value.canViewCategories === "boolean" &&
    typeof value.canRegister === "boolean" &&
    typeof value.canViewResults === "boolean" &&
    typeof value.canViewGallery === "boolean"
  );
}

function isListItem(value: unknown): value is FotorankPublicEventListItemV1 {
  if (!isRecord(value)) return false;
  return (
    value.contractVersion === "v1" &&
    typeof value.id === "string" &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.experienceType === "string" &&
    typeof value.status === "string" &&
    typeof value.registrationStatus === "string" &&
    typeof value.resultsStatus === "string" &&
    isCapabilities(value.capabilities) &&
    isRecord(value.organization) &&
    typeof value.organization.id === "string" &&
    typeof value.organization.name === "string" &&
    typeof value.organization.slug === "string"
  );
}

function isDetailEvent(value: unknown): value is FotorankPublicEventV1 {
  if (!isRecord(value)) return false;
  if (
    value.contractVersion !== "v1" ||
    typeof value.id !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.name !== "string" ||
    typeof value.experienceType !== "string" ||
    typeof value.status !== "string" ||
    typeof value.registrationStatus !== "string" ||
    typeof value.resultsStatus !== "string" ||
    !isCapabilities(value.capabilities) ||
    !isRecord(value.organization) ||
    typeof value.organization.id !== "string" ||
    typeof value.organization.name !== "string" ||
    typeof value.organization.slug !== "string"
  ) {
    return false;
  }
  return (
    Array.isArray(value.categories) &&
    Array.isArray(value.jury) &&
    isRecord(value.schedule) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function parseListEnvelope(body: unknown): FotorankPublicEventListItemV1[] {
  if (!isRecord(body) || body.version !== "v1") {
    throw new PublicMarathonPayloadError("invalid list envelope from FotoRank");
  }
  if (!isRecord(body.data) || !Array.isArray(body.data.items)) {
    throw new PublicMarathonPayloadError("invalid list envelope from FotoRank");
  }
  if (!isRecord(body.meta) || typeof body.meta.count !== "number") {
    throw new PublicMarathonPayloadError("invalid list meta from FotoRank");
  }
  const items: FotorankPublicEventListItemV1[] = [];
  for (const item of body.data.items) {
    if (!isListItem(item)) {
      throw new PublicMarathonPayloadError("invalid list item from FotoRank");
    }
    items.push(item);
  }
  if (body.meta.count !== items.length) {
    throw new PublicMarathonPayloadError("list meta.count mismatch from FotoRank");
  }
  return items;
}

function parseDetailEnvelope(body: unknown): FotorankPublicEventV1 {
  if (!isRecord(body) || body.version !== "v1") {
    throw new PublicMarathonPayloadError("invalid detail envelope from FotoRank");
  }
  if (!isRecord(body.data) || !isDetailEvent(body.data.event)) {
    throw new PublicMarathonPayloadError("invalid detail envelope from FotoRank");
  }
  return body.data.event;
}

export function createFotorankPublicClient(options: FotorankPublicClientOptions) {
  const baseUrl = assertSafePublicApiBaseUrl(options.baseUrl);
  const revalidate = options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  function buildUrl(path: string): string {
    return new URL(path, `${baseUrl}/`).toString();
  }

  async function requestJson(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate },
      } as RequestInit);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "FotoRank unreachable";
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.name === "AbortError" ||
          /aborted|timeout/i.test(error.message));
      throw new PublicMarathonSourceUnavailableError(
        timedOut
          ? `FotoRank timeout after ${timeoutMs}ms`
          : `FotoRank unreachable: ${message}`,
      );
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.status === 404) {
      throw new PublicMarathonNotFoundError("event");
    }

    if (response.status === 400) {
      const message = isErrorEnvelope(body)
        ? body.error.message
        : "Invalid request to FotoRank";
      throw new PublicMarathonPayloadError(message);
    }

    if (!response.ok) {
      throw new PublicMarathonSourceUnavailableError(
        `FotoRank HTTP ${response.status}`,
      );
    }

    if (isErrorEnvelope(body)) {
      throw new PublicMarathonSourceUnavailableError(body.error.message);
    }

    return body;
  }

  return {
    async listEvents(options?: {
      channel?: "clickaton" | "fotorank";
    }): Promise<FotorankPublicEventListItemV1[]> {
      const url = new URL(buildUrl("/api/public/v1/events"));
      if (options?.channel) {
        url.searchParams.set("channel", options.channel);
      }
      const body = await requestJson(url.toString());
      return parseListEnvelope(body);
    },

    async getEventBySlug(
      slug: string,
      options?: { channel?: "clickaton" | "fotorank" },
    ): Promise<FotorankPublicEventV1> {
      const encoded = encodeURIComponent(slug);
      const url = new URL(buildUrl(`/api/public/v1/events/${encoded}`));
      if (options?.channel) {
        url.searchParams.set("channel", options.channel);
      }
      const body = await requestJson(url.toString());
      return parseDetailEnvelope(body);
    },
  };
}

export type FotorankPublicClient = ReturnType<typeof createFotorankPublicClient>;
