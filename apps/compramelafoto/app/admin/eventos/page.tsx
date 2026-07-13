"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type EventPhotographer = {
  userId: number;
  name: string | null;
  email: string;
  companyName: string | null;
  phone: string | null;
  joinedAt: string | null;
};

type EventItem = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: string;
  endsAt: string | null;
  city: string;
  locationName: string | null;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  expectedAttendees: number | null;
  shareSlug: string | null;
  coverUrl: string | null;
  creator: { id: number; name: string | null; email: string | null };
  membersCount: number;
  albumsCount: number;
  photographers: EventPhotographer[];
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const q = query.trim();
      const res = await fetch(`/api/admin/events${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los eventos.");
        return;
      }
      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updatePhotographerStatus(
    eventId: number,
    userId: number,
    action: "disable" | "remove"
  ) {
    const key = `${eventId}:${userId}:${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const endpoint = `/api/admin/events/${eventId}/photographers/${userId}`;
      const res =
        action === "remove"
          ? await fetch(endpoint, { method: "DELETE", credentials: "include" })
          : await fetch(endpoint, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "disable" }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el fotógrafo.");
        return;
      }
      await loadEvents();
    } catch {
      setError("Error de conexión.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  const totalPhotographers = useMemo(
    () => events.reduce((acc, e) => acc + (e.photographers?.length ?? 0), 0),
    [events]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
          <p className="text-gray-600 mt-1">
            Administración global de eventos y fotógrafos inscriptos.
          </p>
        </div>
        <Link href="/admin/eventos/nuevo">
          <Button variant="primary">Crear evento</Button>
        </Link>
      </div>

      <Card className="p-4 flex flex-col md:flex-row md:items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por ID, título o ciudad"
          className="md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={loadEvents} disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </Button>
          <span className="text-xs text-gray-500">
            {events.length} evento(s) · {totalPhotographers} fotógrafo(s) inscriptos
          </span>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-l-4 border-red-400 text-red-700">
          {error}
        </Card>
      )}

      {loading ? (
        <p className="text-gray-600">Cargando eventos...</p>
      ) : events.length === 0 ? (
        <Card className="p-6 text-gray-600">No hay eventos para mostrar.</Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id} className="p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{event.title}</h2>
                  <p className="text-sm text-gray-500">
                    #{event.id} · {event.city}
                    {event.locationName ? ` · ${event.locationName}` : ""}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDateTime(event.startsAt)}
                    {event.endsAt ? ` — ${formatDateTime(event.endsAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.shareSlug && (
                    <Link href={`/e/${event.shareSlug}`} className="text-sm text-blue-600 hover:underline">
                      Ver público
                    </Link>
                  )}
                  <Link href={`/organizador/events/${event.id}`} className="text-sm text-blue-600 hover:underline">
                    Ver panel organizador
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Organizador</p>
                  <p className="text-gray-800">{event.creator?.name || event.creator?.email || "—"}</p>
                  <p className="text-xs text-gray-500">{event.creator?.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Estado</p>
                  <p>{event.visibility} · {event.joinPolicy}</p>
                  <p>{event.membersCount} inscriptos · {event.albumsCount} álbum(es)</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Cupo</p>
                  <p>{event.maxPhotographers ?? "Sin límite"} fotógrafo(s)</p>
                  <p>{event.expectedAttendees ? `${event.expectedAttendees} asistentes` : "Asistentes N/D"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Fotógrafos inscriptos</p>
                {event.photographers.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin fotógrafos inscriptos.</p>
                ) : (
                  <ul className="space-y-2">
                    {event.photographers.map((p) => {
                      const disableKey = `${event.id}:${p.userId}:disable`;
                      const removeKey = `${event.id}:${p.userId}:remove`;
                      return (
                        <li
                          key={p.userId}
                          className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-sm text-gray-700 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.name || p.email}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {p.email}
                              {p.companyName ? ` · ${p.companyName}` : ""}
                              {p.phone ? ` · ${p.phone}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {p.joinedAt ? (
                              <span className="text-xs text-gray-500">
                                Inscripto: {formatDateTime(p.joinedAt)}
                              </span>
                            ) : null}
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={actionLoading[disableKey]}
                              onClick={() => {
                                const ok = window.confirm(
                                  `¿Deshabilitar a ${p.name || p.email} en este evento?`
                                );
                                if (ok) {
                                  updatePhotographerStatus(event.id, p.userId, "disable");
                                }
                              }}
                            >
                              {actionLoading[disableKey] ? "Deshabilitando..." : "Deshabilitar"}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 focus:ring-red-200"
                              disabled={actionLoading[removeKey]}
                              onClick={() => {
                                const ok = window.confirm(
                                  `¿Desinscribir a ${p.name || p.email} del evento?`
                                );
                                if (ok) {
                                  updatePhotographerStatus(event.id, p.userId, "remove");
                                }
                              }}
                            >
                              {actionLoading[removeKey] ? "Desinscribiendo..." : "Desinscribir"}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
