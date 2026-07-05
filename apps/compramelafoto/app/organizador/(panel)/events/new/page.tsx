"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import OrganizerNewEventWizard from "@/components/organizer/OrganizerNewEventWizard";
import { ensureOrganizerSession } from "@/lib/organizer-session-client";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";

export default function NewEventPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ organizerId: number; name?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (!session && !loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name } : null} />
      <DsPageShell className="py-6 md:py-8 flex-1">
        <DsDashboardInner className="flex flex-col gap-6 min-w-0">
          <Link href="/organizador/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            ← Volver al panel
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Crear evento</h1>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 mt-2">
              Asistente paso a paso. Conserva el mismo guardado por API que antes.
            </p>
          </div>
          {loading ? <p className="text-gray-600 text-sm">Cargando…</p> : <OrganizerNewEventWizard />}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
