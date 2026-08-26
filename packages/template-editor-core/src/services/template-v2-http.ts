import {
  isTemplateV2DesignerRole,
  type TemplateV2AuthUser,
} from "./template-v2-authorization";
import { toErrorResponse, TemplateV2DomainError } from "./template-v2-errors";
import { assertPayloadSize } from "./template-v2-limits";
import { getTemplateV2Runtime } from "./template-v2-runtime";

/**
 * Usuario habilitado a diseñar. La sesión y la política las aporta la app
 * hospedadora: en ComprameLaFoto son los roles de fotógrafo/admin; en Clickatón,
 * los admins del evento.
 */
export async function requireTemplateV2ApiUser(): Promise<TemplateV2AuthUser> {
  const runtime = getTemplateV2Runtime();

  let user;
  try {
    user = await runtime.requireUser();
  } catch (err) {
    throw new TemplateV2DomainError(
      "TEMPLATE_UNAUTHORIZED",
      err instanceof Error ? err.message : "No autenticado",
      401
    );
  }

  const canDesign = runtime.policy?.canDesign ?? ((u) => isTemplateV2DesignerRole(u.role));
  if (!canDesign(user)) {
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

/** `Response` estándar en vez de `NextResponse`: el paquete no depende de Next. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonOk(data: Record<string, unknown>, status = 200): Response {
  return json({ ok: true, ...data }, status);
}

export function jsonError(err: unknown): Response {
  const { status, body } = toErrorResponse(err);
  return json(body, status);
}
