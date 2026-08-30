import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TUTORIALS_KEY = "tutorials_videos";

type StoredTutorial = {
  title: string;
  description?: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl?: string;
  order: number;
};

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace("www.", "");
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.pathname.startsWith("/watch")) {
        return url.searchParams.get("v");
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
    return null;
  } catch {
    if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed)) return trimmed;
    return null;
  }
}

function parseStoredItems(value: string | null | undefined): StoredTutorial[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : (parsed as { items?: unknown })?.items;
    if (!Array.isArray(items)) return [];
    const normalized = items
      .map((item, index): StoredTutorial | null => {
        if (!item || typeof item !== "object") return null;
        const title = String((item as any).title || "").trim();
        const youtubeId = String((item as any).youtubeId || "").trim();
        const description = String((item as any).description || "").trim();
        const thumbnailUrl = String((item as any).thumbnailUrl || "").trim();
        const order = Number.isFinite((item as any).order)
          ? Number((item as any).order)
          : index + 1;
        const resolvedYoutubeId = youtubeId || extractYoutubeId(String((item as any).youtubeUrl || ""));
        if (!title || !resolvedYoutubeId) return null;
        return {
          title,
          description: description || undefined,
          youtubeUrl: String((item as any).youtubeUrl || "").trim(),
          youtubeId: resolvedYoutubeId,
          thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${resolvedYoutubeId}/hqdefault.jpg`,
          order,
        };
      })
      .filter((item): item is StoredTutorial => Boolean(item));
    return normalized.sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const row = await prisma.systemSettings.findUnique({
      where: { key: TUTORIALS_KEY },
    });
    const items = parseStoredItems(row?.value);
    return NextResponse.json({
      items: items.map((item) => ({
        title: item.title,
        description: item.description ?? "",
        youtubeId: item.youtubeId,
        thumbnailUrl: item.thumbnailUrl ?? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`,
      })),
    });
  } catch (e) {
    console.error("GET /api/tutorials", e);
    return NextResponse.json({ error: "Error obteniendo tutoriales" }, { status: 500 });
  }
}
