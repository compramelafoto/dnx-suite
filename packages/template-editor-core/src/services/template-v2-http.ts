import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  isTemplateV2DesignerRole,
  type TemplateV2AuthUser,
} from "@/lib/template-v2/services/template-v2-authorization";
import { toErrorResponse, TemplateV2DomainError } from "@/lib/template-v2/services/template-v2-errors";
import { assertPayloadSize } from "@/lib/template-v2/services/template-v2-limits";

const DESIGNER_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

export async function requireTemplateV2ApiUser(): Promise<TemplateV2AuthUser> {
  const { error, user } = await requireAuth(DESIGNER_ROLES);
  if (error || !user) {
    throw new TemplateV2DomainError("TEMPLATE_UNAUTHORIZED", error || "No autenticado", 401);
  }
  if (!isTemplateV2DesignerRole(user.role)) {
    throw new TemplateV2DomainError("TEMPLATE_FORBIDDEN", "Sin permisos", 403);
  }
  return { id: user.id, role: user.role };
}

export async function readJsonWithLimit(req: Request): Promise<unknown> {
  const raw = await req.text();
  assertPayloadSize(Buffer.byteLength(raw, "utf8"));
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new TemplateV2DomainError("TEMPLATE_INVALID", "JSON inválido", 422);
  }
}

export function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function jsonError(err: unknown) {
  const { status, body } = toErrorResponse(err);
  return NextResponse.json(body, { status });
}
