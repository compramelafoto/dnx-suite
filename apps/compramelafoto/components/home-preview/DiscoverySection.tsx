"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import PreviewVisual from "@/components/home-preview/PreviewVisual";
import { PreviewButton, PreviewButtonLink } from "@/components/home-preview/PreviewButton";
import { cn } from "@/lib/utils";

const TZ = "America/Argentina/Buenos_Aires";
const PREVIEW_LIMIT = 6;
const EXPANDED_LIMIT = 12;

type TabId = "albums" | "upcoming" | "photographers";

type PublicAlbum = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  publicSlug: string;
  photosCount: number;
  coverPhotoUrl: string | null;
  coverPhotoUrlFallback?: string;
  photographer: {
    name: string | null;
    companyName: string | null;
  };
};

type PublicEvent = {
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

function formatDate(iso: string | null): string | null {
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

function eventStatusLabel(ev: PublicEvent): string {
  if (ev.isPast) return "Finalizado";
  if (ev.startsAt) {
    const start = new Date(ev.startsAt);
    if (!Number.isNaN(start.getTime()) && start > new Date()) return "Próximo";
  }
  return "En curso";
}

/** Enlace de inscripción para fotógrafos: /e/[slug] a partir del join de galería. */
function photographerJoinHref(joinUrl: string | null): string | null {
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

function AlbumCard({ album }: { album: PublicAlbum }) {
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
        <h3 className="font-semibold text-[#111827] m-0 line-clamp-2 text-[0.9375rem]">{album.title}</h3>
        {date ? <p className="text-sm text-[#6b7280] m-0">{date}</p> : null}
        {photographer ? (
          <p className="text-sm text-[#6b7280] m-0 truncate" title={photographer}>
            {photographer}
          </p>
        ) : null}
        <div className="mt-auto pt-3">
          <PreviewButtonLink
            href={`/a/${album.publicSlug}`}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            Ver fotos
          </PreviewButtonLink>
        </div>
      </div>
    </Card>
  );
}

function EventCard({
  ev,
  mode,
}: {
  ev: PublicEvent;
  mode: "upcoming" | "photographers";
}) {
  const href =
    mode === "photographers" ? photographerJoinHref(ev.joinUrl) : ev.joinUrl ?? "#";
  const date = formatDate(ev.startsAt);
  const status = eventStatusLabel(ev);

  const ctaLabel = mode === "photographers" ? "Inscribirme como fotógrafo" : "Ver evento";

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
            {ev.typeLabel}
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

const TABS: { id: TabId; label: string }[] = [
  { id: "albums", label: "Álbumes disponibles" },
  { id: "upcoming", label: "Próximos eventos" },
  { id: "photographers", label: "Eventos para fotógrafos" },
];

export default function DiscoverySection() {
  const [tab, setTab] = useState<TabId>("albums");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [albums, setAlbums] = useState<PublicAlbum[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlbums = useCallback(async () => {
    setAlbumsLoading(true);
    try {
      // API real: GET /api/public/albums — álbumes públicos (incluye subálbumes de evento)
      const res = await fetch("/api/public/albums");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setAlbums(data);
      }
    } catch {
      setError("No se pudieron cargar los álbumes.");
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      // API real: GET /api/public/events — eventos públicos + álbumes (filtramos solo EVENT)
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

  useEffect(() => {
    setExpanded(false);
  }, [tab, query]);

  const upcomingEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => !e.isPast)
      .filter((e) => {
        if (!q) return true;
        const hay = [e.title, e.city, e.locationName, e.typeLabel].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = a.startsAt ? new Date(a.startsAt).getTime() : 0;
        const tb = b.startsAt ? new Date(b.startsAt).getTime() : 0;
        return ta - tb;
      });
  }, [events, query]);

  const photographerEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (!q) return true;
        const hay = [e.title, e.city, e.locationName, e.typeLabel].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = a.startsAt ? new Date(a.startsAt).getTime() : 0;
        const tb = b.startsAt ? new Date(b.startsAt).getTime() : 0;
        return tb - ta;
      });
  }, [events, query]);

  const filteredAlbums = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter((a) => {
      const hay = [
        a.title,
        a.location,
        a.photographer.name,
        a.photographer.companyName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [albums, query]);

  const limit = expanded ? EXPANDED_LIMIT : PREVIEW_LIMIT;

  const visibleAlbums = filteredAlbums.slice(0, limit);
  const visibleUpcoming = upcomingEvents.slice(0, limit);
  const visiblePhotographer = photographerEvents.slice(0, limit);

  const totalForTab =
    tab === "albums"
      ? filteredAlbums.length
      : tab === "upcoming"
        ? upcomingEvents.length
        : photographerEvents.length;

  const loading = tab === "albums" ? albumsLoading : eventsLoading;

  return (
    <PreviewSection id="descubrir" variant="muted">
      <PreviewReveal>
        <PreviewProse className="mb-8 md:mb-10 max-w-[min(100%,42rem)]">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
            Descubrí álbumes y eventos
          </h2>
          <p className="text-[#6b7280] text-base mt-3 mb-0 leading-relaxed">
            Tres listados separados: comprá fotos, mirá eventos próximos o inscribite como fotógrafo. No los
            mezclamos en una sola grilla.
          </p>
        </PreviewProse>
      </PreviewReveal>

      <div className="w-full max-w-2xl min-w-0 mb-8">
        <label htmlFor="home-preview-search" className="sr-only">
          Buscar
        </label>
        <Input
          id="home-preview-search"
          type="search"
          placeholder="Nombre del evento, ciudad, fotógrafo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
      </div>

      <div
        className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-8 w-full min-w-0"
        role="tablist"
        aria-label="Tipo de contenido"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 min-w-0 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
              tab === t.id
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white text-[#4b5563] border-[#e5e7eb] hover:bg-[#f9fafb]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 m-0">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-center text-[#6b7280] py-12 m-0">Cargando…</p>
      ) : (
        <>
          {tab === "albums" && (
            <div role="tabpanel" className="min-w-0 w-full">
              {visibleAlbums.length === 0 ? (
                <p className="text-center text-[#6b7280] py-8 m-0">No hay álbumes para mostrar.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 m-0 p-0 list-none w-full min-w-0">
                  {visibleAlbums.map((album) => (
                    <li key={album.id} className="min-w-0 flex">
                      <AlbumCard album={album} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "upcoming" && (
            <div role="tabpanel" className="min-w-0 w-full">
              {visibleUpcoming.length === 0 ? (
                <p className="text-center text-[#6b7280] py-8 m-0">No hay eventos próximos por ahora.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 m-0 p-0 list-none w-full min-w-0">
                  {visibleUpcoming.map((ev) => (
                    <li key={ev.id} className="min-w-0 flex">
                      <EventCard ev={ev} mode="upcoming" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "photographers" && (
            <div id="descubrir-eventos-fotografos" role="tabpanel" className="min-w-0 w-full scroll-mt-28">
              <p className="text-sm text-[#6b7280] mb-4 m-0 max-w-[min(100%,42rem)]">
                Eventos abiertos para sumarte como fotógrafo oficial o colaborador.
              </p>
              {visiblePhotographer.length === 0 ? (
                <p className="text-center text-[#6b7280] py-8 m-0">No hay eventos disponibles.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 m-0 p-0 list-none w-full min-w-0">
                  {visiblePhotographer.map((ev) => (
                    <li key={`ph-${ev.id}`} className="min-w-0 flex">
                      <EventCard ev={ev} mode="photographers" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {totalForTab > PREVIEW_LIMIT ? (
            <div className="flex justify-center mt-8">
              <PreviewButton
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Ver menos" : `Ver todos (${totalForTab})`}
              </PreviewButton>
            </div>
          ) : null}
        </>
      )}
    </PreviewSection>
  );
}
