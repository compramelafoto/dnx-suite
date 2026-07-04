"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import EventInvitePhotographers, { type PhotographerOption } from "@/components/organizer/EventInvitePhotographers";
import { ensureOrganizerSession } from "@/lib/organizer-session-client";

const EventLocationMap = dynamic(
  () => import("@/components/organizer/EventLocationMap"),
  { ssr: false, loading: () => <div className="rounded-lg bg-gray-200 h-[280px] flex items-center justify-center text-gray-500 text-sm">Cargando mapa…</div> }
);
const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch"),
  { ssr: false }
);

function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

const EVENT_TYPES = [
  { value: "PUBLIC_SESSION", label: "Sesión pública" },
  { value: "PRIVATE_SESSION", label: "Sesión privada" },
  { value: "SPORTS", label: "Evento deportivo" },
  { value: "PUBLIC_PHOTOGRAPHY", label: "Fotografías públicas" },
  { value: "THEMATIC_SESSIONS", label: "Sesiones temáticas" },
  { value: "COMMERCIAL_SESSIONS", label: "Sesiones comerciales" },
  { value: "SCHOOL", label: "Eventos escolares" },
  { value: "RELIGIOUS", label: "Eventos religiosos" },
  { value: "FESTIVAL", label: "Festival / Fiesta popular" },
  { value: "CONFERENCE", label: "Conferencia / Charla" },
  { value: "CONCERT", label: "Recital / Concierto" },
  { value: "CORPORATE", label: "Corporativo" },
  { value: "OTHER", label: "Otro" },
  { value: "WEDDING", label: "Boda (legacy)" },
  { value: "BIRTHDAY", label: "Cumpleaños (legacy)" },
  { value: "GRADUATION", label: "Graduación (legacy)" },
];

type InvitedPhotographer = {
  userId: number;
  name: string | null;
  email: string;
  companyName: string | null;
  phone: string | null;
};

type EventData = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  city: string;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  expectedAttendees: number | null;
  accreditationNotes: string | null;
  shareSlug: string | null;
  coverImageKey: string | null;
  coverUrl: string | null;
  albumsCount: number;
  membersCount: number;
  invitedPhotographers?: InvitedPhotographer[];
};

