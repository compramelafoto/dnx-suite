import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import {
  assertOrganizerCanAccessContest,
  RegistrationError,
} from "../../../../../../../../lib/fotorank/registration";
import {
  cancelPublicVoteRound,
  closeAndFinalizeRound,
  extendPublicVoteRound,
  openPublicVoteRound,
  reopenPublicVoteRound,
  schedulePublicVoteRound,
  setPublicVoteVirtualNow,
  setTestProviderMetric,
  buildTestObservations,
  ingestObservations,
  createTiebreakRound,
  resolveUnitPositionsAfterTiebreak,
  jobSyncMetrics,
  runPublicVoteWorkerPass,
} from "../../../../../../../../lib/fotorank/public-vote";
import { PublicVoteError } from "../../../../../../../../lib/fotorank/public-vote/errors";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string; roundId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }
  try {
    const { contestId, roundId } = await ctx.params;
    await assertOrganizerCanAccessContest(contestId, user.id);
    const round = await prisma.fotorankPublicVoteRound.findFirst({
      where: { id: roundId, contestId },
    });
    if (!round) {
      return NextResponse.json(
        { ok: false, error: { code: "ROUND_NOT_FOUND", message: "Ronda no encontrada." } },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    switch (action) {
      case "schedule": {
        const updated = await schedulePublicVoteRound({
          roundId,
          actorUserId: user.id,
          startsAt: body.startsAt ? new Date(String(body.startsAt)) : undefined,
          endsAt: body.endsAt ? new Date(String(body.endsAt)) : undefined,
          durationMinutes:
            typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
        });
        return NextResponse.json({ ok: true, round: updated });
      }
      case "open": {
        const result = await openPublicVoteRound({
          roundId,
          actorUserId: user.id,
          force: body.force === true,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case "finalize": {
        const result = await closeAndFinalizeRound({ roundId, actorUserId: user.id });
        return NextResponse.json({ ok: true, ...result });
      }
      case "extend": {
        const updated = await extendPublicVoteRound({
          roundId,
          newEndsAt: new Date(String(body.newEndsAt)),
          reason: String(body.reason ?? ""),
          actorUserId: user.id,
        });
        return NextResponse.json({ ok: true, round: updated });
      }
      case "cancel": {
        const result = await cancelPublicVoteRound({
          roundId,
          reason: String(body.reason ?? ""),
          actorUserId: user.id,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case "reopen": {
        await reopenPublicVoteRound({
          roundId,
          reason: String(body.reason ?? ""),
          actorUserId: user.id,
          isSuperAdmin: false,
        });
        return NextResponse.json({ ok: false });
      }
      case "simulate_metrics": {
        if (round.provider !== "TEST_PROVIDER") {
          throw new PublicVoteError("INVALID_STATE", "Simulador solo para TEST_PROVIDER.", 400);
        }
        const metrics = (body.metrics as Record<string, number>) ?? {};
        for (const [code, value] of Object.entries(metrics)) {
          setTestProviderMetric({ roundId, publicCode: code, value: Number(value) });
        }
        if (body.virtualNow) setPublicVoteVirtualNow(String(body.virtualNow));
        const sync = await jobSyncMetrics(roundId);
        return NextResponse.json({ ok: true, sync, test: true });
      }
      case "ingest_test": {
        if (round.provider !== "TEST_PROVIDER") {
          throw new PublicVoteError("INVALID_STATE", "Solo TEST_PROVIDER.", 400);
        }
        const asOf = body.asOf ? new Date(String(body.asOf)) : new Date();
        const codes =
          (body.publicCodes as string[]) ??
          (
            await prisma.fotorankPublicVoteCandidate.findMany({
              where: { roundId, active: true },
              select: { publicCode: true },
            })
          ).map((c) => c.publicCode);
        for (const [code, value] of Object.entries((body.metrics as Record<string, number>) ?? {})) {
          setTestProviderMetric({ roundId, publicCode: code, value: Number(value) });
        }
        const obs = buildTestObservations({
          roundId,
          publicCodes: codes,
          asOf,
          forceEventKey: typeof body.forceEventKey === "string" ? body.forceEventKey : undefined,
        });
        const result = await ingestObservations({
          roundId,
          observations: obs,
          allowClosingWindow: body.allowClosingWindow === true,
        });
        return NextResponse.json({ ok: true, result, test: true });
      }
      case "create_tiebreak": {
        const codes = (body.tiedPublicCodes as string[]) ?? [];
        const result = await createTiebreakRound({
          parentRoundId: roundId,
          tiedPublicCodes: codes,
          actorUserId: user.id,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case "resolve_tiebreak": {
        const result = await resolveUnitPositionsAfterTiebreak({
          tiebreakRoundId: roundId,
          actorUserId: user.id,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case "worker_pass": {
        const results = await runPublicVoteWorkerPass(contestId);
        return NextResponse.json({ ok: true, results });
      }
      default:
        return NextResponse.json(
          { ok: false, error: { code: "INVALID_ACTION", message: `Acción desconocida: ${action}` } },
          { status: 400 },
        );
    }
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    if (err instanceof PublicVoteError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[public-vote actions]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error en acción de voto público." } },
      { status: 500 },
    );
  }
}
