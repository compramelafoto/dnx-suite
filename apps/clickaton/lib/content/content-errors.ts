/**
 * Traducción de errores de dominio del CMS a respuestas HTTP Clickatón.
 */
import { NextResponse } from "next/server";
import { ContentError, isContentError } from "@repo/content";

export { ContentError, isContentError };

const RELATION_MESSAGES: Partial<Record<string, string>> = {
  CONTENT_CATEGORY_NOT_FOUND: "La categoría indicada no existe",
  CONTENT_AUTHOR_NOT_FOUND: "El autor indicado no existe",
  CONTENT_TAG_NOT_FOUND: "Uno o más tags no existen",
  CONTENT_MEDIA_NOT_FOUND: "La imagen indicada no existe",
  CONTENT_RELATION_PLATFORM_MISMATCH: "La relación pertenece a otra plataforma",
};

/** Devuelve el mensaje de relación inválida, o null si el error es de otra clase. */
export function mapContentRelationError(error: unknown): string | null {
  if (isContentError(error)) {
    return RELATION_MESSAGES[error.code] ?? null;
  }
  const message = error instanceof Error ? error.message : "";
  if (message === "CATEGORY_NOT_FOUND") return RELATION_MESSAGES.CONTENT_CATEGORY_NOT_FOUND!;
  if (message === "AUTHOR_NOT_FOUND") return RELATION_MESSAGES.CONTENT_AUTHOR_NOT_FOUND!;
  if (message === "TAG_NOT_FOUND") return RELATION_MESSAGES.CONTENT_TAG_NOT_FOUND!;
  return null;
}

export function contentErrorStatus(error: unknown): number {
  if (!isContentError(error)) return 500;
  switch (error.code) {
    case "CONTENT_NOT_FOUND":
    case "CONTENT_MEDIA_NOT_FOUND":
      return 404;
    case "CONTENT_SLUG_CONFLICT":
      return 409;
    case "CONTENT_PLATFORM_REQUIRED":
    case "CONTENT_CATEGORY_NOT_FOUND":
    case "CONTENT_AUTHOR_NOT_FOUND":
    case "CONTENT_TAG_NOT_FOUND":
    case "CONTENT_RELATION_PLATFORM_MISMATCH":
    case "CONTENT_INVALID_STATUS":
      return 400;
    default:
      return 500;
  }
}

/** Respuesta uniforme para errores Prisma / dominio en las APIs del CMS. */
export function handleContentApiError(error: unknown, entityLabel: string) {
  const relation = mapContentRelationError(error);
  if (relation) {
    return NextResponse.json({ error: relation }, { status: 400 });
  }

  if (isContentError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: contentErrorStatus(error) },
    );
  }

  const code = (error as { code?: string })?.code;
  if (code === "P2002") {
    return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
  }
  if (code === "P2025") {
    return NextResponse.json({ error: `No se encontró ${entityLabel}` }, { status: 404 });
  }
  if (code === "P2021" || code === "P2022") {
    return NextResponse.json(
      {
        error:
          "Falta una tabla o columna del CMS en esta base. Aplicá las migraciones Prisma pendientes.",
      },
      { status: 503 },
    );
  }

  console.error(`[clickaton][content] API error (${entityLabel}):`, error);
  return NextResponse.json(
    { error: `No se pudo procesar ${entityLabel}` },
    { status: 500 },
  );
}
