import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupportTicket } from "@/lib/support/create-ticket";
import { sanitizeCreateTicketBody } from "@/lib/support/sanitize";
import {
  ESCOLAR_ASISTENCIA_REASON,
  buildEscolarAsistenciaDescription,
  buildOpenEscolarAsistenciaWhere,
  normalizeAsistenciaMessage,
  normalizeAsistenciaPhone,
} from "@/lib/escolar/asistencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * requireAuth([PHOTOGRAPHER, LAB_PHOTOGRAPHER]) también deja pasar a LAB (paridad legacy).
 * Los llamadores escolares son sólo para quien usa el panel de fotógrafo.
 */
function isPhotographerPanelRole(role: Role): boolean {
  return role === Role.PHOTOGRAPHER || role === Role.LAB_PHOTOGRAPHER;
}

async function loadEscolarInfo(userId: number, email: string) {
  const [profile, schoolsCount, openTicket] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        companyName: true,
        whatsapp: true,
        phone: true,
        publicPageHandler: true,
        isPublicPageEnabled: true,
      },
    }),
    prisma.school.count({ where: { ownerId: userId } }),
    prisma.supportTicket.findFirst({
      where: buildOpenEscolarAsistenciaWhere(email),
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { profile, schoolsCount, openTicket };
}

/**
 * GET /api/fotografo/escolar/asistencia
 * Datos livianos para los llamadores a la venta escolar y el botón de asistencia:
 * cuántas instituciones propias tiene, si ya pidió asistencia y el teléfono para precargar.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    if (!isPhotographerPanelRole(user.role)) {
      return NextResponse.json({ error: "Sólo para fotógrafos" }, { status: 403 });
    }
    const { profile, schoolsCount, openTicket } = await loadEscolarInfo(user.id, user.email);
    return NextResponse.json({
      name: profile?.companyName || profile?.name || user.name || null,
      phone: profile?.whatsapp || profile?.phone || null,
      schoolsCount,
      hasPublicHandler: Boolean(profile?.publicPageHandler),
      isPublicPageEnabled: profile?.isPublicPageEnabled === true,
      openRequest: openTicket ? { id: openTicket.id } : null,
    });
  } catch (err) {
    console.error("GET /api/fotografo/escolar/asistencia:", err);
    return NextResponse.json({ error: "Error cargando datos del módulo escolar" }, { status: 500 });
  }
}

/**
 * POST /api/fotografo/escolar/asistencia
 * Crea un ticket de soporte "Asistencia módulo escolar". Si ya hay uno abierto
 * (OPEN o IN_PROGRESS) de este fotógrafo, no crea otro y devuelve ese.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    if (!isPhotographerPanelRole(user.role)) {
      return NextResponse.json({ error: "Sólo para fotógrafos" }, { status: 403 });
    }

    // Mismo cupo que POST /api/support/tickets (comparten la clave).
    const rl = checkRateLimit({
      key: `support-create:${user.id}:${clientIp(req)}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const phone = normalizeAsistenciaPhone(body.phone);
    const message = normalizeAsistenciaMessage(body.message);

    const { profile, schoolsCount, openTicket } = await loadEscolarInfo(user.id, user.email);
    if (openTicket) {
      return NextResponse.json({ success: true, alreadyRequested: true, ticket: { id: openTicket.id } });
    }

    const photographerName = profile?.companyName || profile?.name || user.name || null;
    const parsed = sanitizeCreateTicketBody(
      {
        reason: ESCOLAR_ASISTENCIA_REASON,
        description: buildEscolarAsistenciaDescription({
          photographerName,
          phone,
          message,
          schoolsCount,
          publicPageHandler: profile?.publicPageHandler,
          isPublicPageEnabled: profile?.isPublicPageEnabled,
        }),
        requesterPhone: phone ?? "",
        requesterRole: user.role,
      },
      { name: user.name, email: user.email, role: user.role }
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;
    data.requesterEmail = user.email.toLowerCase();
    data.requesterName = data.requesterName || user.name || null;

    const ticket = await createSupportTicket({
      data,
      requesterLabel: `${data.requesterName || user.email} · ${user.email}`,
      adminTitle: "Pedido de asistencia: módulo escolar",
    });

    return NextResponse.json({ success: true, alreadyRequested: false, ticket: { id: ticket.id } });
  } catch (err) {
    console.error("POST /api/fotografo/escolar/asistencia:", err);
    return NextResponse.json({ error: "No pudimos registrar el pedido. Probá de nuevo." }, { status: 500 });
  }
}
