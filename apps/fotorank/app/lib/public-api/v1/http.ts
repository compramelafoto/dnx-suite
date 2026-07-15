/**
 * Utilidades HTTP acotadas para la Public API V1.
 * No es un framework: éxito, error, headers y mapeo de errores de dominio.
 */

import { NextResponse } from "next/server";
import {
  FOTORANK_PUBLIC_CONTRACT_VERSION,
  type FotorankPublicEventListItemV1,
  type FotorankPublicEventV1,
} from "./contracts";
import {
  isFotorankPublicSerializationError,
  type FotorankPublicSerializationError,
} from "./errors";

export const PUBLIC_API_VERSION = FOTORANK_PUBLIC_CONTRACT_VERSION;
export const PUBLIC_API_VERSION_HEADER = "X-Fotorank-Api-Version";

/** Cache conservadora para payloads públicos estáticos (sin inscripción/cupos). */
export const PUBLIC_API_CACHE_CONTROL_SUCCESS =
  "public, s-maxage=60, stale-while-revalidate=300";

/** Errores y 404: no cachear de forma prolongada. */
export const PUBLIC_API_CACHE_CONTROL_ERROR = "private, no-store";

export type PublicApiErrorCodeV1 =
  | "INVALID_REQUEST"
  | "EVENT_NOT_FOUND"
  | "INTERNAL_ERROR";

export type PublicApiSuccessResponseV1<T> = {
  version: typeof PUBLIC_API_VERSION;
  data: T;
  meta?: {
    count?: number;
  };
};

export type PublicApiErrorResponseV1 = {
  version: typeof PUBLIC_API_VERSION;
  error: {
    code: PublicApiErrorCodeV1;
    message: string;
  };
};

export type PublicEventsListDataV1 = {
  items: FotorankPublicEventListItemV1[];
};

export type PublicEventsListResponseV1 = PublicApiSuccessResponseV1<PublicEventsListDataV1> & {
  meta: { count: number };
};

export type PublicEventDetailDataV1 = {
  event: FotorankPublicEventV1;
};

export type PublicEventDetailResponseV1 =
  PublicApiSuccessResponseV1<PublicEventDetailDataV1>;

const ERROR_MESSAGES: Record<PublicApiErrorCodeV1, string> = {
  INVALID_REQUEST: "La solicitud no es válida.",
  EVENT_NOT_FOUND: "El evento solicitado no está disponible.",
  INTERNAL_ERROR: "Ocurrió un error interno. Intentá de nuevo más tarde.",
};

function commonHeaders(cacheControl: string): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    [PUBLIC_API_VERSION_HEADER]: PUBLIC_API_VERSION,
    "Cache-Control": cacheControl,
  };
}

export function publicApiSuccessResponseV1<T>(
  data: T,
  options?: {
    status?: number;
    meta?: PublicApiSuccessResponseV1<T>["meta"];
    cacheControl?: string;
  },
): NextResponse {
  const body: PublicApiSuccessResponseV1<T> = {
    version: PUBLIC_API_VERSION,
    data,
  };
  if (options?.meta) {
    body.meta = options.meta;
  }
  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: commonHeaders(
      options?.cacheControl ?? PUBLIC_API_CACHE_CONTROL_SUCCESS,
    ),
  });
}

export function publicApiErrorResponseV1(
  code: PublicApiErrorCodeV1,
  options?: {
    status?: number;
    message?: string;
  },
): NextResponse {
  const status =
    options?.status ??
    (code === "INVALID_REQUEST" ? 400 : code === "EVENT_NOT_FOUND" ? 404 : 500);

  const body: PublicApiErrorResponseV1 = {
    version: PUBLIC_API_VERSION,
    error: {
      code,
      message: options?.message ?? ERROR_MESSAGES[code],
    },
  };

  return NextResponse.json(body, {
    status,
    headers: commonHeaders(PUBLIC_API_CACHE_CONTROL_ERROR),
  });
}

export function publicEventsListResponseV1(
  items: FotorankPublicEventListItemV1[],
): NextResponse {
  const body: PublicEventsListResponseV1 = {
    version: PUBLIC_API_VERSION,
    data: { items },
    meta: { count: items.length },
  };
  return NextResponse.json(body, {
    status: 200,
    headers: commonHeaders(PUBLIC_API_CACHE_CONTROL_SUCCESS),
  });
}

export function publicEventDetailResponseV1(
  event: FotorankPublicEventV1,
): NextResponse {
  const body: PublicEventDetailResponseV1 = {
    version: PUBLIC_API_VERSION,
    data: { event },
  };
  return NextResponse.json(body, {
    status: 200,
    headers: commonHeaders(PUBLIC_API_CACHE_CONTROL_SUCCESS),
  });
}

/**
 * Mapea errores de dominio 08A / desconocidos a respuestas HTTP públicas.
 * NOT_PUBLIC y payloads no serializables se presentan como 404 genérico.
 */
export function toPublicApiErrorResponseV1(error: unknown): NextResponse {
  if (isFotorankPublicSerializationError(error)) {
    return mapSerializationErrorToHttp(error);
  }
  return publicApiErrorResponseV1("INTERNAL_ERROR");
}

function mapSerializationErrorToHttp(
  error: FotorankPublicSerializationError,
): NextResponse {
  if (error.code === "NOT_PUBLIC" || error.code === "INVALID_PAYLOAD") {
    return publicApiErrorResponseV1("EVENT_NOT_FOUND");
  }
  // UNSUPPORTED u otros: no filtrar detalles internos.
  return publicApiErrorResponseV1("INTERNAL_ERROR");
}

/** Logging mínimo seguro para errores inesperados (sin PII ni payloads). */
export function logPublicApiUnexpectedError(input: {
  endpoint: string;
  operation: string;
  error: unknown;
}): void {
  const err = input.error;
  const safeMessage =
    err instanceof Error ? err.message.slice(0, 200) : "unknown_error";
  const code =
    isFotorankPublicSerializationError(err) ? err.code : "UNEXPECTED";
  console.error(
    `[fotorank-public-api] endpoint=${input.endpoint} operation=${input.operation} code=${code} message=${safeMessage}`,
  );
}
