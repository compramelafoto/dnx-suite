import { NextResponse } from "next/server";
import {
  PartnersDomainError,
  buildPartnerOnboardingUrl,
  resolveOnboardingAdminStatus,
} from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ partnerId: string }> };

/**
 * GET — lista invitaciones de onboarding del partner.
 * POST — crea invitación y devuelve inviteUrl (token plaintext una sola vez).
 */
export async function GET(
  _request: Request,
  { params }: Params,
): Promise<NextResponse> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { partnerId } = await params;
  if (!partnerId?.trim()) {
    return NextResponse.json({ ok: false, error: "partner_required" }, { status: 400 });
  }

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      await svc.getPartner(actor, partnerId);
      const invitations = await svc.listOnboardingInvitations(actor, partnerId);
      const adminStatus = resolveOnboardingAdminStatus(invitations);
      return { invitations, adminStatus };
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "db_unavailable", message: result.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, ...result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al listar invitaciones.";
    const status = err instanceof PartnersDomainError && err.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: "list_failed", message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: Params,
): Promise<NextResponse> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { partnerId } = await params;
  if (!partnerId?.trim()) {
    return NextResponse.json({ ok: false, error: "partner_required" }, { status: 400 });
  }

  let participationId: string | null = null;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { participationId?: string | null };
      participationId = body.participationId?.trim() || null;
    }
  } catch {
    // body opcional
  }

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      await svc.getPartner(actor, partnerId);
      return svc.createOnboardingInvitation(actor, {
        partnerId,
        participationId,
        createdByUserId: user.id,
      });
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "db_unavailable", message: result.message },
        { status: 503 },
      );
    }

    const { invitation, rawToken } = result.data;
    const origin =
      process.env.NEXT_PUBLIC_CLICKATON_URL ||
      process.env.CLICKATON_PUBLIC_URL ||
      new URL(request.url).origin;
    const inviteUrl = buildPartnerOnboardingUrl(origin, rawToken);

    return NextResponse.json({
      ok: true,
      inviteUrl,
      invitation: {
        id: invitation.id,
        status: invitation.status,
        reviewStatus: invitation.reviewStatus,
        expiresAt: invitation.expiresAt,
        openedAt: invitation.openedAt,
        submittedAt: invitation.submittedAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear la invitación.";
    const status = err instanceof PartnersDomainError && err.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: "create_failed", message }, { status });
  }
}
