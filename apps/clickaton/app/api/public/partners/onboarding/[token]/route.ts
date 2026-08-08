import { NextResponse } from "next/server";
import {
  PartnersDomainError,
  type PartnerOnboardingDraft,
  type PartnerOnboardingSubmission,
} from "@repo/partners";
import { withClickatonDb } from "@/lib/admin/db";
import { getClickatonPartnersService } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const GENERIC_INVALID = {
  ok: false as const,
  error: "invalid_or_expired",
  message: "Este enlace no es válido o ya no está disponible.",
};

function domainStatus(err: unknown): number {
  if (err instanceof PartnersDomainError) {
    if (err.code === "NOT_FOUND" || err.code === "FORBIDDEN") return 404;
    if (err.code === "INVALID_STATE") return 409;
    if (err.code === "VALIDATION") return 400;
  }
  return 400;
}

/**
 * GET — abre la invitación (marca OPENED) y devuelve borrador seguro.
 * No revela datos del partner si el token es inválido/vencido/revocado.
 */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.openOnboardingInvitation(token.trim());
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: result.message },
        { status: 503 },
      );
    }

    const opened = result.data;
    return NextResponse.json({
      ok: true,
      status: opened.invitation.status,
      reviewStatus: opened.invitation.reviewStatus,
      expiresAt: opened.invitation.expiresAt,
      draft: opened.draft,
      partnerDisplayName: opened.partner.name,
      submitted: opened.invitation.status === "SUBMITTED",
    });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      return NextResponse.json(GENERIC_INVALID, {
        status: domainStatus(err) === 409 ? 409 : 404,
      });
    }
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }
}

/**
 * PATCH — guarda borrador del onboarding.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }

  let body: { draft?: PartnerOnboardingDraft };
  try {
    body = (await request.json()) as { draft?: PartnerOnboardingDraft };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Cuerpo inválido." },
      { status: 400 },
    );
  }

  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json(
      { ok: false, error: "draft_required", message: "Falta el borrador." },
      { status: 400 },
    );
  }

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.saveOnboardingDraft(token.trim(), body.draft!);
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: result.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, draft: result.data });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      const status = domainStatus(err);
      if (status === 404 || err.code === "FORBIDDEN") {
        return NextResponse.json(GENERIC_INVALID, { status: 404 });
      }
      return NextResponse.json(
        { ok: false, error: err.code.toLowerCase(), message: err.message },
        { status },
      );
    }
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }
}

/**
 * POST — envía el onboarding a revisión.
 */
export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }

  let body: { submission?: PartnerOnboardingSubmission; draft?: PartnerOnboardingDraft };
  try {
    body = (await request.json()) as {
      submission?: PartnerOnboardingSubmission;
      draft?: PartnerOnboardingDraft;
    };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Cuerpo inválido." },
      { status: 400 },
    );
  }

  const draft = body.submission ?? body.draft;
  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "submission_required", message: "Falta la presentación." },
      { status: 400 },
    );
  }

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.submitOnboardingInvitation(token.trim(), draft);
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: result.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, ...result.data });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      const status = domainStatus(err);
      if (status === 404 || err.code === "FORBIDDEN") {
        return NextResponse.json(GENERIC_INVALID, { status: 404 });
      }
      return NextResponse.json(
        { ok: false, error: err.code.toLowerCase(), message: err.message },
        { status },
      );
    }
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }
}
