"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import PreviewVisual from "@/components/home-preview/PreviewVisual";
import { PreviewButton, PreviewButtonLink } from "@/components/home-preview/PreviewButton";
import { cn } from "@/lib/utils";

export const TZ = "America/Argentina/Buenos_Aires";
export const LIST_LIMIT = 6;

export type PublicAlbum = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  publicSlug: string;
  photosCount: number;
  coverPhotoUrl: string | null;
  photographer: { name: string | null; companyName: string | null };
};

export type PublicEvent = {
  id: number;
  title: string;
  city: string | null;
  locationName: string | null;
  startsAt: string | null;
  isPast: boolean;
  typeLabel: string;
  joinUrl: string | null;
  coverUrl: string | null;
  source: "EVENT" | "ALBUM";
};

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: TZ,
    });
  } catch {
    return null;
  }
}

export function photographerJoinHref(joinUrl: string | null): string | null {
  if (!joinUrl) return null;
  try {
    const url = new URL(joinUrl, typeof window !== "undefined" ? window.location.origin : undefined);
    return url.pathname.replace(/^\/g\//, "/e/");
  } catch {
    return joinUrl.replace(/\/g\//, "/e/");
  }
}

function locationLine(ev: PublicEvent): string {
  return [ev.city, ev.locationName].filter(Boolean).join(" · ") || "—";
}

function eventStatusLabel(ev: PublicEvent): string {
  if (ev.isPast) return "Finalizado";
  if (ev.startsAt) {
    const start = new Date(ev.startsAt);
    if (!Number.isNaN(start.getTime()) && start > new Date()) return "Próximo";
  }
  return "En curso";
}

export function AlbumCard({ album }: { album: PublicAlbum }) {
  const photographer = album.photographer.companyName || album.photographer.name;
  const date = formatDate(album.eventDate);

  return (
    <Card className="hp-card overflow-hidden h-full flex flex-col min-w-0 w-full !rounded-2xl !p-0 border-[#e5e7eb] shadow-none">
      <div className="aspect-[4/3] relative bg-[#f3f4f6] min-w-0">
        {album.coverPhotoUrl ? (
          <Image
            src={album.coverPhotoUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={album.coverPhotoUrl.startsWith("/uploads/")}
          />
        ) : (
          <div className="absolute inset-2 rounded-xl overflow-hidden">
            <PreviewVisual variant="albums" aspect="video" className="h-full !aspect-auto min-h-full border-0" />
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5 flex flex-col flex-1 min-w-0 gap-1">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[#9a6b47]">Álbum</span>
        <h3 className="font-semibold text-[#111827] m-0 line-clamp-2 text-[0.9375rem]">{album.title}</h3>
        {date ? <p className="text-sm text-[#6b7280] m-0">{date}</p> : null}
        {photographer ? (
          <p className="text-sm text-[#6b7280] m-0 truncate" title={photographer}>
            {photographer}
          </p>
        ) : null}
        <div className="mt-auto pt-3">
          <PreviewButtonLink href={`/a/${album.publicSlug}`} variant="secondary" size="sm" className="w-full">
            Ver fotos
          </PreviewButtonLink>
        </div>
      </div>
    </Card>
  );
}

export function EventCard({
  ev,
  mode,
}: {
  ev: PublicEvent;
  mode: "upcoming" | "photographers";
}) {
  const href = mode === "photographers" ? photographerJoinHref(ev.joinUrl) : ev.joinUrl ?? "#";
  const date = formatDate(ev.startsAt);
  const status = eventStatusLabel(ev);
  const ctaLabel = mode === "photographers" ? "Inscribirme" : "Ver evento";

  return (
    <Card className="hp-card h-full flex flex-col min-w-0 w-full !rounded-2xl !p-0 overflow-hidden border-[#e5e7eb] shadow-none">
      <div className="aspect-[16/9] relative bg-[#f3f4f6] min-w-0 shrink-0">
        {ev.coverUrl ? (
          <Image
            src={ev.coverUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={ev.coverUrl.startsWith("/uploads/")}
          />
        ) : (
          <div className="absolute inset-2 rounded-xl overflow-hidden">
            <PreviewVisual variant="events" aspect="video" className="h-full !aspect-auto min-h-full border-0" />
          </div>
        )}
      </div>
      <div className="flex flex-col flex-1 p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[#9ca3af]">
            {mode === "photographers" ? "Convocatoria" : "Evento"}
          </span>
          <span
            className={cn(
              "text-[0.6875rem] font-medium px-2 py-0.5 rounded-md",
              ev.isPast ? "bg-[#f3f4f6] text-[#6b7280]" : "bg-[#ecfdf5] text-[#047857]"
            )}
          >
            {status}
          </span>
        </div>
        <h3 className="font-semibold text-[#111827] m-0 line-clamp-2 text-[0.9375rem]">{ev.title}</h3>
        {date ? <p className="text-sm text-[#6b7280] mt-2 m-0">{date}</p> : null}
        <p className="text-sm text-[#6b7280] mt-1 m-0 line-clamp-2 min-w-0">{locationLine(ev)}</p>
        <div className="mt-auto pt-4">
          {href && href !== "#" ? (
            <PreviewButtonLink href={href} variant="secondary" size="sm" className="w-full">
              {ctaLabel}
            </PreviewButtonLink>
          ) : (
            <PreviewButton variant="secondary" size="sm" className="w-full" disabled>
              {ctaLabel}
            </PreviewButton>
          )}
        </div>
      </div>
    </Card>
  );
}

export function usePublicDiscovery() {
  const [albums, setAlbums] = useState<PublicAlbum[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlbums = useCallback(async () => {
    setAlbumsLoading(true);
    try {
      const res = await fetch("/api/public/albums");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setAlbums(data);
    } catch {
      setError("No se pudieron cargar los álbumes.");
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/public/events");
      const data = await res.json();
      if (res.ok && Array.isArray(data.events)) {
        setEvents(data.events.filter((e: PublicEvent) => e.source === "EVENT"));
      }
    } catch {
      setError("No se pudieron cargar los eventos.");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlbums();
    void loadEvents();
  }, [loadAlbums, loadEvents]);

  return { albums, events, albumsLoading, eventsLoading, error };
}

export function filterByQuery<T>(items: T[], getHaystack: (item: T) => string, query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getHaystack(item).toLowerCase().includes(q));
}

export function useFilteredDiscovery(query: string) {
  const { albums, events, albumsLoading, eventsLoading, error } = usePublicDiscovery();

  const upcomingEvents = useMemo(() => {
    const filtered = filterByQuery(
      events.filter((e) => !e.isPast),
      (e) => [e.title, e.city, e.locationName, e.typeLabel].filter(Boolean).join(" "),
      query
    );
    return filtered.sort((a, b) => {
      const ta = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const tb = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return ta - tb;
    });
  }, [events, query]);

  const photographerEvents = useMemo(() => {
    const filtered = filterByQuery(
      events,
      (e) => [e.title, e.city, e.locationName, e.typeLabel].filter(Boolean).join(" "),
      query
    );
    return filtered.sort((a, b) => {
      const ta = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const tb = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return tb - ta;
    });
  }, [events, query]);

  const filteredAlbums = useMemo(() => {
    return filterByQuery(
      albums,
      (a) => [a.title, a.location, a.photographer.name, a.photographer.companyName].filter(Boolean).join(" "),
      query
    );
  }, [albums, query]);

  return {
    upcomingEvents,
    photographerEvents,
    filteredAlbums,
    albumsLoading,
    eventsLoading,
    error,
  };
}
