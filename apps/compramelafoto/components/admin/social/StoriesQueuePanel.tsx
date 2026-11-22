"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StoryQueueItem } from "@/lib/social/album-stories";

type Status = { connected: boolean; username: string | null; expiresAt: string | null; live: boolean };

const ESTADOS: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "En cola", className: "bg-amber-100 text-amber-800" },
  PUBLISHING: { label: "Publicando", className: "bg-blue-100 text-blue-800" },
  PUBLISHED: { label: "Publicada", className: "bg-emerald-100 text-emerald-800" },
  FAILED: { label: "Falló, se reintenta", className: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Sacada", className: "bg-gray-100 text-gray-600" },
};

const fmtDia = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const fmtHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
});

export default function StoriesQueuePanel({
  status,
  queue,
  connectResult,
}: {
  status: Status;
  queue: StoryQueueItem[];
  connectResult: string | null;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function accion(id: string, action: "cancel" | "now") {
    setOcupado(id);
    setAviso(null);
    const r = await fetch(`/api/admin/social/stories/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) setAviso((await r.json().catch(() => null))?.error ?? "No se pudo hacer el cambio");
    else if (action === "now") setAviso("Sale en los próximos 5 minutos.");
    setOcupado(null);
    router.refresh();
  }

  async function armarAhora() {
    setOcupado("generar");
    setAviso(null);
    const r = await fetch("/api/admin/social/stories/generate", { method: "POST" });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) setAviso("No se pudo armar la cola.");
    else if (d.reason === "NO_ACCOUNT") setAviso("Primero hay que conectar la cuenta de Instagram.");
    else
      setAviso(
        `Se agendaron ${d.scheduled.length} historias` +
          (d.failed.length ? `; ${d.failed.length} álbumes fallaron al armarse` : "") +
          (d.skipped.QUEUE_FULL ? `; ${d.skipped.QUEUE_FULL} no entran en la semana` : "") +
          ".",
      );
    setOcupado(null);
    router.refresh();
  }

  const porDia = new Map<string, StoryQueueItem[]>();
  for (const item of queue) {
    const k = item.scheduleAt ? fmtDia.format(new Date(item.scheduleAt)) : "Sin horario";
    porDia.set(k, [...(porDia.get(k) ?? []), item]);
  }
  const enCola = queue.filter((q) => q.status === "SCHEDULED").length;

  return (
    <div className="space-y-6 ds-dashboard-inner mx-auto w-full min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0">Historias de Instagram</h1>
        <p className="text-gray-600 mt-1 m-0">
          Cada mañana a las 08:00 se arma una historia por cada álbum público de más de 50 fotos y se
          agenda: hasta 10 por día, lo que no entra espera a los días siguientes. Salen solas a su
          hora; podés sacar cualquiera antes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        {status.connected ? (
          <span className="text-sm text-gray-800">
            Cuenta conectada: <strong>@{status.username}</strong>
            {status.expiresAt ? (
              <span className="text-gray-500">
                {" "}
                · el permiso se renueva solo (vence {new Date(status.expiresAt).toLocaleDateString("es-AR")})
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-sm text-red-700">La cuenta de Instagram no está conectada: no se arma ni se publica nada.</span>
        )}
        {/* Es una ruta de API que redirige a Meta: tiene que ser navegación completa, no <Link>. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/social/instagram/connect"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {status.connected ? "Reconectar" : "Conectar Instagram"}
        </a>
        <button
          type="button"
          onClick={armarAhora}
          disabled={!status.connected || ocupado !== null}
          className="rounded-md bg-[#c27b3d] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {ocupado === "generar" ? "Armando…" : "Armar ahora"}
        </button>
        <span className="text-sm text-gray-500">{enCola} en cola</span>
      </div>

      {!status.live ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Modo simulacro: las historias se arman y «se publican» sin llegar a Instagram. Para que
          salgan de verdad falta activar <code>DNX_SOCIAL_PUBLISHER_LIVE=true</code> en Vercel.
        </div>
      ) : null}
      {connectResult === "connected" ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Instagram quedó conectado.</div>
      ) : connectResult === "error" ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">No se pudo conectar Instagram. Probá de nuevo.</div>
      ) : null}
      {aviso ? <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">{aviso}</div> : null}

      {queue.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
          No hay historias en la cola.
        </div>
      ) : (
        [...porDia.entries()].map(([dia, items]) => (
          <section key={dia} className="space-y-3">
            <h2 className="m-0 text-base font-semibold capitalize text-gray-900">
              {dia} <span className="font-normal text-gray-500">· {items.length}</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((s) => {
                const e = ESTADOS[s.status] ?? { label: s.status, className: "bg-gray-100 text-gray-600" };
                const puedeSacar = s.status === "SCHEDULED" || s.status === "FAILED";
                return (
                  <article key={s.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <div className="relative aspect-[9/16] bg-gray-100">
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt={s.albumTitle} className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                      <span className={`absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-medium ${e.className}`}>
                        {e.label}
                      </span>
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="m-0 text-sm font-semibold text-gray-900">
                        {s.scheduleAt ? fmtHora.format(new Date(s.scheduleAt)) : "—"} h
                      </p>
                      <p className="m-0 line-clamp-2 text-sm text-gray-800">{s.albumTitle}</p>
                      <p className="m-0 text-xs text-gray-500">
                        {s.userTags.length
                          ? `Etiqueta a ${s.userTags
                              .filter((t) => !s.droppedUserTags.includes(t))
                              .map((t) => `@${t}`)
                              .join(", ")}`
                          : s.photographer || "Sin Instagram del fotógrafo"}
                      </p>
                      {s.droppedUserTags.length ? (
                        <p className="m-0 text-xs text-amber-700">
                          No se pudo etiquetar a {s.droppedUserTags.map((t) => `@${t}`).join(", ")} (cuenta
                          privada o inexistente).
                        </p>
                      ) : null}
                      {s.lastError && s.status === "FAILED" ? (
                        <p className="m-0 text-xs text-red-600">{s.lastError}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {s.albumSlug ? (
                          <a href={`/a/${s.albumSlug}`} target="_blank" rel="noreferrer" className="text-xs text-[#c27b3d] underline">
                            Ver álbum
                          </a>
                        ) : null}
                        {s.permalink ? (
                          <a href={s.permalink} target="_blank" rel="noreferrer" className="text-xs text-[#c27b3d] underline">
                            Ver en Instagram
                          </a>
                        ) : null}
                      </div>
                      {puedeSacar ? (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => accion(s.id, "cancel")}
                            disabled={ocupado !== null}
                            className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Sacar
                          </button>
                          {s.status === "SCHEDULED" ? (
                            <button
                              type="button"
                              onClick={() => accion(s.id, "now")}
                              disabled={ocupado !== null}
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Publicar ya
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
