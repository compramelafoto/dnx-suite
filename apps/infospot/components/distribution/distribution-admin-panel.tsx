"use client";

import { useState, useTransition } from "react";
import {
  deactivateHomepagePlacementAction,
  upsertHomepagePlacementAction,
  updateEventDistributionFlagsAction,
} from "@/app/actions/homepage-distribution";

type PlacementRow = {
  id: string;
  placementType: string;
  isActive: boolean;
  priority: number;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  customTitle: string | null;
  article: { id: string; title: string; slug: string } | null;
  event: { id: string; title: string; slug: string } | null;
};

type PublishedOption = { id: string; title: string; kind: "article" | "event" };

type EventFlagRow = {
  id: string;
  title: string;
  editorialPriority: number;
  excludeFromHomepage: boolean;
};

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
  const [target, setTarget] = useState(publishedOptions[0]?.id ?? "");
  const [priority, setPriority] = useState(10);
  const [sortOrder, setSortOrder] = useState(0);

  const createPlacement = () => {
    const opt = publishedOptions.find((o) => o.id === target);
    if (!opt) {
      setMessage("Seleccioná contenido publicado.");
      return;
    }
    startTransition(async () => {
      const result = await upsertHomepagePlacementAction({
        placementType: "HERO",
        articleId: opt.kind === "article" ? opt.id : null,
        eventId: opt.kind === "event" ? opt.id : null,
        priority,
        sortOrder,
        isActive: true,
      });
      setMessage(result.ok ? "Banner creado." : result.error);
      if (result.ok) window.location.reload();
    });
  };

  return (
    <div className="space-y-12">
      <section className="space-y-6 rounded-2xl border border-[var(--is-border)] bg-white p-6 md:p-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Banner principal (HERO)</h2>
          <p className="mt-2 text-sm text-[var(--is-muted)]">
            Solo contenido PUBLISHED + REAL. Si no hay banner activo, la home usa
            fallback automático.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Contenido</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--is-border)] px-3"
            >
              {publishedOptions.length === 0 ? (
                <option value="">No hay contenido publicado REAL</option>
              ) : (
                publishedOptions.map((o) => (
                  <option key={`${o.kind}-${o.id}`} value={o.id}>
                    [{o.kind === "event" ? "Evento" : "Artículo"}] {o.title}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Prioridad</span>
            <input
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="min-h-11 w-full rounded-xl border border-[var(--is-border)] px-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Orden</span>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="min-h-11 w-full rounded-xl border border-[var(--is-border)] px-3"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={pending || publishedOptions.length === 0}
          onClick={createPlacement}
          className="is-btn is-btn-solid min-h-11 px-5 text-sm"
        >
          Activar en portada
        </button>

        <ul className="divide-y divide-[var(--is-border)] border-t border-[var(--is-border)]">
          {placements.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">
                  {p.customTitle || p.event?.title || p.article?.title}
                </p>
                <p className="text-sm text-[var(--is-muted)]">
                  {p.placementType} · prioridad {p.priority} ·{" "}
                  {p.isActive ? "activo" : "inactivo"}
                </p>
              </div>
              {p.isActive ? (
                <button
                  type="button"
                  disabled={pending}
                  className="is-btn is-btn-secondary h-10 px-4 text-sm"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deactivateHomepagePlacementAction(p.id);
                      setMessage(r.ok ? "Banner desactivado." : r.error);
                      if (r.ok) window.location.reload();
                    })
                  }
                >
                  Desactivar
                </button>
              ) : null}
            </li>
          ))}
          {placements.length === 0 ? (
            <li className="py-4 text-sm text-[var(--is-muted)]">Sin placements todavía.</li>
          ) : null}
        </ul>
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
