import { NextResponse } from "next/server";
import {
  ClickatonCardError,
  forceRegenerateClickatonParticipantCard,
  getClickatonParticipantCardStatus,
  getOrGenerateClickatonParticipantCard,
  type ClickatonParticipantCardType,
  type GetOrGenerateClickatonParticipantCardResult,
  type ParticipantCardActor,
  type ParticipantCardDisposition,
  type ParticipantCardMode,
} from "@/lib/participant-cards";
import {
  isAdminCardsV2Enabled,
  isParticipantCardsV2Enabled,
} from "@/lib/participant-cards/participant-card-feature-flags";
import { validateParticipantCardsRuntimeConfig } from "@/lib/participant-cards/participant-card-runtime-config";

export function parseParticipantCardTypeParam(
  raw: string
): ClickatonParticipantCardType | null {
  const v = raw.trim().toLowerCase();
  if (v === "welcome" || v === "bienvenida") return "welcome";
  if (v === "member" || v === "soy-parte" || v === "miembro") return "member";
  return null;
}

export function parseDisposition(
  searchParams: URLSearchParams,
  fallback: ParticipantCardDisposition
): ParticipantCardDisposition {
  const d = searchParams.get("disposition")?.trim().toLowerCase();
  if (d === "inline" || d === "attachment") return d;
  return fallback;
}

export function parseMode(
  searchParams: URLSearchParams,
  fallback: ParticipantCardMode
): ParticipantCardMode {
  const m = searchParams.get("mode")?.trim().toLowerCase();
  if (m === "preview" || m === "final") return m;
  return fallback;
}

export function parseForceRegenerate(searchParams: URLSearchParams): boolean {
  const raw = searchParams.get("force")?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function wantsJsonDiagnostic(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

export function buildCardEtag(
  cardType: ClickatonParticipantCardType,
  renderHashPrefix: string
): string {
  return `"ck-card-${cardType}-${renderHashPrefix}"`;
}

export function matchesIfNoneMatch(
  ifNoneMatch: string | null | undefined,
  etag: string
): boolean {
  if (!ifNoneMatch?.trim()) return false;
  const normalized = etag.startsWith('"') ? etag : `"${etag}"`;
  for (const part of ifNoneMatch.split(",")) {
    const tag = part.trim();
    if (tag === "*" || tag === normalized || tag === etag) return true;
    if (tag.startsWith("W/") && tag.slice(2).trim() === normalized) return true;
  }
  return false;
}

function isGeneratingWithoutPng(
  result: GetOrGenerateClickatonParticipantCardResult
): boolean {
  return (
    result.recordStatus === "GENERATING" &&
    (!result.png || result.png.length === 0)
  );
}

function cardCacheHeaders(
  result: GetOrGenerateClickatonParticipantCardResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Clickaton-Card-Cache": result.cacheStatus ?? "MISS",
  };
  if (result.renderHashPrefix) {
    headers["X-Clickaton-Card-Hash"] = result.renderHashPrefix;
    headers["ETag"] = buildCardEtag(result.cardType, result.renderHashPrefix);
  }
  if (result.generatedAt) {
    headers["X-Clickaton-Card-Generated-At"] = result.generatedAt.toISOString();
  }
  return headers;
}

export function pngResponse(
  result: GetOrGenerateClickatonParticipantCardResult,
  disposition: ParticipantCardDisposition
): Response {
  const bytes = Buffer.from(result.png);
  const disp =
    disposition === "inline"
      ? `inline; filename="${result.filename}"`
      : `attachment; filename="${result.filename}"`;
  return new Response(bytes, {
    status: 200,
    headers: {
      ...cardCacheHeaders(result),
      "Content-Type": "image/png",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": disp,
      "X-Clickaton-Card-Type": result.cardType,
      "X-Clickaton-Registration-Id": result.registrationId,
      "X-Clickaton-Card-Width": String(result.width),
      "X-Clickaton-Card-Height": String(result.height),
      "X-Clickaton-Card-Duration-Ms": String(result.durationMs),
    },
  });
}

export function notModifiedResponse(
  result: GetOrGenerateClickatonParticipantCardResult
): Response {
  return new Response(null, {
    status: 304,
    headers: cardCacheHeaders(result),
  });
}

export function jsonDiagnosticResponse(
  result: GetOrGenerateClickatonParticipantCardResult
): NextResponse {
  return NextResponse.json({
    ok: true,
    imageBase64: result.png.toString("base64"),
    mimeType: result.mimeType,
    width: result.width,
    height: result.height,
    filename: result.filename,
    cardType: result.cardType,
    registrationId: result.registrationId,
    eligibility: result.eligibility,
    warnings: result.warnings,
    sourceSummary: result.sourceSummary,
    durationMs: result.durationMs,
    cacheStatus: result.cacheStatus,
    renderHashPrefix: result.renderHashPrefix,
    generatedAt: result.generatedAt?.toISOString() ?? null,
    recordStatus: result.recordStatus,
    recordId: result.recordId,
  });
}

export function generatingJsonResponse(
  result: GetOrGenerateClickatonParticipantCardResult
): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      status: "GENERATING",
      recordStatus: result.recordStatus ?? "GENERATING",
      renderHashPrefix: result.renderHashPrefix,
      recordId: result.recordId,
    },
    { status: 202, headers: cardCacheHeaders(result) }
  );
}

