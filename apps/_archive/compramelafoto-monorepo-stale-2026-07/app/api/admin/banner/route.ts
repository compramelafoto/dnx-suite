import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

const BANNER_KEY = "home_banner_images";

export type BannerSlide = {
  src: string;
  alt: string;
  link?: string;
  openInNewTab?: boolean;
};

type BannerPayload = { enabled?: boolean; images: BannerSlide[] };

function parseBody(body: unknown): BannerPayload | null {
  if (!body || typeof body !== "object" || !("images" in body)) return null;
  const images = (body as { images: unknown }).images;
  if (!Array.isArray(images)) return null;
  const result: BannerSlide[] = [];
  for (const x of images) {
    if (x && typeof x === "object" && typeof (x as any).src === "string" && typeof (x as any).alt === "string") {
      result.push({
        src: String((x as any).src).trim(),
        alt: String((x as any).alt).trim(),
        link: typeof (x as any).link === "string" ? (x as any).link.trim() || undefined : undefined,
        openInNewTab: Boolean((x as any).openInNewTab),
      });
    }
  }
  const enabled = (body as { enabled?: boolean }).enabled;
  return { enabled: typeof enabled === "boolean" ? enabled : true, images: result };
}

export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const row = await prisma.systemSettings.findUnique({
      where: { key: BANNER_KEY },
    });
    if (!row?.value) {
      return NextResponse.json({ enabled: true, images: [] });
    }
    const parsed = JSON.parse(row.value) as unknown;
    // Compat: si es un array (formato antiguo), banner habilitado
    const isLegacyArray = Array.isArray(parsed);
    const images = isLegacyArray ? (parsed as BannerSlide[]) : (parsed as { enabled?: boolean; images?: unknown })?.images;
    const enabled = isLegacyArray ? true : (parsed as { enabled?: boolean }).enabled !== false;
    const arr = Array.isArray(images) ? images : [];
    const valid = arr.filter(
      (x): x is BannerSlide => typeof x?.src === "string" && typeof x?.alt === "string"
    );
    return NextResponse.json({ enabled, images: valid });
  } catch (e) {
    console.error("GET /api/admin/banner", e);
    return NextResponse.json({ error: "Error obteniendo banner" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const payload = parseBody(body);
    if (payload === null) {
      return NextResponse.json({ error: "Body debe ser { images: [{ src, alt }, ...], enabled?: boolean }" }, { status: 400 });
    }
    const value = JSON.stringify({ enabled: payload.enabled, images: payload.images });
    await prisma.systemSettings.upsert({
      where: { key: BANNER_KEY },
      create: {
        key: BANNER_KEY,
        value,
        description: "Banner del home: { enabled, images: [{ src, alt, link?, openInNewTab? }] }.",
      },
      update: { value },
    });
    return NextResponse.json({ ok: true, enabled: payload.enabled, images: payload.images });
  } catch (e) {
    console.error("PUT /api/admin/banner", e);
    return NextResponse.json({ error: "Error guardando banner" }, { status: 500 });
  }
}
