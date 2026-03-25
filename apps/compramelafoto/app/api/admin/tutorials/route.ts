import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

const TUTORIALS_KEY = "tutorials_videos";

type StoredTutorial = {
  title: string;
  description?: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl?: string;
  order: number;
};

type TutorialDraft = {
  youtubeUrl?: string;
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
        const youtubeUrl = String((item as any).youtubeUrl || "").trim();
        const youtubeId = String((item as any).youtubeId || "").trim();
        const description = String((item as any).description || "").trim();
        const thumbnailUrl = String((item as any).thumbnailUrl || "").trim();
        const order = Number.isFinite((item as any).order)
          ? Number((item as any).order)
          : index + 1;
        if (!title || (!youtubeId && !youtubeUrl)) return null;
        const resolvedYoutubeId = youtubeId || extractYoutubeId(youtubeUrl || "") || "";
        return {
          title,
          description: description || undefined,
          youtubeUrl,
          youtubeId: resolvedYoutubeId,
          thumbnailUrl: thumbnailUrl || (resolvedYoutubeId ? `https://img.youtube.com/vi/${resolvedYoutubeId}/hqdefault.jpg` : undefined),
          order,
        };
      })
      .filter((item): item is StoredTutorial => Boolean(item && item.youtubeId));
    return normalized.sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

function parseBody(body: unknown): { items: TutorialDraft[] } | { error: string } {
  if (!body || typeof body !== "object" || !("items" in body)) {
    return { error: "Body debe incluir { items: [...] }" };
  }
  const items = (body as { items: unknown }).items;
  if (!Array.isArray(items)) {
    return { error: "Items debe ser un array" };
  }
  return { items: items as TutorialDraft[] };
}

async function fetchYoutubeMetadata(youtubeUrl: string, youtubeId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(
        youtubeId
      )}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const snippet = data?.items?.[0]?.snippet;
        const title = String(snippet?.title || "").trim();
        const description = String(snippet?.description || "").trim();
        const thumbnailUrl = String(
          snippet?.thumbnails?.maxres?.url ||
            snippet?.thumbnails?.standard?.url ||
            snippet?.thumbnails?.high?.url ||
            snippet?.thumbnails?.medium?.url ||
            snippet?.thumbnails?.default?.url ||
            ""
        ).trim();
        if (title) {
          return {
            title,
            description,
            thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
          };
        }
      }
    } catch {
      // fallback below
    }
  }

  const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeUrl)}`;
  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      throw new Error(`oEmbed error ${res.status}`);
    }
    const data = await res.json();
    const title = String(data?.title || "").trim();
    const thumbnailUrl = String(data?.thumbnail_url || "").trim();
    return {
      title: title || `Video ${youtubeId}`,
      thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      description: "",
    };
  } catch {
    return {
      title: `Video ${youtubeId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      description: "",
    };
  }
}

export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const row = await prisma.systemSettings.findUnique({
      where: { key: TUTORIALS_KEY },
    });
    const items = parseStoredItems(row?.value);
    return NextResponse.json({
      items: items.map((item) => ({
        title: item.title,
        description: item.description ?? "",
        youtubeUrl: item.youtubeUrl,
        thumbnailUrl: item.thumbnailUrl ?? "",
      })),
    });
  } catch (e) {
    console.error("GET /api/admin/tutorials", e);
    return NextResponse.json({ error: "Error obteniendo tutoriales" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const parsed = parseBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const items: StoredTutorial[] = [];
    for (let i = 0; i < parsed.items.length; i += 1) {
      const raw = parsed.items[i] || {};
      const youtubeUrl = String(raw?.youtubeUrl || "").trim();
      const youtubeId = extractYoutubeId(youtubeUrl);
      if (!youtubeId) {
        return NextResponse.json(
          { error: `El tutorial #${i + 1} debe tener un link de YouTube válido` },
          { status: 400 }
        );
      }
      const meta = await fetchYoutubeMetadata(youtubeUrl, youtubeId);
      items.push({
        title: meta.title,
        description: meta.description || undefined,
        youtubeUrl,
        youtubeId,
        thumbnailUrl: meta.thumbnailUrl,
        order: i + 1,
      });
    }
    const value = JSON.stringify({ items });
    await prisma.systemSettings.upsert({
      where: { key: TUTORIALS_KEY },
      create: {
        key: TUTORIALS_KEY,
        value,
        description: "Tutoriales: { items: [{ title, description?, youtubeUrl, youtubeId, thumbnailUrl?, order }] }",
      },
      update: { value },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/admin/tutorials", e);
    return NextResponse.json({ error: "Error guardando tutoriales" }, { status: 500 });
  }
}
