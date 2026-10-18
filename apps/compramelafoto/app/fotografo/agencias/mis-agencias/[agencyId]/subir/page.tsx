"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { useAgencyPhotoUpload } from "@/lib/agencies/use-agency-photo-upload";

type Album = { albumId: number; title: string; publicSlug: string };
type Place = { id: number; name: string; lat: number; lng: number };

export default function SubirFotosAgenciaPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const [agency, setAgency] = useState<{ name: string; albums: Album[] } | null>(null);
  const [mpConnected, setMpConnected] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [placeChoice, setPlaceChoice] = useState<string>("");
  const [myPoint, setMyPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { upload, progress, uploading, summary, error } = useAgencyPhotoUpload();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/fotografo/agencias/mis-agencias", { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setLoadError(d.error || "No pudimos cargar tus agencias.");
      const a = (d.agencies ?? []).find((x: any) => String(x.agencyId) === String(agencyId) && x.status === "ACTIVE");
      if (!a) return setLoadError("No sos parte del equipo de esta agencia.");
      setMpConnected(Boolean(d.mpConnected));
      setAgency({ name: a.name, albums: a.albums });
      if (a.albums.length === 1) setAlbumId(a.albums[0].albumId);
      const pr = await fetch(`/api/fotografo/agencias/mis-agencias/${agencyId}/lugares`, { credentials: "include" });
      const pd = await pr.json().catch(() => ({ places: [] }));
      if (pr.ok) setPlaces(pd.places ?? []);
    })().catch(() => setLoadError("No pudimos cargar tus agencias."));
  }, [agencyId]);

  const point =
    placeChoice === "mine"
      ? myPoint
      : placeChoice
        ? (() => {
            const p = places.find((x) => String(x.id) === placeChoice);
            return p ? { lat: p.lat, lng: p.lng } : null;
          })()
        : null;

  return (
    <AgencyPageFrame title="Subir fotos" subtitle="Subí tus fotos al álbum de la agencia. Si tu cámara no tiene GPS, elegí dónde las sacaste.">
      {loadError && <Card>{loadError}</Card>}
      {agency && (
        <Card className="space-y-5">
          <h2 className="text-lg font-medium">{agency.name}</h2>

          {!mpConnected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              Para subir fotos tenés que tener tu Mercado Pago conectado: ahí vas a cobrar tu parte.{" "}
              <Link className="underline" href="/fotografo/configuracion?tab=mercadopago">Conectar Mercado Pago</Link>
            </div>
          )}

          {agency.albums.length === 0 ? (
            <p className="text-sm text-[#6b7280]">La agencia todavía no tiene álbumes. Avisale al dueño.</p>
          ) : (
            <label className="block text-sm font-medium">Álbum
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={albumId ?? ""} onChange={(e) => setAlbumId(Number(e.target.value) || null)}>
                <option value="">Elegí el álbum…</option>
                {agency.albums.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
              </select>
            </label>
          )}

          <label className="block text-sm font-medium">¿Dónde sacaste estas fotos?
            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={placeChoice} onChange={(e) => {
              const v = e.target.value;
              setPlaceChoice(v);
              if (v === "mine" && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => setMyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => setMyPoint(null),
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }
            }}>
              <option value="">No sé / la cámara tiene GPS</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="mine">Usar mi ubicación actual</option>
            </select>
          </label>
          {placeChoice === "mine" && !myPoint && <p className="text-xs text-[#6b7280]">Esperando tu ubicación… (aceptá el permiso del navegador)</p>}
          <p className="text-xs text-[#6b7280]">Si la foto trae GPS de la cámara, se usa ese. Si no, el lugar que elijas acá.</p>

          <label className={`block rounded-2xl border-2 border-dashed p-6 text-center text-sm ${!albumId || uploading || !mpConnected ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
            <input
              type="file"
              accept="image/jpeg,image/jpg"
              multiple
              className="hidden"
              disabled={!albumId || uploading || !mpConnected}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (albumId && files.length) upload({ albumId, files, point });
              }}
            />
            {uploading ? "Subiendo…" : "Tocá acá para elegir las fotos (JPG)"}
          </label>

          {progress && uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-2 bg-[#c27b3d]" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} />
              </div>
              <p className="text-xs text-[#6b7280]">{progress.processed} de {progress.total} fotos</p>
            </div>
          )}
          {summary && !uploading && (
            <p className="text-sm">
              Listo: {summary.ok} subidas{summary.duplicates ? `, ${summary.duplicates} ya estaban (no se repitieron)` : ""}{summary.failed ? `, ${summary.failed} con error` : ""}.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Link className="text-sm underline" href="/fotografo/agencias/mis-agencias">Volver a Mis agencias</Link>
        </Card>
      )}
    </AgencyPageFrame>
  );
}
