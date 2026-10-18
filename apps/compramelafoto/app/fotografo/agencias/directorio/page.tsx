"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

type Row = {
  agencyId: number; name: string; description: string | null; city: string | null; distanceKm: number | null;
  commissionLabel: string; myStatus: "ACTIVE" | "REQUESTED" | null;
};

const HELP = AGENCY_SECTIONS.find((s) => s.id === "directorio")!.help;

function RequestBox({ agencyId, onDone }: { agencyId: number; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <textarea className="w-full rounded-xl border p-2 text-sm" rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="Contales quién sos, qué equipo tenés, si tu cámara tiene FTP…" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        Acepto las condiciones de la agencia (las vas a ver completas si te aceptan).
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button size="sm" disabled={!accept} onClick={async () => {
        const res = await fetch("/api/fotografo/agencias/directorio", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencyId, message, acceptTerms: true }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error || "No se pudo enviar.");
        else onDone();
      }}>Enviar solicitud</Button>
    </div>
  );
}

export default function DirectorioPage() {
  const [data, setData] = useState<{ noLocation: boolean; agencies: Row[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/fotografo/agencias/directorio", { credentials: "include" });
    setData(await res.json().catch(() => ({ noLocation: false, agencies: [] })));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <AgencyPageFrame title="Directorio de agencias" subtitle={HELP}>
      {data?.noLocation && (
        <Card className="mb-4 text-sm">
          Para ordenar las agencias por cercanía, cargá tu ubicación en{" "}
          <Link className="underline" href="/fotografo/configuracion?tab=datos">tu perfil</Link>.
        </Card>
      )}
      {data && data.agencies.length === 0 && <Card>Todavía no hay agencias en el directorio cerca tuyo.</Card>}
      <div className="space-y-3">
        {data?.agencies.map((a) => (
          <Card key={a.agencyId} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">{a.name}</h2>
                <p className="text-xs text-[#6b7280]">
                  {[a.city, a.distanceKm !== null ? `a ${a.distanceKm} km` : null, `paga ${a.commissionLabel} por venta`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {a.myStatus === "ACTIVE" && <span className="text-sm">Ya estás en el equipo</span>}
              {a.myStatus === "REQUESTED" && <span className="text-sm">Solicitud enviada</span>}
              {a.myStatus === null && open !== a.agencyId && (
                <Button size="sm" onClick={() => setOpen(a.agencyId)}>Pedir sumarme</Button>
              )}
            </div>
            {a.description && <p className="text-sm text-[#6b7280]">{a.description}</p>}
            {open === a.agencyId && <RequestBox agencyId={a.agencyId} onDone={() => { setOpen(null); load(); }} />}
          </Card>
        ))}
      </div>
    </AgencyPageFrame>
  );
}
