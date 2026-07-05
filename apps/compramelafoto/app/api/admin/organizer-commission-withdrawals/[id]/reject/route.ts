import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  rejectWithdrawalInTx,
  WithdrawalActionError,
} from "@/lib/admin-organizer-withdrawal-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id: idParam } = await ctx.params;
    const withdrawalId = Number(idParam);
    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const adminNotes =
      typeof body.adminNotes === "string" ? body.adminNotes : body.adminNotes != null ? String(body.adminNotes) : null;

    await prisma.$transaction((tx) =>
      rejectWithdrawalInTx(tx, {
        withdrawalId,
        adminUserId: user.id,
        adminNotes,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof WithdrawalActionError) {
      if (err.code === "NOT_FOUND") {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      if (err.code === "NOTES_REQUIRED") {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST .../reject ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al rechazar", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
