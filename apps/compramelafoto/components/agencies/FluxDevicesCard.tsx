"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Device = { id: number; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

const TZ = "America/Argentina/Buenos_Aires";
const API = "/api/fotografo/agencias/flux";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Vincular DNX FLUX con un código corto y ver/desvincular las computadoras (sirven para todas tus agencias). */
export default function FluxDevicesCard() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(API, { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || "No pudimos cargar tus computadoras vinculadas.");
    setDevices(d.devices ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setError("No pudimos cargar tus computadoras vinculadas."));
  }, [load]);

  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [code]);

  const expired = code ? new Date(code.expiresAt).getTime() <= now : false;

  async function newCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API, { method: "POST", credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error || "No pudimos generar el código.");
      setCode({ code: d.code, expiresAt: d.expiresAt });
      setNow(Date.now());
    } catch {
      setError("No pudimos generar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(d: Device) {
    if (!confirm(`¿Desvincular "${d.label}"? DNX FLUX deja de poder subir desde esa computadora hasta que la vuelvas a vincular.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/${d.id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || "No pudimos desvincular esa computadora.");
      await load();
    } catch {
      setError("No pudimos desvincular esa computadora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Subir desde la computadora (DNX FLUX)</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Poné la tarjeta de la cámara en tu computadora y DNX FLUX sube las fotos solas al álbum de la agencia, a tu
          nombre. Vinculás la computadora una sola vez y sirve para todas las agencias en las que estás.
        </p>
      </div>

      {code && !expired ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <p>1. Abrí DNX FLUX en tu computadora y elegí <strong>Vincular con ComprameLaFoto</strong>.</p>
          <p>2. Escribí este código:</p>
          <p className="my-2 font-mono text-3xl tracking-widest text-[#1a1a1a]">{code.code}</p>
          <p className="text-[#6b7280]">Vence a las {fmtTime(code.expiresAt)} y sirve una sola vez.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setCode(null); load().catch(() => setError("No pudimos cargar tus computadoras vinculadas.")); }}>Ya lo vinculé</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {code && expired && <p className="text-sm text-amber-700">El código venció. Generá uno nuevo.</p>}
          <Button size="sm" onClick={newCode} disabled={busy}>Vincular una computadora</Button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-[#1a1a1a]">Computadoras vinculadas</h3>
        {devices === null ? (
          <p className="text-sm text-[#6b7280]">Cargando…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-[#6b7280]">Todavía no vinculaste ninguna.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">{d.label}</p>
                  <p className="text-[#6b7280]">
                    Vinculada el {fmtDateTime(d.createdAt)} · {d.lastUsedAt ? `Último uso: ${fmtDateTime(d.lastUsedAt)}` : "Sin usar todavía"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => unlink(d)} disabled={busy}>Desvincular</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}
