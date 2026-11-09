"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import AgencyUploadPanel from "@/components/agencies/AgencyUploadPanel";

type Album = { albumId: number; title: string; publicSlug: string };
type Place = { id: number; name: string; lat: number; lng: number };

/** El miembro sube desde su sesión al álbum de la agencia: las fotos quedan a su nombre. */
export default function SubirFotosAgenciaPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const [agency, setAgency] = useState<{ name: string; albums: Album[] } | null>(null);
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/fotografo/agencias/mis-agencias", { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setLoadError(d.error || "No pudimos cargar tus agencias.");
      const a = (d.agencies ?? []).find((x: any) => String(x.agencyId) === String(agencyId) && x.status === "ACTIVE");
      if (!a) return setLoadError("No sos parte del equipo de esta agencia.");
      setMpConnected(Boolean(d.mpConnected));
      setAgency({ name: a.name, albums: a.albums });
      const pr = await fetch(`/api/fotografo/agencias/mis-agencias/${agencyId}/lugares`, { credentials: "include" });
      const pd = await pr.json().catch(() => ({ places: [] }));
      if (pr.ok) setPlaces(pd.places ?? []);
    })().catch(() => setLoadError("No pudimos cargar tus agencias."));
  }, [agencyId]);

  return (
    <AgencyPageFrame title="Subir fotos" subtitle="Subí tus fotos al álbum de la agencia. Quedan a tu nombre. Si tu cámara no tiene GPS, elegí dónde las sacaste.">
      {loadError && <Card>{loadError}</Card>}
      {!agency && !loadError && <Card>Cargando…</Card>}
      {agency && (
        <Card className="space-y-5">
          <h2 className="text-lg font-medium">{agency.name}</h2>
          <AgencyUploadPanel
            agencyId={Number(agencyId)}
            albums={agency.albums}
            places={places}
            blockedReason={
              mpConnected === false ? (
                <>
                  Para subir fotos tenés que tener tu Mercado Pago conectado: ahí vas a cobrar tu parte.{" "}
                  <Link className="underline" href="/fotografo/configuracion?tab=mercadopago">Conectar Mercado Pago</Link>
                </>
              ) : null
            }
          />
        </Card>
      )}
    </AgencyPageFrame>
  );
}
