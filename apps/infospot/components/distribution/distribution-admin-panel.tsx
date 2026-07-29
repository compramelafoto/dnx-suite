"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deactivateHomepagePlacementAction,
  reorderHomepageHeroPlacementsAction,
  upsertHomepagePlacementAction,
  updateEventDistributionFlagsAction,
} from "@/app/actions/homepage-distribution";

const MAX_HERO_SLIDES = 6;

type PlacementRow = {
  id: string;
  placementType: string;
  isActive: boolean;
  priority: number;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  customTitle: string | null;
  article: {
    id: string;
    title: string;
    slug: string;
    coverUrl?: string | null;
  } | null;
  event: {
    id: string;
    title: string;
    slug: string;
    coverUrl?: string | null;
  } | null;
};

type PublishedOption = {
  id: string;
  title: string;
  kind: "article" | "event";
  coverUrl?: string | null;
};

type EventFlagRow = {
  id: string;
  title: string;
  editorialPriority: number;
  excludeFromHomepage: boolean;
};

function placementTitle(p: PlacementRow) {
  return p.customTitle || p.event?.title || p.article?.title || "Sin título";
}

function placementCover(p: PlacementRow) {
  return p.event?.coverUrl || p.article?.coverUrl || null;
}

function placementKind(p: PlacementRow): "article" | "event" | null {
  if (p.event) return "event";
  if (p.article) return "article";
  return null;
}

