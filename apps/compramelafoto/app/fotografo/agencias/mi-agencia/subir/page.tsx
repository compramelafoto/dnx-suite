"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import AgencyUploadPanel from "@/components/agencies/AgencyUploadPanel";

type Loaded = {
  agencyId: number;
  name: string;
  albums: Array<{ albumId: number; title: string }>;
  places: Array<{ id: number; name: string; lat: number; lng: number }>;
  members: Array<{ userId: number; name: string }>;
  membersWithoutTerms: number;
};

async function getJson(path: string) {
  const res = await fetch(path, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No pudimos cargar tu agencia.");
  return data;
}

/** El dueño sube fotos al álbum de su agencia y elige de qué miembro es cada lote (o cada foto). */
export default function SubirFotosDuenoAgenciaPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { agency } = await getJson("/api/fotografo/agencias/mi-agencia");
      if (!agency) throw new Error("Todavía no creaste tu agencia.");
      const [albums, places, team] = await Promise.all([
        getJson("/api/fotografo/agencias/mi-agencia/albumes"),
        getJson("/api/fotografo/agencias/mi-agencia/lugares"),
        getJson("/api/fotografo/agencias/mi-agencia/equipo"),
      ]);
      const active = (team.members ?? []) as Array<{ userId: number; name: string; needsTerms: boolean }>;
      setData({
        agencyId: agency.id,
        name: agency.name,
        albums: (albums.linked ?? []).map((a: { albumId: number; title: string }) => ({ albumId: a.albumId, title: a.title })),
        places: places.places ?? [],
        members: active.filter((m) => !m.needsTerms).map((m) => ({ userId: m.userId, name: m.name })),
        membersWithoutTerms: active.filter((m) => m.needsTerms).length,
      });
    })().catch((e) => setLoadError((e as Error).message));
  }, []);

  return (
    <AgencyPageFrame
      title="Subir fotos de la agencia"
      subtitle="Subí fotos al álbum de tu agencia e indicá de qué fotógrafo es cada una: así cada autor cobra su parte."
    >
      {loadError && <Card>{loadError}</Card>}
      {!data && !loadError && <Card>Cargando…</Card>}
      {data && (
        <Card className="space-y-5">
          <h2 className="text-lg font-medium">{data.name}</h2>
          {data.membersWithoutTerms > 0 && (
            <p className="text-xs text-[#6b7280]">
              {data.membersWithoutTerms === 1 ? "Un miembro todavía no aceptó" : `${data.membersWithoutTerms} miembros todavía no aceptaron`} las
              condiciones nuevas: hasta que lo hagan no se les pueden asignar fotos.
            </p>
          )}
          <AgencyUploadPanel agencyId={data.agencyId} albums={data.albums} places={data.places} members={data.members} />
          <Link className="text-sm underline" href="/fotografo/agencias/mi-agencia">Volver a Mi agencia</Link>
        </Card>
      )}
    </AgencyPageFrame>
  );
}
