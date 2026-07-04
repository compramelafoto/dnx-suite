"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import { ensureOrganizerSession } from "@/lib/organizer-session-client";

const EVENT_TYPE_LABELS: Record<string, string> = {
  PUBLIC_SESSION: "Sesión pública",
  PRIVATE_SESSION: "Sesión privada",
  SPORTS: "Evento deportivo",
  PUBLIC_PHOTOGRAPHY: "Fotografías públicas",
  THEMATIC_SESSIONS: "Sesiones temáticas",
  COMMERCIAL_SESSIONS: "Sesiones comerciales",
  SCHOOL: "Eventos escolares",
  RELIGIOUS: "Eventos religiosos",
  FESTIVAL: "Festival / Fiesta popular",
  CONFERENCE: "Conferencia / Charla",
  CONCERT: "Recital / Concierto",
  CORPORATE: "Corporativo",
  OTHER: "Otro",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  GRADUATION: "Graduación",
};

type EventItem = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: string;
  endsAt: string | null;
  city: string;
  maxPhotographers: number | null;
  coverUrl: string | null;
  shareSlug: string | null;
  albumsCount: number;
  membersCount: number;
  createdAt: string;
};

export default function OrganizadorDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ organizerId: number; name?: string | null; email?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const s = await ensureOrganizerSession();
      if (!active) return;
      if (!s) {
        router.push("/login");
        return;
      }
      setSession(s);
      try {
        const res = await fetch("/api/organizer/events", { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          setError("Error al cargar eventos");
          return;
        }
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleShare(ev: EventItem) {
    let slug = ev.shareSlug;
    if (!slug) {
      setCopyingId(ev.id);
      try {
        const res = await fetch(`/api/organizer/events/${ev.id}`);
        if (!res.ok) return;
        const data = await res.json();
        slug = data.shareSlug ?? null;
        if (slug) setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, shareSlug: slug } : e)));
      } finally {
        setCopyingId(null);
      }
    }
    if (!slug) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleDelete(ev: EventItem) {
    if (!confirm(`¿Eliminar el evento "${ev.title}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(ev.id);
    try {
      const res = await fetch(`/api/organizer/events/${ev.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Error al eliminar");
        return;
      }
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } finally {
      setDeletingId(null);
    }
  }

  if (!session && !loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name, email: session.email } : null} />
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 box-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mis eventos</h1>
          <Link href="/organizador/events/new">
            <Button variant="primary">Crear evento</Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : events.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-4">Aún no tenés eventos creados.</p>
            <Link href="/organizador/events/new">
              <Button variant="primary">Crear tu primer evento</Button>
            </Link>
          </Card>
        ) : (
          <ul className="space-y-4">
            {events.map((ev) => (
              <li key={ev.id}>
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex gap-3 min-w-0 flex-1">
                      {ev.coverUrl && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                          <img src={ev.coverUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="font-semibold text-gray-900">{ev.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {EVENT_TYPE_LABELS[ev.type] || ev.type} · {ev.city} ·{" "}
                        {new Date(ev.startsAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {ev.albumsCount} álbum(s) · {ev.membersCount} miembro(s)
                        {ev.maxPhotographers != null && ` · Cupo: ${ev.maxPhotographers} fotógrafos`}
                      </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleShare(ev)}
                        disabled={copyingId === ev.id}
                        title="Compartir"
                        className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        {copyingId === ev.id ? (
                          <span className="w-5 h-5 block border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        )}
                      </button>
                      <Link href={`/organizador/events/${ev.id}`} title="Ver y editar">
                        <span className="inline-flex p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(ev)}
                        disabled={deletingId === ev.id}
                        title="Eliminar"
                        className="p-2 rounded-lg border border-gray-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === ev.id ? (
                          <span className="w-5 h-5 block border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
