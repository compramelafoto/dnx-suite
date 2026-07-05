"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import PhotographerEventsWorkspace from "@/components/photographer/workspace/PhotographerEventsWorkspace";
import PhotographerWorkspacePageHeader from "@/components/photographer/workspace/PhotographerWorkspacePageHeader";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function FotografoEventosPage() {
  const router = useRouter();
  const [photographer, setPhotographer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [myEventsLoading, setMyEventsLoading] = useState(false);
  const [eventsNearby, setEventsNearby] = useState<any[]>([]);
  const [eventsNearbyLoading, setEventsNearbyLoading] = useState(false);
  const [eventsNearbyNoLocation, setEventsNearbyNoLocation] = useState(false);

  const loadMyEvents = useCallback(async () => {
    setMyEventsLoading(true);
    try {
      const res = await fetch("/api/fotografo/events-mine", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data)) {
        setMyEvents(data);
      } else {
        setMyEvents([]);
      }
    } catch {
      setMyEvents([]);
    } finally {
      setMyEventsLoading(false);
    }
  }, []);

  const loadEventsNearby = useCallback(async () => {
    setEventsNearbyLoading(true);
    try {
      const res = await fetch("/api/fotografo/events-nearby", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEventsNearby(Array.isArray(data.events) ? data.events : []);
        setEventsNearbyNoLocation(!!data.noLocation);
      } else {
        setEventsNearby([]);
        setEventsNearbyNoLocation(false);
      }
    } catch {
      setEventsNearby([]);
      setEventsNearbyNoLocation(false);
    } finally {
      setEventsNearbyLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }

      fetch(`/api/fotografo/${session.photographerId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && data) setPhotographer(data);
        })
        .catch(() => {});

      await Promise.all([loadMyEvents(), loadEventsNearby()]);
      if (active) setLoading(false);
    }
    init();
    return () => {
      active = false;
    };
  }, [router, loadMyEvents, loadEventsNearby]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-6 md:py-8">
        <DsDashboardInner>
          <PhotographerWorkspacePageHeader
            title="Eventos colaborativos"
            subtitle="Convocatorias de organizadores: inscripciones, subida de fotos y oportunidades cerca tuyo."
          />
          <PhotographerEventsWorkspace
            myEvents={myEvents}
            myEventsLoading={myEventsLoading}
            eventsNearby={eventsNearby}
            eventsNearbyLoading={eventsNearbyLoading}
            eventsNearbyNoLocation={eventsNearbyNoLocation}
            onRefreshMyEvents={loadMyEvents}
            onRefreshNearby={loadEventsNearby}
          />
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
