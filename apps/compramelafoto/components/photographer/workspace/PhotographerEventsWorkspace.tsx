"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type EventRow = {
  id: number;
  shareSlug: string;
  title: string;
  coverUrl?: string | null;
  typeLabel?: string;
  city?: string;
  membersCount?: number | null;
  startsAt: string;
  isPast?: boolean;
  uploadsEnabled?: boolean;
  joinUrl?: string | null;
  distanceKm?: number | null;
};

type PhotographerEventsWorkspaceProps = {
  myEvents: EventRow[];
  myEventsLoading: boolean;
  eventsNearby: EventRow[];
  eventsNearbyLoading: boolean;
  eventsNearbyNoLocation: boolean;
  onRefreshMyEvents: () => Promise<void>;
  onRefreshNearby: () => Promise<void>;
};

export default function PhotographerEventsWorkspace({
  myEvents,
  myEventsLoading,
  eventsNearby,
  eventsNearbyLoading,
  eventsNearbyNoLocation,
  onRefreshMyEvents,
  onRefreshNearby,
}: PhotographerEventsWorkspaceProps) {
  const router = useRouter();
  const [leavingEventId, setLeavingEventId] = useState<number | null>(null);
  const [settingLocation, setSettingLocation] = useState(false);

  async function handleLeaveEvent(ev: { id: number; shareSlug: string }) {
    if (
      !confirm(
        "¿Desinscribirte de este evento? Si cambias de opinión podés volver a inscribirte desde el link del evento."
      )
    ) {
      return;
    }
    setLeavingEventId(ev.id);
    try {
      const res = await fetch(`/api/public/events/${ev.shareSlug}/leave`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await onRefreshMyEvents();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo desinscribir");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLeavingEventId(null);
    }
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setSettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 });
      });
      const res = await fetch("/api/fotografo/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });
      if (res.ok) {
        await onRefreshNearby();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "No se pudo guardar la ubicación.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo obtener tu ubicación.";
      alert(message);
    } finally {
      setSettingLocation(false);
    }
  }

  function handleUploadToEvent(ev: { id: number }) {
    router.push(`/dashboard/albums?fromEvent=${ev.id}`);
  }

  function formatEventDate(startsAt: string) {
    return new Date(startsAt).toLocaleString("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  }

  function renderEventCard(ev: EventRow, actions: ReactNode) {
    return (
      <li
        key={ev.id}
        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
      >
        {ev.coverUrl ? (
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
            <img src={ev.coverUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
            {ev.title}
            {ev.isPast ? (
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Vencido
              </span>
            ) : null}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {ev.typeLabel} · {ev.city}
            {ev.distanceKm != null ? ` · ${ev.distanceKm} km` : null}
            {ev.membersCount != null ? ` · ${ev.membersCount} inscrito(s)` : null}
          </p>
          <p className="text-xs text-gray-500">{formatEventDate(ev.startsAt)}</p>
          {!ev.uploadsEnabled && !ev.isPast ? (
            <p className="text-xs text-amber-700 mt-1">
              Subida de fotos: pendiente de habilitación del organizador.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">{actions}</div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Mis eventos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Eventos en los que estás inscrito. Desinscribite con al menos 24 hs de anticipación si no podés asistir.
        </p>
        {myEventsLoading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : myEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No estás inscrito en ningún evento.</p>
        ) : (
          <ul className="space-y-3">
            {myEvents.map((ev) =>
              renderEventCard(ev, (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!ev.uploadsEnabled && !ev.isPast}
                    onClick={() => handleUploadToEvent(ev)}
                  >
                    Subir fotos
                  </Button>
                  <a href={`/e/${ev.shareSlug}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" size="sm">
                      Ver evento
                    </Button>
                  </a>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleLeaveEvent(ev)}
                    disabled={leavingEventId === ev.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {leavingEventId === ev.id ? "..." : "Desinscribirme"}
                  </Button>
                </>
              ))
            )}
          </ul>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Eventos cerca (50 km)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Eventos publicados por organizadores cerca de tu ubicación. Inscribite para participar.
        </p>
        {eventsNearbyLoading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : eventsNearbyNoLocation ? (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Configurá tu ubicación para ver eventos cerca de vos.
            </p>
            <Button variant="primary" onClick={handleUseMyLocation} disabled={settingLocation}>
              {settingLocation ? "Guardando…" : "Usar mi ubicación actual"}
            </Button>
          </div>
        ) : eventsNearby.length === 0 ? (
          <p className="text-sm text-gray-500">No hay eventos a menos de 50 km por ahora.</p>
        ) : (
          <ul className="space-y-3">
            {eventsNearby.map((ev) =>
              renderEventCard(
                ev,
                ev.joinUrl ? (
                  <a href={ev.joinUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary">
                      Ver e inscribirme
                    </Button>
                  </a>
                ) : null
              )
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
