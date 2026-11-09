"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { agencyUploadSummaryText, useAgencyPhotoUpload, type AgencyUploadPoint } from "@/lib/agencies/use-agency-photo-upload";

type Album = { albumId: number; title: string };
type Place = { id: number; name: string; lat: number; lng: number };
type Member = { userId: number; name: string };

/**
 * Formulario de subida web a un álbum de agencia. Lo usan:
 * - el miembro (sin `members`): las fotos quedan a su nombre y se suben apenas las elige;
 * - el dueño (con `members`): elige de quién es el lote y, si quiere, cambia el autor foto por foto antes de subir.
 *   Sin elegir a nadie quedan como del dueño (100 % agencia).
 */
export default function AgencyUploadPanel({
  agencyId,
  albums,
  places,
  members,
  blockedReason,
}: {
  agencyId: number;
  albums: Album[];
  places: Place[];
  members?: Member[];
  /** Si hay algo que impide subir (por ejemplo, Mercado Pago sin conectar), se deshabilita. */
  blockedReason?: ReactNode;
}) {
  const ownerMode = Array.isArray(members);
  const [albumId, setAlbumId] = useState<number | null>(albums.length === 1 ? albums[0].albumId : null);
  const [placeChoice, setPlaceChoice] = useState<string>("");
  const [myPoint, setMyPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [batchAuthor, setBatchAuthor] = useState<string>("");
  const [pending, setPending] = useState<Array<{ file: File; author: string }>>([]);
  const { upload, progress, uploading, summary, error } = useAgencyPhotoUpload();

  const point: AgencyUploadPoint =
    placeChoice === "mine" ? myPoint : placeChoice ? { placeId: Number(placeChoice) } : null;
  const waitingLocation = placeChoice === "mine" && !myPoint;
  const blocked = !albumId || uploading || Boolean(blockedReason) || waitingLocation;

  const start = (items: Array<{ file: File; author: string }>) => {
    if (!albumId || items.length === 0) return;
    const authors = new Map(items.map((i) => [i.file, i.author ? Number(i.author) : null]));
    upload({ agencyId, albumId, files: items.map((i) => i.file), point, authorFor: ownerMode ? (f) => authors.get(f) ?? null : undefined });
    setPending([]);
  };

  const authorOptions = (
    <>
      <option value="">La agencia (sin autor: 100 % agencia)</option>
      {(members ?? []).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
    </>
  );

  return (
    <div className="space-y-5">
      {blockedReason && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">{blockedReason}</div>}

      {albums.length === 0 ? (
        <p className="text-sm text-[#6b7280]">
          {ownerMode ? "Todavía no sumaste álbumes a la agencia." : "La agencia todavía no tiene álbumes. Avisale al dueño."}
        </p>
      ) : (
        <label className="block text-sm font-medium">Álbum
          <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={albumId ?? ""} onChange={(e) => setAlbumId(Number(e.target.value) || null)}>
            <option value="">Elegí el álbum…</option>
            {albums.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
          </select>
        </label>
      )}

      {ownerMode && (
        <div>
          <label className="block text-sm font-medium">¿De quién son estas fotos?
            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={batchAuthor} onChange={(e) => {
              setBatchAuthor(e.target.value);
              setPending((p) => p.map((i) => ({ ...i, author: e.target.value })));
            }}>
              {authorOptions}
            </select>
          </label>
          <p className="mt-1 text-xs text-[#6b7280]">
            El autor cobra su porcentaje de cada venta de sus fotos. Sólo aparecen los miembros activos del equipo.
          </p>
        </div>
      )}

      <label className="block text-sm font-medium">¿Dónde se sacaron estas fotos?
        <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={placeChoice} onChange={(e) => {
          const v = e.target.value;
          setPlaceChoice(v);
          setGeoError(null);
          setMyPoint(null);
          if (v === "mine") {
            const fail = () => {
              setGeoError("No pudimos obtener tu ubicación: elegí un lugar de la lista o dejá que la cámara ponga el GPS.");
              setPlaceChoice("");
            };
            if (!navigator.geolocation) fail();
            else
              navigator.geolocation.getCurrentPosition(
                (pos) => setMyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                fail,
                { enableHighAccuracy: true, timeout: 10000 }
              );
          }
        }}>
          <option value="">No sé / la cámara tiene GPS</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="mine">Usar mi ubicación actual</option>
        </select>
      </label>
      {geoError && <p className="text-sm text-red-600">{geoError}</p>}
      {waitingLocation && <p className="text-xs text-[#6b7280]">Esperando tu ubicación… (aceptá el permiso del navegador)</p>}
      <p className="text-xs text-[#6b7280]">Si la foto trae GPS de la cámara, se usa ese. Si no, el lugar que elijas acá.</p>

      <label className={`block rounded-2xl border-2 border-dashed p-6 text-center text-sm ${blocked ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
        <input
          type="file"
          accept="image/jpeg,image/jpg"
          multiple
          className="hidden"
          disabled={blocked}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!files.length) return;
            if (ownerMode) setPending((p) => [...p, ...files.map((file) => ({ file, author: batchAuthor }))]);
            else start(files.map((file) => ({ file, author: "" })));
          }}
        />
        {uploading ? "Subiendo…" : "Tocá acá para elegir las fotos (JPG)"}
      </label>

      {ownerMode && pending.length > 0 && !uploading && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{pending.length} fotos elegidas. Si alguna es de otra persona, cambiala acá:</p>
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-2">
            {pending.map((item, idx) => (
              <li key={`${item.file.name}-${idx}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
                <select
                  className="rounded-lg border px-2 py-1 text-sm sm:w-64"
                  value={item.author}
                  onChange={(e) => setPending((p) => p.map((x, i) => (i === idx ? { ...x, author: e.target.value } : x)))}
                >
                  {authorOptions}
                </select>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => start(pending)} disabled={blocked}>Subir {pending.length} fotos</Button>
            <Button variant="secondary" onClick={() => setPending([])}>Cancelar</Button>
          </div>
        </div>
      )}

      {progress && uploading && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-2 bg-[#c27b3d]" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} />
          </div>
          <p className="text-xs text-[#6b7280]">{progress.processed} de {progress.total} fotos</p>
        </div>
      )}
      {summary && !uploading && <p className="text-sm">{agencyUploadSummaryText(summary)}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!ownerMode && <Link className="text-sm underline" href="/fotografo/agencias/mis-agencias">Volver a Mis agencias</Link>}
    </div>
  );
}