type AlbumItem = {
  id: number;
  title: string;
  publicSlug: string;
  maxDownloadAllowed: number | null;
  photosCount: number;
  user: { id: number; name: string | null; email: string | null };
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const eventId = parseInt(id, 10);

  const [session, setSession] = useState<{ organizerId: number; name?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [event, setEvent] = useState<EventData | null>(null);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accreditationNotes, setAccreditationNotes] = useState("");
  const [type, setType] = useState("OTHER");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [city, setCity] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [maxPhotographers, setMaxPhotographers] = useState("");
  const [expectedAttendees, setExpectedAttendees] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitedPhotographers, setInvitedPhotographers] = useState<PhotographerOption[]>([]);
  const [albumMaxDownloads, setAlbumMaxDownloads] = useState<Record<number, string>>({});
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    if (event?.shareSlug && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/e/${event.shareSlug}`);
    }
  }, [event?.shareSlug]);

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
      if (!Number.isFinite(eventId)) {
        setError("Evento no encontrado");
        setLoading(false);
        return;
      }
      try {
        const [resEvent, resAlbums] = await Promise.all([
          fetch(`/api/organizer/events/${eventId}`, { credentials: "include" }),
          fetch(`/api/organizer/events/${eventId}/albums`, { credentials: "include" }),
        ]);
        if (!resEvent.ok) {
          if (resEvent.status === 401) {
            router.push("/login");
            return;
          }
          setError("Evento no encontrado");
          setLoading(false);
          return;
        }
        const eventData = await resEvent.json();
        setEvent(eventData);
        setTitle(eventData.title);
        setDescription(eventData.description || "");
        setAccreditationNotes(eventData.accreditationNotes || "");
        setType(eventData.type);
        setStartsAt(eventData.startsAt ? formatDateTimeLocal(eventData.startsAt) : "");
        setEndsAt(eventData.endsAt ? formatDateTimeLocal(eventData.endsAt) : "");
        setCity(eventData.city || "");
        setLocationName(eventData.locationName || "");
        setLatitude(String(eventData.latitude ?? ""));
        setLongitude(String(eventData.longitude ?? ""));
        setMaxPhotographers(eventData.maxPhotographers != null ? String(eventData.maxPhotographers) : "");
        setExpectedAttendees(eventData.expectedAttendees != null ? String(eventData.expectedAttendees) : "");
        setIsPrivate(eventData.visibility === "PRIVATE" || eventData.joinPolicy === "INVITE_ONLY");
        const inv = eventData.invitedPhotographers ?? [];
        setInvitedPhotographers(
          inv.map((p: InvitedPhotographer) => ({
            id: p.userId,
            name: p.name ?? undefined,
            email: p.email,
            companyName: p.companyName ?? undefined,
            phone: p.phone ?? undefined,
          }))
        );

        const albumsData = resAlbums.ok ? await resAlbums.json() : [];
        setAlbums(Array.isArray(albumsData) ? albumsData : []);
        const next: Record<number, string> = {};
        (Array.isArray(albumsData) ? albumsData : []).forEach((a: AlbumItem) => {
          next[a.id] = a.maxDownloadAllowed != null ? String(a.maxDownloadAllowed) : "";
        });
        setAlbumMaxDownloads(next);
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
  }, [router, eventId]);

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          accreditationNotes: accreditationNotes.trim() || null,
          type,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          city: city.trim(),
          locationName: locationName.trim() || null,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          visibility: isPrivate ? "PRIVATE" : "PUBLIC",
          joinPolicy: isPrivate ? "INVITE_ONLY" : "OPEN",
          maxPhotographers: maxPhotographers ? parseInt(maxPhotographers, 10) : null,
          expectedAttendees: expectedAttendees ? parseInt(expectedAttendees, 10) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        setSaving(false);
        return;
      }
      const userIds = isPrivate ? invitedPhotographers.map((p) => p.id) : [];
      const resInv = await fetch(`/api/organizer/events/${eventId}/invitations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds }),
      });
      if (!resInv.ok) {
        const invData = await resInv.json().catch(() => ({}));
        setError(invData.error || "Evento guardado pero falló actualizar invitados");
      }
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              ...data,
              visibility: isPrivate ? "PRIVATE" : "PUBLIC",
              joinPolicy: isPrivate ? "INVITE_ONLY" : "OPEN",
              invitedPhotographers: invitedPhotographers.map((p) => ({
                userId: p.id,
                name: p.name ?? null,
                email: p.email,
                companyName: p.companyName ?? null,
                phone: p.phone ?? null,
              })),
            }
          : null
      );
      setMessage("Evento actualizado.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  }

  async function handleSaveAlbumMaxDownload(albumId: number) {
    const value = albumMaxDownloads[albumId];
    const num = value === "" || value == null ? null : parseInt(String(value), 10);
    try {
      const res = await fetch(`/api/organizer/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ maxDownloadAllowed: num }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al guardar");
        return;
      }
      setAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, maxDownloadAllowed: num } : a))
      );
      setMessage("Límite de descargas actualizado.");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setError("Error de conexión");
    }
  }

  async function handleInvite() {
    setError(null);
    setInviting(true);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/invite`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al enviar invitaciones");
        setInviting(false);
        return;
      }
      setMessage(data.message || `Se enviaron ${data.invited} invitación(es).`);
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setError("Error de conexión");
    }
    setInviting(false);
  }

  if (!session && !loading) return null;
  if (loading || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name } : null} />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
          {loading ? "Cargando..." : "Evento no encontrado"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name } : null} />
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 box-border">
        <Link href="/organizador/dashboard" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block">
          ← Volver al panel
        </Link>

        {event.coverUrl && (
          <div className="w-full -mx-4 sm:-mx-6 mt-0 mb-6 aspect-[2/1] max-h-[320px] bg-gray-200 overflow-hidden rounded-xl">
            <img src={event.coverUrl} alt="Portada del evento" className="w-full h-full object-cover object-center" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-6">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm mb-6">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <Button
            variant="primary"
            onClick={handleInvite}
            disabled={inviting}
          >
            {inviting ? "Enviando..." : "Invitar fotógrafos por cercanía (50 km)"}
          </Button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Se enviará un email y una notificación en el panel a los fotógrafos a menos de 50 km del evento (o de la misma ciudad si no tienen ubicación configurada), con la descripción del evento, instrucciones de acreditación y cupo máximo.
        </p>

        {event.shareSlug && (
          <Card className="p-6 mb-6 w-full min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Compartir por link</h2>
            <p className="text-sm text-gray-500 mb-3">
              Compartí este link con fotógrafos para que puedan ver el evento e inscribirse.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 text-sm bg-gray-100 px-3 py-2 rounded-lg truncate">
                {shareUrl || `/e/${event.shareSlug}`}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = shareUrl || (typeof window !== "undefined" ? `${window.location.origin}/e/${event.shareSlug}` : "");
                  if (!url) return;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopyLinkDone(true);
                    setTimeout(() => setCopyLinkDone(false), 2000);
                  });
                }}
              >
                {copyLinkDone ? "Copiado" : "Copiar link"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-6 mb-8 w-full min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Foto de portada</h2>
          <p className="text-sm text-gray-500 mb-4">
            La portada se muestra arriba de todo en la página pública del evento como encabezado cuando alguien abre el link de invitación.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError(null);
                setUploadingCover(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  const res = await fetch(`/api/organizer/events/${eventId}/cover`, {
                    method: "POST",
                    credentials: "include",
                    body: form,
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(data.error || "Error subiendo portada");
                    return;
                  }
                  setEvent((prev) =>
                    prev
                      ? {
                          ...prev,
                          coverImageKey: data.coverImageKey ?? prev.coverImageKey,
                          coverUrl: data.coverUrl ?? prev.coverUrl,
                        }
                      : null
                  );
                  setMessage("Portada actualizada.");
                  setTimeout(() => setMessage(null), 3000);
                } catch {
                  setError("Error de conexión");
                } finally {
                  setUploadingCover(false);
                  e.target.value = "";
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
            >
              {uploadingCover ? "Subiendo..." : "Elegir imagen"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 mb-8 w-full min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Editar evento</h2>
          <form onSubmit={handleSaveEvent} className="space-y-4 w-full min-w-0">
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full max-w-full box-border" />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del evento</label>
              <textarea
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones para acreditarse</label>
              <textarea
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                rows={2}
                value={accreditationNotes}
                onChange={(e) => setAccreditationNotes(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">¿Evento público o privado?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Público</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Privado</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                En eventos privados solo los fotógrafos que invites podrán ver e inscribirse.
              </p>
            </div>
            {isPrivate && (
              <div className="w-full min-w-0 p-4 rounded-lg border border-gray-200 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">Fotógrafos a invitar</p>
                <EventInvitePhotographers
                  value={invitedPhotographers}
                  onChange={setInvitedPhotographers}
                  disabled={saving}
                />
              </div>
            )}
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cupo máximo de fotógrafos</label>
              <Input
                type="number"
                min="1"
                value={maxPhotographers}
                onChange={(e) => setMaxPhotographers(e.target.value)}
                className="w-full max-w-full box-border"
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Asistentes aproximados (opcional)</label>
              <Input
                type="number"
                min="1"
                value={expectedAttendees}
                onChange={(e) => setExpectedAttendees(e.target.value)}
                placeholder="Ej: 500, 5000"
                className="w-full max-w-full box-border"
              />
              <p className="text-xs text-gray-500 mt-1">Para que el fotógrafo sepa si es un evento multitudinario o más íntimo.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full max-w-full box-border" />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin (opcional)</label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full max-w-full box-border" />
              </div>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en el mapa</label>
              <p className="text-xs text-gray-500 mb-2">Escribí el nombre del lugar y elegí de la lista, o hacé clic en el mapa / arrastrá el marcador; las coordenadas y el lugar se completan solos.</p>
              {(latitude && longitude && (parseFloat(latitude) !== 0 || parseFloat(longitude) !== 0)) && locationName && (
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lugar</label>
                  <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{locationName}</p>
                </div>
              )}
              <div className="mb-3">
                <EventLocationSearch
                  placeholder="Ej: Teatro Colón, Estadio Monumental"
                  onSelect={(lat, lon, displayName) => {
                    setLatitude(String(lat));
                    setLongitude(String(lon));
                    if (displayName) {
                      setLocationName(displayName);
                      const parts = displayName.split(",").map((s) => s.trim()).filter(Boolean);
                      if (parts.length >= 2) setCity(parts[1]);
                      else if (parts.length === 1) setCity(parts[0]);
                    }
                  }}
                />
              </div>
              <EventLocationMap
                latitude={latitude ? parseFloat(latitude) : 0}
                longitude={longitude ? parseFloat(longitude) : 0}
                editable
                onPositionChange={async (lat, lng) => {
                  setLatitude(String(lat));
                  setLongitude(String(lng));
                  try {
                    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}`);
                    if (res.ok) {
                      const data = await res.json();
                      if (data.display_name) setLocationName(data.display_name);
                      if (data.city) setCity(data.city);
                    }
                  } catch {
                    // ignorar error de reverse geocode
                  }
                }}
                height="280px"
              />
            </div>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 w-full min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Álbumes del evento</h2>
          <p className="text-sm text-gray-500 mb-4">
            Los fotógrafos que se unan al evento pueden crear álbumes vinculados. Acá podés fijar la cantidad máxima de fotos permitidas para descarga por álbum.
          </p>
          {albums.length === 0 ? (
            <p className="text-gray-500">Aún no hay álbumes vinculados a este evento.</p>
          ) : (
            <ul className="space-y-4">
              {albums.map((album) => (
                <li key={album.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{album.title}</p>
                    <p className="text-xs text-gray-500">
                      /{album.publicSlug} · {album.photosCount} fotos · {album.user?.name || album.user?.email || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-sm text-gray-600">Máx. descargas:</label>
                    <Input
                      type="number"
                      min="0"
                      className="w-20"
                      value={albumMaxDownloads[album.id] ?? ""}
                      onChange={(e) =>
                        setAlbumMaxDownloads((prev) => ({ ...prev, [album.id]: e.target.value }))
                      }
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSaveAlbumMaxDownload(album.id)}
                    >
                      Guardar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
