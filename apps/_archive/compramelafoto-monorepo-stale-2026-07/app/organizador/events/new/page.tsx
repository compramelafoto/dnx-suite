"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
];

export default function NewEventPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ organizerId: number; name?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accreditationNotes, setAccreditationNotes] = useState("");
  const [type, setType] = useState("PUBLIC_SESSION");
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
      setLoading(false);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const lat = latitude ? parseFloat(latitude) : 0;
      const lng = longitude ? parseFloat(longitude) : 0;
      if (!title.trim()) {
        setError("El título es requerido");
        setSaving(false);
        return;
      }
      if (!city.trim()) {
        setError("La ciudad es requerida");
        setSaving(false);
        return;
      }
      if (!startsAt) {
        setError("La fecha de inicio es requerida");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          accreditationNotes: accreditationNotes.trim() || null,
          type,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          city: city.trim(),
          locationName: locationName.trim() || null,
          latitude: isNaN(lat) ? 0 : lat,
          longitude: isNaN(lng) ? 0 : lng,
          maxPhotographers: maxPhotographers ? parseInt(maxPhotographers, 10) : null,
          expectedAttendees: expectedAttendees ? parseInt(expectedAttendees, 10) : null,
          visibility: isPrivate ? "PRIVATE" : "PUBLIC",
          joinPolicy: isPrivate ? "INVITE_ONLY" : "OPEN",
          invitedUserIds: isPrivate ? invitedPhotographers.map((p) => p.id) : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al crear el evento");
        setSaving(false);
        return;
      }
      router.push(`/organizador/events/${data.id}`);
    } catch {
      setError("Error de conexión");
      setSaving(false);
    }
  }

  if (!session && !loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name } : null} />
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 box-border">
        <Link href="/organizador/dashboard" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block">
          ← Volver al panel
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Crear evento</h1>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-6">
            {error}
          </div>
        )}

        <Card className="p-6 w-full min-w-0">
          <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Maratón Ciudad 2025"
                required
                className="w-full max-w-full box-border"
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del evento</label>
              <textarea
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contale a los fotógrafos de qué se trata el evento para que sepan si quieren sumarse."
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones para acreditarse</label>
              <textarea
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                rows={2}
                value={accreditationNotes}
                onChange={(e) => setAccreditationNotes(e.target.value)}
                placeholder="Ej: Registrarse en el stand de prensa, enviar mail a prensa@evento.com..."
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Cupo máximo de fotógrafos (opcional)</label>
              <Input
                type="number"
                min="1"
                value={maxPhotographers}
                onChange={(e) => setMaxPhotographers(e.target.value)}
                placeholder="Ej: 10"
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
              <p className="text-xs text-gray-500 mt-1">Sirve para que el fotógrafo sepa si es un evento multitudinario o más íntimo.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de inicio *</label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className="w-full max-w-full box-border"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de fin (opcional)</label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full max-w-full box-border"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Ubicación: escribí el nombre del lugar y elegí de la lista, o hacé clic en el mapa / arrastrá el marcador; las coordenadas y el lugar se completan solos.
            </p>
            {(latitude && longitude && (parseFloat(latitude) !== 0 || parseFloat(longitude) !== 0)) && locationName && (
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Lugar</label>
                <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{locationName}</p>
              </div>
            )}
            <div className="w-full min-w-0 mb-3">
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
            <div className="w-full min-w-0 mb-4">
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
            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Creando..." : "Crear evento"}
              </Button>
              <Link href="/organizador/dashboard">
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