export function cardErrorResponse(err: unknown): NextResponse {
  if (err instanceof ClickatonCardError) {
    const headers: Record<string, string> = {};
    if (err.code === "CLICKATON_CARD_RATE_LIMITED") {
      const retry =
        err.details &&
        typeof err.details === "object" &&
        "retryAfterMs" in err.details &&
        typeof (err.details as { retryAfterMs?: unknown }).retryAfterMs ===
          "number"
          ? Math.ceil(
              (err.details as { retryAfterMs: number }).retryAfterMs / 1000
            )
          : 60;
      headers["Retry-After"] = String(retry);
    }
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code: err.code,
      },
      { status: err.httpStatus, headers }
    );
  }
  console.error("[clickaton-participant-cards]", err);
  return NextResponse.json(
    { ok: false, error: "No se pudo generar la placa", code: "CLICKATON_CARD_RENDER_FAILED" },
    { status: 500 }
  );
}

export async function runParticipantCardHttp(args: {
  registrationId: string;
  cardTypeRaw: string;
  actor: ParticipantCardActor;
  req: Request;
  defaultMode: ParticipantCardMode;
  defaultDisposition: ParticipantCardDisposition;
}): Promise<Response> {
  const cardType = parseParticipantCardTypeParam(args.cardTypeRaw);
  if (!cardType) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tipo de placa inválido",
        code: "CLICKATON_CARD_TEMPLATE_INVALID",
      },
      { status: 422 }
    );
  }

  const needsV2 =
    args.actor.kind === "admin"
      ? isAdminCardsV2Enabled()
      : isParticipantCardsV2Enabled();
  if (needsV2) {
    const runtime = validateParticipantCardsRuntimeConfig();
    if (!runtime.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Placas V2 no disponibles: configuración incompleta",
          code: "CLICKATON_CARD_RENDER_UNAVAILABLE",
          issues: runtime.issues.map((i) => i.code),
        },
        { status: 503 }
      );
    }
  }

  const url = new URL(args.req.url);
  const mode = parseMode(url.searchParams, args.defaultMode);
  const disposition = parseDisposition(
    url.searchParams,
    args.defaultDisposition
  );
  const force =
    args.actor.kind === "admin" && parseForceRegenerate(url.searchParams);

  const cardInput = {
    registrationId: args.registrationId,
    cardType,
    actor: args.actor,
    mode,
    disposition,
  };

  try {
    const result = force
      ? await forceRegenerateClickatonParticipantCard(cardInput)
      : await getOrGenerateClickatonParticipantCard(cardInput);

    if (isGeneratingWithoutPng(result)) {
      return generatingJsonResponse(result);
    }

    const etag = result.renderHashPrefix
      ? buildCardEtag(result.cardType, result.renderHashPrefix)
      : null;
    if (
      result.cacheStatus === "HIT" &&
      etag &&
      matchesIfNoneMatch(args.req.headers.get("if-none-match"), etag)
    ) {
      return notModifiedResponse(result);
    }

    if (wantsJsonDiagnostic(args.req) && args.actor.kind === "admin") {
      return jsonDiagnosticResponse(result);
    }

    return pngResponse(result, disposition);
  } catch (err) {
    return cardErrorResponse(err);
  }
}

export async function runParticipantCardStatusHttp(args: {
  registrationId: string;
  cardTypeRaw: string;
  actor: ParticipantCardActor;
}): Promise<Response> {
  const cardType = parseParticipantCardTypeParam(args.cardTypeRaw);
  if (!cardType) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tipo de placa inválido",
        code: "CLICKATON_CARD_TEMPLATE_INVALID",
      },
      { status: 422 }
    );
  }

  try {
    const latest = await getClickatonParticipantCardStatus({
      registrationId: args.registrationId,
      cardType,
      actor: args.actor,
    });

    return NextResponse.json({
      status: latest.status,
      generatedAt: latest.generatedAt?.toISOString(),
      errorCode: latest.errorCode,
      cacheHint: latest.status === "READY" ? "HIT" : undefined,
      renderHashPrefix: latest.renderHashPrefix,
    });
  } catch (err) {
    return cardErrorResponse(err);
  }
}
