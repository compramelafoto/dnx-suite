"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

type Item = {
  agencyId: number; name: string; status: "ACTIVE" | "REQUESTED"; commissionLabel: string; needsTerms: boolean;
  terms: string; albums: Array<{ albumId: number; title: string; publicSlug: string }>; myPhotosCount: number;
};

const HELP = AGENCY_SECTIONS.find((s) => s.id === "mis-agencias")!.help;

export default function MisAgenciasPage() {
  const [data, setData] = useState<{ mpConnected: boolean; agencies: Item[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/fotografo/agencias/mis-agencias", { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setData(d);
    else setError(d.error || "No pudimos cargar tus agencias.");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <AgencyPageFrame title="Mis agencias" subtitle={HELP}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="space-y-6">
          <Card className="space-y-2">
            <h2 className="text-lg font-medium">Mercado Pago</h2>
            <p className="text-sm text-[#6b7280]">
              {data.mpConnected
                ? "Tu Mercado Pago está conectado. Ahí te va a llegar tu parte de cada venta."
                : "Conectá tu Mercado Pago para cobrar tu parte de cada venta directo en tu cuenta."}
            </p>
            <Link href="/fotografo/configuracion?tab=mercadopago">
              <Button size="sm" variant={data.mpConnected ? "outline" : "primary"}>
                {data.mpConnected ? "Ver mi conexión" : "Conectar Mercado Pago"}
              </Button>
            </Link>
          </Card>

          {data.agencies.length === 0 && (
            <Card className="space-y-2">
              <p>Todavía no trabajás para ninguna agencia.</p>
              <Link className="text-sm underline" href="/fotografo/agencias/directorio">Buscar agencias cerca tuyo</Link>
            </Card>
          )}

          {data.agencies.map((a) => (
            <Card key={a.agencyId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{a.name}</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                  {a.status === "ACTIVE" ? `En el equipo · cobrás ${a.commissionLabel}` : "Solicitud enviada, esperando respuesta"}
                </span>
              </div>
              {a.status === "ACTIVE" && (
                <>
                  <p className="text-sm text-[#6b7280]">Fotos tuyas subidas: {a.myPhotosCount}</p>
                  {a.albums.length > 0 && (
                    <ul className="text-sm">
                      {a.albums.map((al) => (
                        <li key={al.publicSlug}>
                          <a className="underline" href={`/album/${al.publicSlug}`} target="_blank" rel="noreferrer">{al.title}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`/fotografo/agencias/mis-agencias/${a.agencyId}/subir`}>
                    <Button size="sm">Subir fotos</Button>
                  </Link>
                  <p className="text-xs text-[#6b7280]">La subida desde la cámara (FTP) y desde DNX FLUX, y el detalle de lo cobrado, llegan en las próximas etapas.</p>
                </>
              )}
              {a.needsTerms && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium">La agencia cambió sus condiciones. Aceptalas para seguir subiendo fotos.</p>
                  <pre className="whitespace-pre-wrap text-xs">{a.terms}</pre>
                  <Button size="sm" onClick={async () => {
                    const res = await fetch(`/api/fotografo/agencias/mis-agencias/${a.agencyId}/condiciones`, {
                      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ acceptTerms: true }),
                    });
                    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "No se pudo guardar.");
                    load();
                  }}>Acepto las condiciones</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AgencyPageFrame>
  );
}
