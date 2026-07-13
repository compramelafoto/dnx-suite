"use client";

import { useMemo, useState } from "react";
import type { AssistantEventCard } from "@/lib/editorial-assistant";
import { filterEventCards, formatEventDate } from "@/lib/editorial-assistant";

type Props = {
  events: AssistantEventCard[];
  selectedId: number | null;
  onSelect: (event: AssistantEventCard) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepEvent({
  events,
  selectedId,
  onSelect,
  onBack,
  onContinue,
}: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "upcoming" | "ongoing" | "finished">(
    "all",
  );
  const [city, setCity] = useState("");

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.city?.trim()) set.add(e.city.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [events]);

  const filtered = useMemo(
    () => filterEventCards(events, { q, status, city }),
    [events, q, status, city],
  );

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-[clamp(1.75rem,1.3rem+1.5vw,2.5rem)] font-semibold leading-tight tracking-tight">
          ¿Sobre qué evento querés escribir?
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-muted)]">
          Te mostramos lo que ya hay en la redacción: coberturas, fotógrafos y
          fotografías.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-4 sm:p-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Buscar</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre del evento o ciudad"
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro por momento">
          {(
            [
              ["all", "Todos"],
              ["upcoming", "Próximos"],
              ["ongoing", "En curso"],
              ["finished", "Finalizados"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`min-h-10 rounded-full px-4 text-sm font-medium ${
                status === value
                  ? "bg-[var(--is-accent)] text-white"
                  : "border border-[var(--is-border)] bg-white text-[var(--is-text)]"
              }`}
              aria-pressed={status === value}
            >
              {label}
            </button>
          ))}
        </div>
        {cities.length > 0 ? (
          <label className="block max-w-xs">
            <span className="mb-2 block text-sm font-semibold">Ciudad</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 text-sm"
            >
              <option value="">Todas</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-white p-8 text-center text-[var(--is-muted)]">
          No encontramos eventos con ese criterio. Probá otra búsqueda o partí de
          una cobertura.
        </p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2" role="listbox" aria-label="Eventos">
          {filtered.map((event) => {
            const selected = selectedId === event.id;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(event)}
                  className={`flex h-full w-full flex-col overflow-hidden rounded-[var(--is-radius-md)] border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)] ${
                    selected
                      ? "border-[var(--is-accent)] ring-2 ring-[var(--is-accent)]/30"
                      : "border-[var(--is-border)] hover:border-[var(--is-accent)]"
                  }`}
                >
                  <div className="aspect-[16/9] bg-[var(--is-bg-muted)]">
                    {event.coverThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.coverThumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[var(--is-muted)]">
                        Sin portada
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--is-accent)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--is-accent)]">
                        {event.statusLabel}
                      </span>
                      <span className="text-xs text-[var(--is-muted)]">
                        {formatEventDate(event.startsAt)}
                      </span>
                    </div>
                    <h2 className="font-[family-name:var(--font-source-serif)] text-xl font-semibold leading-snug tracking-tight">
                      {event.title}
                    </h2>
                    <p className="text-sm text-[var(--is-muted)]">
                      {event.city || "Ciudad a confirmar"}
                    </p>
                    <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-[var(--is-border)] pt-4 text-center text-xs">
                      <div>
                        <dt className="text-[var(--is-muted)]">Coberturas</dt>
                        <dd className="mt-1 text-base font-semibold tabular-nums">
                          {event.coverageCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--is-muted)]">Fotógrafos</dt>
                        <dd className="mt-1 text-base font-semibold tabular-nums">
                          {event.photographerCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--is-muted)]">Fotos</dt>
                        <dd className="mt-1 text-base font-semibold tabular-nums">
                          {event.photoCount}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-[var(--is-border)] pt-8 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Continuar con este evento
        </button>
      </div>
    </div>
  );
}
