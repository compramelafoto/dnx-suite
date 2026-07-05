"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import PhotographerHomeWorkspace from "@/components/photographer/workspace/PhotographerHomeWorkspace";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function PhotographerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [photographer, setPhotographer] = useState<any>(null);
  const [pendingRemovalCount, setPendingRemovalCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [myEventsCount, setMyEventsCount] = useState(0);
  const [mpConnected, setMpConnected] = useState(false);
  const [preferredLabSet, setPreferredLabSet] = useState(false);

  useEffect(() => {
    let active = true;
    async function init() {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get("user");
      if (userParam) {
        try {
          const userData = JSON.parse(userParam);
          if (userData.role === "PHOTOGRAPHER" || userData.role === "LAB_PHOTOGRAPHER") {
            sessionStorage.setItem("photographer", JSON.stringify(userData));
            sessionStorage.setItem("photographerId", userData.id.toString());
            window.history.replaceState({}, "", "/fotografo/dashboard");
          }
        } catch (e) {
          console.error("Error procesando datos de Google OAuth:", e);
        }
      }

      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }

      const photographerId = session.photographerId;

      fetch(`/api/fotografo/${photographerId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && data) setPhotographer(data);
        })
        .catch(() => {});

      fetch("/api/fotografo/dashboard", { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            router.push("/fotografo/login");
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (active && data) setStats(data.stats ?? null);
        })
        .catch(() => {
          router.push("/fotografo/login");
        });

      fetch("/api/dashboard/photographer", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!active || !data) return;
          setMpConnected(Boolean(data.mpConnected));
          setPreferredLabSet(Boolean(data.preferredLabId));
        })
        .catch(() => {});

      const removalParams = new URLSearchParams({
        photographerId: photographerId.toString(),
        status: "PENDING",
      });
      fetch(`/api/dashboard/removal-requests?${removalParams}`)
        .then((res) => res.json())
        .then((data) => {
          if (active && Array.isArray(data)) setPendingRemovalCount(data.length);
        })
        .catch(() => {});

      fetch("/api/fotografo/pedidos", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          const list = Array.isArray(data) ? data : (data?.rows ?? []);
          const needsAttention = list.filter(
            (o: { status?: string; paymentStatus?: string }) =>
              o.status === "PENDING" || o.status === "READY" || o.paymentStatus === "PAID"
          );
          setPendingOrdersCount(needsAttention.length);
        })
        .catch(() => {});

      fetch("/api/fotografo/events-mine", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (active && Array.isArray(data)) {
            setMyEventsCount(data.filter((ev: { isPast?: boolean }) => !ev.isPast).length);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    init();
    return () => {
      active = false;
    };
  }, [router]);

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
          <PhotographerHomeWorkspace
            stats={stats}
            photographer={photographer}
            pendingRemovalCount={pendingRemovalCount}
            pendingOrdersCount={pendingOrdersCount}
            myEventsCount={myEventsCount}
            mpConnected={mpConnected}
            preferredLabSet={preferredLabSet}
          />
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