export function DistributionAdminPanel({
  placements,
  publishedOptions,
  events,
}: {
  placements: PlacementRow[];
  publishedOptions: PublishedOption[];
  events: EventFlagRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [heroIds, setHeroIds] = useState(() =>
    placements
      .filter((p) => p.placementType === "HERO" && p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority)
      .map((p) => p.id),
  );
  const [dragId, setDragId] = useState<string | null>(null);

  const placementById = useMemo(() => {
    const map = new Map(placements.map((p) => [p.id, p]));
    return map;
  }, [placements]);

  const heroSlides = heroIds
    .map((id) => placementById.get(id))
    .filter((p): p is PlacementRow => Boolean(p));

  const activeContentKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of heroSlides) {
      if (p.article) keys.add(`article:${p.article.id}`);
      if (p.event) keys.add(`event:${p.event.id}`);
    }
    return keys;
  }, [heroSlides]);

  const addableOptions = publishedOptions.filter(
    (o) => !activeContentKeys.has(`${o.kind}:${o.id}`),
  );

  const selectedTarget = target || addableOptions[0]?.id || "";

  const persistOrder = (nextIds: string[]) => {
    setHeroIds(nextIds);
    startTransition(async () => {
      const result = await reorderHomepageHeroPlacementsAction(nextIds);
      setMessage(result.ok ? "Orden del banner guardado." : result.error);
      if (!result.ok) window.location.reload();
    });
  };

  const addSlide = () => {
    const opt = addableOptions.find((o) => o.id === selectedTarget);
    if (!opt) {
      setMessage("Seleccioná una nota o evento publicado.");
      return;
    }
    if (heroSlides.length >= MAX_HERO_SLIDES) {
      setMessage(`Máximo ${MAX_HERO_SLIDES} slides en el banner.`);
      return;
    }
    startTransition(async () => {
      const result = await upsertHomepagePlacementAction({
        placementType: "HERO",
        articleId: opt.kind === "article" ? opt.id : null,
        eventId: opt.kind === "event" ? opt.id : null,
        sortOrder: heroSlides.length,
        priority: Math.max(1, MAX_HERO_SLIDES - heroSlides.length),
        isActive: true,
      });
      setMessage(result.ok ? "Agregada al banner." : result.error);
      if (result.ok) window.location.reload();
    });
  };

  const removeSlide = (id: string) => {
    startTransition(async () => {
      const r = await deactivateHomepagePlacementAction(id);
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      const next = heroIds.filter((x) => x !== id);
      setHeroIds(next);
      if (next.length > 0) {
        const reorder = await reorderHomepageHeroPlacementsAction(next);
        setMessage(reorder.ok ? "Slide quitado del banner." : reorder.error);
      } else {
        setMessage("Banner vacío: la home usará fallback automático.");
      }
      if (r.ok) window.location.reload();
    });
  };

  const moveSlide = (id: string, dir: -1 | 1) => {
    const index = heroIds.indexOf(id);
    if (index < 0) return;
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= heroIds.length) return;
    const next = [...heroIds];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item!);
    persistOrder(next);
  };

  const onDrop = (overId: string) => {
    if (!dragId || dragId === overId) {
      setDragId(null);
      return;
    }
    const from = heroIds.indexOf(dragId);
    const to = heroIds.indexOf(overId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const next = [...heroIds];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    persistOrder(next);
  };

  return (
    <div className="space-y-12">
      <section className="space-y-6 rounded-2xl border border-[var(--is-border)] bg-white p-6 md:p-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Banner principal (HERO)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--is-muted)]">
            Armá un slider con hasta {MAX_HERO_SLIDES} notas o eventos publicados.
            Arrastrá las tarjetas para definir el orden. En la home rotan
            automáticamente con un botón fijo «Ver más».
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 space-y-2">
            <span className="text-sm font-medium">Agregar al banner</span>
            <select
              value={selectedTarget}
              onChange={(e) => setTarget(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--is-border)] px-3"
            >
              {addableOptions.length === 0 ? (
                <option value="">No hay más contenido disponible</option>
              ) : (
                addableOptions.map((o) => (
                  <option key={`${o.kind}-${o.id}`} value={o.id}>
                    [{o.kind === "event" ? "Evento" : "Nota"}] {o.title}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || addableOptions.length === 0 || heroSlides.length >= MAX_HERO_SLIDES}
            onClick={addSlide}
            className="is-btn is-btn-solid min-h-11 shrink-0 px-5 text-sm"
          >
            Agregar al slider
          </button>
        </div>

        {heroSlides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-6 py-10 text-center">
            <p className="text-sm font-medium">Sin slides todavía</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--is-muted)]">
              Agregá notas publicadas. Si el banner queda vacío, la home usa un
              destacado automático.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Orden del banner HERO">
            {heroSlides.map((p, index) => {
              const cover = placementCover(p);
              const kind = placementKind(p);
              const isDragging = dragId === p.id;
              return (
                <li
                  key={p.id}
                  draggable={!pending}
                  onDragStart={() => setDragId(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(p.id)}
                  onDragEnd={() => setDragId(null)}
                  className={[
                    "flex cursor-grab items-stretch gap-3 rounded-2xl border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-3 active:cursor-grabbing md:p-4",
                    isDragging ? "opacity-60 ring-2 ring-[var(--is-accent)]" : "",
                  ].join(" ")}
                >
                  <div
                    className="flex w-8 shrink-0 flex-col items-center justify-center gap-1 text-[var(--is-muted)]"
                    aria-hidden
                  >
                    <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
                    <span className="text-lg leading-none">⋮⋮</span>
                  </div>

                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--is-graphite-200)]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--is-muted)]">
                        Sin imagen
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1 py-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-accent)]">
                      {kind === "event" ? "Evento" : "Nota"}
                    </p>
                    <p className="line-clamp-2 text-sm font-semibold leading-snug md:text-base">
                      {placementTitle(p)}
                    </p>
                    <p className="text-xs text-[var(--is-muted)]">
                      Arrastrá para reordenar · slide {index + 1} de {heroSlides.length}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled={pending || index === 0}
                      className="is-btn is-btn-secondary h-10 px-3 text-sm"
                      onClick={() => moveSlide(p.id, -1)}
                      aria-label="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={pending || index === heroSlides.length - 1}
                      className="is-btn is-btn-secondary h-10 px-3 text-sm"
                      onClick={() => moveSlide(p.id, 1)}
                      aria-label="Bajar"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="is-btn is-btn-secondary h-10 px-4 text-sm"
                      onClick={() => removeSlide(p.id)}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-6 rounded-2xl border border-[var(--is-border)] bg-white p-6 md:p-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Prioridad y exclusión</h2>
          <p className="mt-2 text-sm text-[var(--is-muted)]">
            `editorialPriority` (0–100) empuja el score. `excludeFromHomepage` saca el
            evento de bloques automáticos sin despublicar.
          </p>
        </div>
        <ul className="space-y-4">
          {events.slice(0, 30).map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-3 border-b border-[var(--is-border)] pb-4 md:flex-row md:items-end"
            >
              <div className="flex-1">
                <p className="font-medium">{event.title}</p>
              </div>
              <label className="block text-sm">
                Prioridad
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={event.editorialPriority}
                  className="mt-1 min-h-10 w-24 rounded-lg border border-[var(--is-border)] px-2"
                  id={`prio-${event.id}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={event.excludeFromHomepage}
                  id={`excl-${event.id}`}
                />
                Excluir de home
              </label>
              <button
                type="button"
                disabled={pending}
                className="is-btn is-btn-secondary h-10 px-4 text-sm"
                onClick={() =>
                  startTransition(async () => {
                    const prioEl = document.getElementById(
                      `prio-${event.id}`,
                    ) as HTMLInputElement | null;
                    const exclEl = document.getElementById(
                      `excl-${event.id}`,
                    ) as HTMLInputElement | null;
                    const r = await updateEventDistributionFlagsAction({
                      eventId: event.id,
                      editorialPriority: Number(prioEl?.value ?? 0),
                      excludeFromHomepage: Boolean(exclEl?.checked),
                    });
                    setMessage(r.ok ? "Flags actualizados." : r.error);
                  })
                }
              >
                Guardar
              </button>
            </li>
          ))}
        </ul>
      </section>

      {message ? <p className="text-sm text-[var(--is-muted)]">{message}</p> : null}
    </div>
  );
}
