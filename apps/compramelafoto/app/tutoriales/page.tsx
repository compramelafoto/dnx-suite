import { prisma } from "@/lib/prisma";
import TutorialCard from "@/components/tutorials/TutorialCard";

export const dynamic = "force-dynamic";

const TUTORIALS_KEY = "tutorials_videos";

type TutorialItem = {
  title: string;
  description?: string;
  youtubeId: string;
  thumbnailUrl: string;
  youtubeUrl?: string;
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

function parseStoredItems(value: string | null | undefined): TutorialItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : (parsed as { items?: unknown })?.items;
    if (!Array.isArray(items)) return [];
    const normalized = items
      .map((item, index): TutorialItem | null => {
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
          youtubeId: resolvedYoutubeId,
          thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${resolvedYoutubeId}/hqdefault.jpg`,
          youtubeUrl: String((item as any).youtubeUrl || "").trim() || undefined,
          order,
        };
      })
      .filter((item): item is TutorialItem => Boolean(item));
    return normalized.sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

async function enrichFromYoutube(item: TutorialItem): Promise<TutorialItem> {
  if (item.description && item.title) return item;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return item;
  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(
      item.youtubeId
    )}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) return item;
    const data = await res.json();
    const snippet = data?.items?.[0]?.snippet;
    if (!snippet) return item;
    const title = String(snippet?.title || "").trim() || item.title;
    const description = String(snippet?.description || "").trim() || item.description;
    const thumbnailUrl = String(
      snippet?.thumbnails?.maxres?.url ||
        snippet?.thumbnails?.standard?.url ||
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        ""
    ).trim() || item.thumbnailUrl;
    return { ...item, title, description, thumbnailUrl };
  } catch {
    return item;
  }
}

async function getTutorials(): Promise<TutorialItem[]> {
  const row = await prisma.systemSettings.findUnique({
    where: { key: TUTORIALS_KEY },
  });
  const items = parseStoredItems(row?.value);
  return Promise.all(items.map((item) => enrichFromYoutube(item)));
}

export default async function TutorialsPage() {
  const items = await getTutorials();

  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-3">
            Tutoriales
          </h1>
          <p className="text-lg text-[#6b7280]">
            Videos educativos para aprender a usar ComprameLaFoto paso a paso.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#6b7280]">Todavía no hay tutoriales publicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {items.map((item) => (
              <TutorialCard
                key={`${item.youtubeId}-${item.order}`}
                title={item.title}
                description={item.description}
                youtubeId={item.youtubeId}
                thumbnailUrl={item.thumbnailUrl}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
