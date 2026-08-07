import { NextResponse } from "next/server";
import {
  PartnersDomainError,
  type ReviewOnboardingAction,
} from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ partnerId: string }> };

const ACTIONS = new Set<ReviewOnboardingAction>([
  "APPROVE_DATA",
  "APPROVE_LOGOS",
  "REQUEST_CHANGES",
  "REJECT",
]);

export async function POST(request: Request, { params }: Params) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { partnerId } = await params;
  if (!partnerId?.trim()) {
    return NextResponse.json({ ok: false, error: "partner_required" }, { status: 400 });
  }

  let body: {
    invitationId?: string;
    action?: string;
    notes?: string | null;
    logoAssetIds?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.invitationId?.trim()) {
    return NextResponse.json({ ok: false, error: "invitation_required" }, { status: 400 });
  }
  if (!body.action || !ACTIONS.has(body.action as ReviewOnboardingAction)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      await svc.getPartner(actor, partnerId);
      const inv = await svc.getOnboardingInvitationById(actor, body.invitationId!);
      if (inv.partnerId !== partnerId) {
        throw new PartnersDomainError("FORBIDDEN", "Invitación de otro partner.");
      }
      return svc.reviewOnboardingSubmission(actor, {
        invitationId: body.invitationId!,
        action: body.action as ReviewOnboardingAction,
        notes: body.notes,
        logoAssetIds: body.logoAssetIds,
        applyProposedData: body.action === "APPROVE_DATA",
      });
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "db_unavailable", message: result.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      invitation: {
        id: result.data.id,
        status: result.data.status,
        reviewStatus: result.data.reviewStatus,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de revisión.";
    const status =
      err instanceof PartnersDomainError
        ? err.code === "NOT_FOUND"
          ? 404
          : err.code === "FORBIDDEN"
            ? 403
            : 400
        : 400;
    return NextResponse.json({ ok: false, error: "review_failed", message }, { status });
  }
}
