/**
 * Ops: listar/borrar objetos R2 de contests fixture ya eliminados (huérfanos).
 *
 * Auth: Bearer FOTORANK_INTERNAL_ASSET_SECRET
 * Guardas:
 * - contestId cuid
 * - prefix exacto fotorank/contests/{contestId}/
 * - contest NO existe en DB (huérfano) O existe ligado a edición isOpsFixture
 * - never commercial contest ids
 * - apply requiere confirmPhrase + dryRun:false
 */
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  deleteR2ObjectsByKeys,
  hashObjectList,
  listR2ObjectsByPrefix,
} from "../../../../lib/fotorank/storage/r2-list-prefix";

export const runtime = "nodejs";
export const maxDuration = 60;

const COMMERCIAL_CONTEST_DENY = new Set<string>([
  // no hardcode comercial contest; deny known commercial edition linkage below
]);
const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const CUID_RE = /^c[a-z0-9]{20,}$/i;
const CONFIRM_PHRASE = "DELETE_FIXTURE_R2_ORPHANS";

function assertInternalAuth(req: Request): boolean {
  const secret = process.env.FOTORANK_INTERNAL_ASSET_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const header = req.headers.get("authorization")?.trim() ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-fotorank-internal-secret")?.trim() ?? "";
  return bearer === secret || alt === secret;
}

export async function POST(req: Request) {
  if (!assertInternalAuth(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    contestId?: string;
    dryRun?: boolean;
    confirmPhrase?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const contestId = body.contestId?.trim() ?? "";
  if (!CUID_RE.test(contestId)) {
    return NextResponse.json({ ok: false, error: "INVALID_CONTEST_ID" }, { status: 400 });
  }
  if (COMMERCIAL_CONTEST_DENY.has(contestId)) {
    return NextResponse.json({ ok: false, error: "COMMERCIAL_DENIED" }, { status: 403 });
  }

  const commercialEdition = await prisma.clickatonEdition.findUnique({
    where: { id: COMMERCIAL_EDITION_ID },
    select: { fotorankContestId: true },
  });
  if (commercialEdition?.fotorankContestId === contestId) {
    return NextResponse.json({ ok: false, error: "COMMERCIAL_CONTEST_DENIED" }, { status: 403 });
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, slug: true, distributionChannel: true },
  });

  if (contest) {
    const edition = await prisma.clickatonEdition.findFirst({
      where: { fotorankContestId: contestId },
      select: { id: true, isOpsFixture: true, slug: true },
    });
    const fixtureOk =
      edition?.isOpsFixture === true &&
      (edition.slug.startsWith("clickaton-fr-assets-fixture-") ||
        edition.slug.startsWith("clickaton-fr-11e-fixture-"));
    if (!fixtureOk) {
      return NextResponse.json(
        { ok: false, error: "CONTEST_EXISTS_NOT_FIXTURE", contestId, slug: contest.slug },
        { status: 403 },
      );
    }
  }

  const prefix = `fotorank/contests/${contestId}/`;
  let listed;
  try {
    listed = await listR2ObjectsByPrefix(prefix);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "LIST_FAILED",
      },
      { status: 500 },
    );
  }

  const checksum = hashObjectList(listed.objects);
  const dryRun = body.dryRun !== false;
  const apply =
    !dryRun &&
    body.confirmPhrase === CONFIRM_PHRASE &&
    process.env.FOTORANK_ALLOW_PROD_R2 === "1";

  if (!apply) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      contestId,
      contestExistsInDb: Boolean(contest),
      bucket: listed.bucket,
      prefix: listed.prefix,
      found: listed.objects.length,
      objects: listed.objects.map((o) => ({
        key: o.key,
        size: o.size,
        etag: o.etag,
        lastModified: o.lastModified,
      })),
      checksumSha256: checksum,
      note: apply
        ? undefined
        : "Dry-run. Apply: dryRun:false + confirmPhrase DELETE_FIXTURE_R2_ORPHANS + FOTORANK_ALLOW_PROD_R2=1",
    });
  }

  const del = await deleteR2ObjectsByKeys(listed.objects.map((o) => o.key));
  const after = await listR2ObjectsByPrefix(prefix);

  return NextResponse.json({
    ok: del.errors.length === 0 && after.objects.length === 0,
    dryRun: false,
    contestId,
    bucket: listed.bucket,
    prefix,
    found: listed.objects.length,
    deleted: del.deleted.length,
    residual: after.objects.length,
    errors: del.errors,
    checksumSha256Before: checksum,
    checksumSha256After: hashObjectList(after.objects),
  });
}
