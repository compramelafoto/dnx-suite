import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublishedTalkBySlug } from "@/lib/public/public-talks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/talks/[slug]
 * Solo charlas PUBLISHED. Draft/closed/archived → 404.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const { slug } = await Promise.resolve(params);
    const talk = await getPublishedTalkBySlug(prisma, slug ?? "");

    if (!talk) {
      return NextResponse.json({ talk: null }, { status: 404 });
    }

    return NextResponse.json({ talk });
  } catch (err: unknown) {
    console.error("GET /api/public/talks/[slug] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo la charla" },
      { status: 500 }
    );
  }
}
