/**
 * Authenticated welcome-card media proxy (10E.4 B2).
 * Only owner (userId/email) or admin can read bytes. Never exposes storageKey.
 */
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { resolveMediaBody } from "@/lib/welcome-card/resolve-media-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ registrationId: string }> };

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function GET(request: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { registrationId } = await params;
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "png").toLowerCase() === "webp"
    ? "webp"
    : "png";
  const disposition =
    url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      userId: true,
      email: true,
      visibleCode: true,
      welcomeCardStatus: true,
      status: true,
    },
  });
  if (!registration) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const owns =
    registration.userId === user.id ||
    registration.email.toLowerCase() === user.email.toLowerCase();
  const admin = hasClickatonAdminAccess(user);
  if (!owns && !admin) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (registration.welcomeCardStatus !== "GENERATED") {
    return NextResponse.json(
      {
        ok: false,
        error: "CARD_NOT_READY",
        status: registration.welcomeCardStatus ?? "PENDING",
      },
      { status: 409 },
    );
  }

  const card = await prisma.dnxWelcomeCard.findFirst({
    where: { registrationId },
    orderBy: { createdAt: "desc" },
    select: { pngAssetId: true, webpAssetId: true, status: true },
  });
  const assetId = format === "webp" ? card?.webpAssetId : card?.pngAssetId;
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "ASSET_MISSING" }, { status: 404 });
  }

  const asset = await prisma.dnxMediaAsset.findUnique({
    where: { id: assetId },
    select: { storageKey: true, mimeType: true },
  });
  if (!asset?.storageKey) {
    return NextResponse.json({ ok: false, error: "ASSET_MISSING" }, { status: 404 });
  }

  let body: Buffer;
  try {
    body = await resolveMediaBody(asset.storageKey);
  } catch {
    return NextResponse.json({ ok: false, error: "STORAGE_READ_FAILED" }, { status: 502 });
  }

  const code = sanitizeFilenamePart(registration.visibleCode ?? registration.id.slice(0, 8));
  const filename = `clickaton-bienvenida-${code}.${format}`;
  const contentType =
    asset.mimeType || (format === "webp" ? "image/webp" : "image/png");

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.length),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
