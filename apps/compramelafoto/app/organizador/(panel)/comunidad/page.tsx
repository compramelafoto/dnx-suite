"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import OrganizerCommunityDiscoveryPanel from "@/components/organizer/OrganizerCommunityDiscoveryPanel";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import type { OrganizerPrivateCommunityDiscovery } from "@/lib/organizer-community-discovery";

export default function OrganizadorComunidadPage() {
  const router = useRouter();
  const [organizer, setOrganizer] = useState<{
    organizerId: number;
    name?: string | null;
    email?: string | null;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [discovery, setDiscovery] = useState<OrganizerPrivateCommunityDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/organizer/me", { credentials: "include" });
        if (!res.ok && res.status === 401) {
          router.push("/");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setOrganizer({
              organizerId: data.id ?? 0,
              name: data.name,
              email: data.email,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch("/api/organizer/community/discovery", { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "No se pudo cargar la comunidad");
        }
        return body as OrganizerPrivateCommunityDiscovery;
      })
      .then((data) => {
        if (active) setDiscovery(data);
      })
      .catch((e: unknown) => {
        if (active) {
          setDiscovery(null);
          setError(e instanceof Error ? e.message : "Error de conexión");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <OrganizerHeader organizer={organizer} />
        <DsPageShell className="py-6 md:py-8 flex-1">
          <DsDashboardInner>
            <p className="text-gray-600 text-sm m-0">Cargando…</p>
          </DsDashboardInner>
        </DsPageShell>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader organizer={organizer} />
      <DsPageShell className="py-6 md:py-8 flex-1">
        <DsDashboardInner className="ds-stack-section min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Comunidad</h1>
            <p className="ds-readable-text ds-readable-text--fluid text-gray-600 m-0 text-sm">
              Fotógrafos disponibles para futuras convocatorias. Esta información es privada y no aparece en
              tu página pública.
            </p>
          </div>

          <OrganizerCommunityDiscoveryPanel data={discovery} loading={loading} error={error} />
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}

