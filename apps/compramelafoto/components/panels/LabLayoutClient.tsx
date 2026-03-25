"use client";

import { Suspense, useState, useEffect } from "react";
import PanelLayout from "./PanelLayout";
import LabSidebar, { LabSidebarTopBar } from "./LabSidebar";
import { ensureLabSession } from "@/lib/lab-session-client";

const fallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <p className="text-[#6b7280]">Cargando...</p>
  </div>
);

export default function LabLayoutClient({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFetched, setLogoFetched] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = await ensureLabSession();
      if (!active || !session?.labId) {
        if (active) setLogoFetched(true);
        return;
      }
      try {
        const res = await fetch(`/api/lab/${session.labId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setLogoUrl(data?.logoUrl ?? null);
            setLogoFetched(true);
          }
        } else {
          if (active) setLogoFetched(true);
        }
      } catch {
        if (active) setLogoFetched(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Suspense fallback={fallback}>
      <PanelLayout
        topBar2={<LabSidebarTopBar logoUrl={logoUrl} logoFetched={logoFetched} />}
        sidebar={<LabSidebar showHeader={false} />}
      >
        {children}
      </PanelLayout>
    </Suspense>
  );
}
