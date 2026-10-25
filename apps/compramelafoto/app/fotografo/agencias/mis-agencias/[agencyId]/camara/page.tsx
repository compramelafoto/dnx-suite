"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import FluxDevicesCard from "@/components/agencies/FluxDevicesCard";

type Album = { albumId: number; title: string; publicSlug: string };
type Place = { id: number; name: string; lat: number; lng: number };
type FtpInfo = {
  live: boolean;
  host: string;
  port: number;
  credential: { ftpUsername: string; albumId: number; albumTitle: string; lastUsedAt: string | null; albumNotInAgency?: boolean } | null;
};
type Presence = { lat: number; lng: number; placeId: number | null; validUntil: string };

const TZ = "America/Argentina/Buenos_Aires";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const BASE = (agencyId: string) => `/api/fotografo/agencias/mis-agencias/${agencyId}`;
const JSON_HEADERS = { "Content-Type": "application/json" };

export default function CamaraYUbicacionPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const [agency, setAgency] = useState<{ name: string; albums: Album[] } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // FTP
  const [ftp, setFtp] = useState<FtpInfo | null>(null);
  const [ftpAlbumId, setFtpAlbumId] = useState<number | null>(null);
  const [issued, setIssued] = useState<{ ftpUsername: string; password: string } | null>(null);
  const [ftpBusy, setFtpBusy] = useState(false);
  const [ftpError, setFtpError] = useState<string | null>(null);

  // Estoy acá
  const [presence, setPresence] = useState<Presence | null>(null);
  const [placeChoice, setPlaceChoice] = useState<string>("");
  const [myPoint, setMyPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoAttempt = useRef(0);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [presenceError, setPresenceError] = useState<string | null>(null);

  const loadFtp = useCallback(async () => {
    const res = await fetch(`${BASE(agencyId)}/ftp`, { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setFtpError(d.error || "No pudimos cargar tus datos de FTP.");
    setFtp(d);
  }, [agencyId]);

  const loadPresence = useCallback(async () => {
    const res = await fetch(`${BASE(agencyId)}/estoy-aca`, { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setPresenceError(d.error || "No pudimos cargar tu ubicación de hoy.");
    setPresence(d.presence ?? null);
  }, [agencyId]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/fotografo/agencias/mis-agencias", { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setLoadError(d.error || "No pudimos cargar tus agencias.");
      const a = (d.agencies ?? []).find((x: any) => String(x.agencyId) === String(agencyId) && x.status === "ACTIVE");
      if (!a) return setLoadError("No sos parte del equipo de esta agencia.");
      setAgency({ name: a.name, albums: a.albums });
      if (a.albums.length === 1) setFtpAlbumId(a.albums[0].albumId);
      const pr = await fetch(`${BASE(agencyId)}/lugares`, { credentials: "include" });
      const pd = await pr.json().catch(() => ({ places: [] }));
      if (pr.ok) setPlaces(pd.places ?? []);
      await Promise.all([loadFtp(), loadPresence()]);
    })().catch(() => setLoadError("No pudimos cargar tus agencias."));
  }, [agencyId, loadFtp, loadPresence]);

  async function createCredential(albumId: number, regenerate = false) {
    if (
      regenerate &&
      !confirm("Vas a generar un usuario y contraseña nuevos. Los actuales dejan de funcionar: tenés que cargar los nuevos en la cámara. ¿Seguimos?")
    ) return;
    setFtpBusy(true);
    setFtpError(null);
    try {
      const res = await fetch(`${BASE(agencyId)}/ftp`, {
        method: "POST", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify({ albumId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setFtpError(d.error || "No pudimos crear tu usuario de FTP.");
      else setIssued(d.password ? { ftpUsername: d.ftpUsername, password: d.password } : null);
      await loadFtp();
    } catch {
      setFtpError("No pudimos crear tu usuario de FTP.");
    } finally {
      setFtpBusy(false);
    }
  }

  async function changeAlbum(albumId: number) {
    setFtpBusy(true);
    setFtpError(null);
    try {
      const res = await fetch(`${BASE(agencyId)}/ftp`, {
        method: "PATCH", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify({ albumId }),
      });
      if (!res.ok) setFtpError((await res.json().catch(() => ({}))).error || "No pudimos cambiar el álbum.");
      else setFtpAlbumId(albumId);
      await loadFtp();
    } catch {
      setFtpError("No pudimos cambiar el álbum.");
    } finally {
      setFtpBusy(false);
    }
  }

  async function deactivate() {
    if (!confirm("¿Desactivar tu usuario de FTP? La cámara va a dejar de subir fotos hasta que generes uno nuevo.")) return;
    setFtpBusy(true);
    setFtpError(null);
    try {
      const res = await fetch(`${BASE(agencyId)}/ftp`, { method: "DELETE", credentials: "include" });
      if (!res.ok) setFtpError((await res.json().catch(() => ({}))).error || "No pudimos desactivar tu usuario de FTP.");
      else setIssued(null);
      await loadFtp();
    } catch {
      setFtpError("No pudimos desactivar tu usuario de FTP.");
    } finally {
      setFtpBusy(false);
    }
  }

  function onPlaceChoice(v: string) {
    const attempt = ++geoAttempt.current;
    setPlaceChoice(v);
    setGeoError(null);
    setMyPoint(null);
    if (v !== "mine") return;
    const fail = () => {
      if (attempt !== geoAttempt.current) return;
      setGeoError("No pudimos obtener tu ubicación: elegí un lugar de la lista.");
      setPlaceChoice("");
    };
    if (!navigator.geolocation) fail();
    else
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (attempt === geoAttempt.current) setMyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        fail,
        { enableHighAccuracy: true, timeout: 10000 }
      );
  }

  const waitingLocation = placeChoice === "mine" && !myPoint;
  const canMark = !presenceBusy && !!placeChoice && !waitingLocation;

  async function markPresence() {
    const body = placeChoice === "mine" ? (myPoint ? { lat: myPoint.lat, lng: myPoint.lng } : null) : { placeId: Number(placeChoice) };
    if (!body) return;
    setPresenceBusy(true);
    setPresenceError(null);
    try {
      const res = await fetch(`${BASE(agencyId)}/estoy-aca`, {
        method: "POST", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setPresenceError(d.error || "No pudimos guardar dónde estás.");
      else {
        setPresence(d.presence ?? null);
        setPlaceChoice("");
        setMyPoint(null);
      }
    } catch {
      setPresenceError("No pudimos guardar dónde estás.");
    } finally {
      setPresenceBusy(false);
    }
  }

  async function clearPresence() {
    setPresenceBusy(true);
    setPresenceError(null);
    try {
      const res = await fetch(`${BASE(agencyId)}/estoy-aca`, { method: "DELETE", credentials: "include" });
      if (!res.ok) setPresenceError((await res.json().catch(() => ({}))).error || "No pudimos borrar tu ubicación.");
      else setPresence(null);
    } catch {
      setPresenceError("No pudimos borrar tu ubicación.");
    } finally {
      setPresenceBusy(false);
    }
  }

  const presenceName = presence
    ? presence.placeId != null
      ? places.find((p) => p.id === presence.placeId)?.name ?? "el lugar que elegiste"
      : "tu ubicación actual"
    : null;

  return (
    <AgencyPageFrame title="Cámara, DNX FLUX y ubicación" subtitle="Subí tus fotos desde la cámara o desde la computadora, y avisá dónde estás trabajando hoy.">
      {loadError && <Card>{loadError}</Card>}
      {!agency && !loadError && <Card>Cargando…</Card>}
      {agency && (
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-medium">Subir desde la cámara (FTP)</h2>
            <p className="text-sm text-[#6b7280]">
              Cargá estos datos en la configuración de FTP de tu cámara (o en la app de la cámara). Las fotos van solas al álbum de la agencia a tu nombre.
            </p>

            {ftp && !ftp.live && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                El servidor de FTP todavía no está funcionando. Podés preparar tu usuario y cargarlo en la cámara; vas a poder subir cuando lo activemos.
              </div>
            )}

            {!ftp && !ftpError && <p className="text-sm text-[#6b7280]">Cargando…</p>}

            {ftp && !ftp.credential && (
              agency.albums.length === 0 ? (
                <p className="text-sm text-[#6b7280]">La agencia todavía no tiene álbumes. Avisale al dueño.</p>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">Álbum
                    <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={ftpAlbumId ?? ""} disabled={ftpBusy} onChange={(e) => setFtpAlbumId(Number(e.target.value) || null)}>
                      <option value="">Elegí el álbum…</option>
                      {agency.albums.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
                    </select>
                  </label>
                  <Button size="sm" disabled={!ftpAlbumId || ftpBusy} onClick={() => ftpAlbumId && createCredential(ftpAlbumId)}>
                    {ftpBusy ? "Creando…" : "Crear mi usuario de FTP"}
                  </Button>
                </div>
              )
            )}

            {ftp?.credential && (
              <div className="space-y-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-[#6b7280]">Servidor</dt><dd className="font-mono">{ftp.host}</dd>
                  <dt className="text-[#6b7280]">Puerto</dt><dd className="font-mono">{ftp.port}</dd>
                  <dt className="text-[#6b7280]">Usuario</dt><dd className="font-mono">{ftp.credential.ftpUsername}</dd>
                  <dt className="text-[#6b7280]">Último uso</dt>
                  <dd>{ftp.credential.lastUsedAt ? formatDateTime(ftp.credential.lastUsedAt) : "Todavía no se usó"}</dd>
                </dl>
                {ftp.credential.albumNotInAgency && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    El álbum que tenías elegido ya no es de esta agencia, así que la cámara no puede subir ahí. Elegí otro álbum de la lista.
                  </div>
                )}
                <label className="block text-sm font-medium">Álbum
                  <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={agency.albums.some((a) => a.albumId === ftp.credential!.albumId) ? ftp.credential.albumId : ""} disabled={ftpBusy} onChange={(e) => { const v = Number(e.target.value); if (v) changeAlbum(v); }}>
                    {ftp.credential.albumNotInAgency && <option value="">Elegí otro álbum…</option>}
                    {agency.albums.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
                  </select>
                </label>
                {issued && (
                  <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm">Usuario: <span className="font-mono text-lg">{issued.ftpUsername}</span></p>
                    <p className="text-sm">Contraseña: <span className="font-mono text-lg">{issued.password}</span></p>
                    <p className="text-xs">Actualizá los dos en la cámara. Copiá la contraseña ahora: no la vamos a volver a mostrar.</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={ftpBusy} onClick={() => ftp.credential && createCredential(ftp.credential.albumId, true)}>
                    {ftpBusy ? "Un momento…" : "Generar contraseña nueva"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={ftpBusy} onClick={deactivate}>Desactivar</Button>
                </div>
              </div>
            )}

            {ftpError && <p className="text-sm text-red-600">{ftpError}</p>}
          </Card>

          <FluxDevicesCard />

          <Card className="space-y-4">
            <h2 className="text-lg font-medium">Estoy acá</h2>
            <p className="text-sm">
              {presence
                ? `Hoy estás en ${presenceName} hasta las ${formatTime(presence.validUntil)}`
                : "Todavía no marcaste dónde estás hoy"}
            </p>

            <label className="block text-sm font-medium">¿Dónde estás?
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={placeChoice} disabled={presenceBusy} onChange={(e) => onPlaceChoice(e.target.value)}>
                <option value="">Elegí un lugar…</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="mine">Usar mi ubicación actual</option>
              </select>
            </label>
            {geoError && <p className="text-sm text-red-600">{geoError}</p>}
            {waitingLocation && <p className="text-xs text-[#6b7280]">Esperando tu ubicación… (aceptá el permiso del navegador)</p>}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!canMark} onClick={markPresence}>{presenceBusy ? "Un momento…" : "Marcar"}</Button>
              {presence && <Button size="sm" variant="outline" disabled={presenceBusy} onClick={clearPresence}>Borrar</Button>}
            </div>
            {presenceError && <p className="text-sm text-red-600">{presenceError}</p>}
            <p className="text-xs text-[#6b7280]">Si tu cámara no tiene GPS, las fotos que subas hoy por FTP toman este lugar. Vence a la medianoche.</p>
          </Card>

          <Link className="text-sm underline" href="/fotografo/agencias/mis-agencias">Volver a Mis agencias</Link>
        </div>
      )}
    </AgencyPageFrame>
  );
}
