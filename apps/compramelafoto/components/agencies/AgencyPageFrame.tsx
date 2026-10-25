"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import PhotographerWorkspacePageHeader from "@/components/photographer/workspace/PhotographerWorkspacePageHeader";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function AgencyPageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const router = useRouter();
  const [photographer, setPhotographer] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    ensurePhotographerSession().then((session) => {
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => active && d && setPhotographer(d))
        .catch(() => {});
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-6 md:py-8">
        <DsDashboardInner>
          <PhotographerWorkspacePageHeader title={title} subtitle={subtitle} />
          {ready ? children : <p className="text-gray-600">Cargando...</p>}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
