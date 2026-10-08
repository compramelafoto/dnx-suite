import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";
import {
  designerEditorPath,
  parseWinnerFormat,
  readDiplomaDesignLink,
} from "../../../../lib/fotorank/design/constants";
import { currentDesignVersion } from "../../../../lib/fotorank/design/templates";
import { ensureWinnerTemplate } from "../../../../lib/fotorank/design/winners-template";
import { DESIGNER_RETURN_COOKIE, safeReturnPath } from "../../../../lib/fotorank/design/return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fotorank/design/open
 *
 * Abre una pieza en el diseñador y recuerda a dónde volver al cerrarlo.
 *
 * - `?diplomaTemplateId=…` — la plantilla de diploma de un concurso.
 * - `?contestId=…&format=cuadrada|historia` — la imagen de ganador; si no existe, se crea con el
 *   diseño base.
 * - `&return=/dashboard/…` — la pantalla de origen.
 *
 * El editor compartido vuelve siempre a su ruta base al cerrarse; la cookie es lo que le permite
 * a esa ruta mandar a la persona de vuelta al concurso del que vino.
 */
/** El origen con el que entró la persona: `req.url` puede venir normalizado a otro host. */
function origen(req: Request): URL {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    url.host = host;
    const proto = req.headers.get("x-forwarded-proto");
    if (proto === "http" || proto === "https") url.protocol = `${proto}:`;
  }
  return url;
}

export async function GET(req: Request) {
  const url = origen(req);
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL("/login", url));
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return NextResponse.json({ error: org.error }, { status: 403 });

  let templateId: string | null = null;
  let versionId: string | null = null;

  const diplomaTemplateId = url.searchParams.get("diplomaTemplateId");
  if (diplomaTemplateId) {
    const fila = await prisma.fotorankDiplomaTemplate.findFirst({
      where: { id: diplomaTemplateId, organizationId: org.org.id },
      select: { layoutJson: true },
    });
    const link = readDiplomaDesignLink(fila?.layoutJson);
    if (!link) return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    templateId = link.designTemplateId;
    versionId = await currentDesignVersion(org.org.id, templateId);
  } else {
    const contestId = url.searchParams.get("contestId");
    const format = parseWinnerFormat(url.searchParams.get("format"));
    if (!contestId || !format) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }
    const concurso = await prisma.fotorankContest.findFirst({
      where: { id: contestId, organizationId: org.org.id },
      select: { id: true },
    });
    if (!concurso) return NextResponse.json({ error: "Concurso no encontrado." }, { status: 404 });
    const diseno = await ensureWinnerTemplate({
      organizationId: org.org.id,
      contestId,
      userId: user.id,
      format,
    });
    templateId = diseno.templateId;
    versionId = diseno.versionId;
  }

  if (!templateId || !versionId) {
    return NextResponse.json({ error: "Diseño no encontrado." }, { status: 404 });
  }

  const res = NextResponse.redirect(new URL(designerEditorPath(templateId, versionId), url));
  const vuelta = safeReturnPath(url.searchParams.get("return"));
  if (vuelta) {
    res.cookies.set(DESIGNER_RETURN_COOKIE, vuelta, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  return res;
}
