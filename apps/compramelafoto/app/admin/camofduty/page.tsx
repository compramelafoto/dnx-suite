"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import type { CamOfDutyMemberAdminRow } from "@/app/api/admin/camofduty-members/route";
import { formatDate } from "@/lib/admin/helpers";

/** Distancia en km entre dos puntos (fórmula del haversine). */
function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const ORIGIN_LABEL = (fromCamOfDuty: boolean) => (fromCamOfDuty ? "Se registró en Cam Of Duty" : "Ya era de CLF");

function toCsv(rows: CamOfDutyMemberAdminRow[]): string {
  const head = ["Nombre", "Email", "Email validado", "Origen", "WhatsApp", "Instagram", "Empresa", "Ciudad", "Provincia", "País", "Latitud", "Longitud", "Quiere trabajos", "Desde", "Primera entrada", "Última entrada", "Entradas"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.name, r.email, r.emailVerified ? "sí" : "no", ORIGIN_LABEL(r.fromCamOfDuty), r.whatsapp, r.instagram ? `@${r.instagram}` : "", r.company, r.city, r.province, r.country, r.latitude, r.longitude, r.jobAlerts ? "sí" : "no", r.jobAlertsAt ? formatDate(r.jobAlertsAt) : "", formatDate(r.firstVisitAt), formatDate(r.lastVisitAt), r.visits]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\n");
}

export default function AdminCamOfDutyPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CamOfDutyMemberAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [origin, setOrigin] = useState<"todos" | "cod" | "clf">("todos");
  const [near, setNear] = useState("");
  const [radius, setRadius] = useState(50);
  const [center, setCenter] = useState<{ label: string; lat: number; lon: number } | null>(null);
  const [nearError, setNearError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/camofduty-members", { credentials: "include" });
        if (!res.ok) throw new Error("Error cargando usuarios de Cam Of Duty");
        const data = await res.json();
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } catch (error) {
        console.error(error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const locate = async () => {
    setNearError(null);
    if (near.trim().length < 3) {
      setCenter(null);
      return;
    }
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(near.trim())}`);
    const hits = res.ok ? await res.json() : [];
    if (!Array.isArray(hits) || hits.length === 0) {
      setNearError("No encontramos esa ciudad.");
      setCenter(null);
      return;
    }
    setCenter({ label: hits[0].displayName, lat: hits[0].lat, lon: hits[0].lon });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyAlerts && !r.jobAlerts) return false;
      if (origin === "cod" && !r.fromCamOfDuty) return false;
      if (origin === "clf" && r.fromCamOfDuty) return false;
      if (q.length >= 2 && ![r.name, r.email, r.company, r.whatsapp, r.instagram, r.city].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      if (center) {
        if (r.latitude == null || r.longitude == null) return false;
        if (km(center.lat, center.lon, r.latitude, r.longitude) > radius) return false;
      }
      return true;
    });
  }, [rows, search, onlyAlerts, origin, center, radius]);

  const download = () => {
    const blob = new Blob([`﻿${toCsv(filtered)}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `camofduty-fotografos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="ds-dashboard-inner mx-auto w-full min-w-0 space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold text-[var(--ds-color-text)]">Fotógrafos de Cam Of Duty</h1>
        <p className="mt-1 text-sm text-[var(--ds-color-muted)]">
          Cuentas de fotógrafo de CompraMeLaFoto que entraron a Cam Of Duty, con sus datos y si quieren enterarse de trabajos cerca.
        </p>
      </header>

      <Card className="!p-4 sm:!p-6">
        <div className="mb-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="min-w-0">
            <label htmlFor="camofduty-search" className="mb-1 block text-sm font-medium">
              Buscar (nombre, email, empresa, WhatsApp, Instagram)
            </label>
            <Input id="camofduty-search" type="search" className="min-h-[44px] w-full" placeholder="Mínimo 2 caracteres" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label htmlFor="camofduty-near" className="mb-1 block text-sm font-medium">
              Cerca de (ciudad) y radio en km
            </label>
            <div className="flex gap-2">
              <Input id="camofduty-near" className="min-h-[44px] w-full" placeholder="Rosario" value={near} onChange={(e) => setNear(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void locate()} />
              <Input type="number" min={1} className="min-h-[44px] w-24" value={radius} onChange={(e) => setRadius(Math.max(1, Number(e.target.value) || 1))} aria-label="Radio en km" />
              <button type="button" className="rounded-md border px-3 text-sm" onClick={() => void locate()}>
                Filtrar
              </button>
            </div>
            {center ? (
              <p className="mt-1 text-xs text-[var(--ds-color-muted)]">
                A menos de {radius} km de {center.label}.{" "}
                <button type="button" className="underline" onClick={() => setCenter(null)}>
                  Quitar
                </button>
              </p>
            ) : null}
            {nearError ? <p className="mt-1 text-xs text-red-600">{nearError}</p> : null}
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />
              Sólo quieren trabajos
            </label>
            <select className="min-h-[36px] rounded-md border px-2 text-sm" value={origin} onChange={(e) => setOrigin(e.target.value as typeof origin)} aria-label="Origen de la cuenta">
              <option value="todos">Todos los orígenes</option>
              <option value="cod">Se registraron en Cam Of Duty ({rows.filter((r) => r.fromCamOfDuty).length})</option>
              <option value="clf">Ya eran de CLF ({rows.filter((r) => !r.fromCamOfDuty).length})</option>
            </select>
            <button type="button" className="rounded-md bg-[var(--ds-color-text)] px-3 py-2 text-sm text-white disabled:opacity-50" onClick={download} disabled={filtered.length === 0}>
              Exportar ({filtered.length})
            </button>
          </div>
        </div>
        <p className="mb-3 text-sm text-[var(--ds-color-muted)]">
          {loading ? "Cargando…" : `${filtered.length} de ${total} fotógrafo${total === 1 ? "" : "s"}`}
        </p>

        {loading ? (
          <p className="text-sm text-[var(--ds-color-muted)]">Cargando fotógrafos…</p>
        ) : filtered.length === 0 ? (
          <div className="ds-fill-width w-full min-w-0 rounded-lg border border-dashed border-[var(--ds-color-border)] px-4 py-10 text-center">
            <p className="m-0 text-sm text-[var(--ds-color-muted)]">{rows.length === 0 ? "Todavía nadie entró a Cam Of Duty." : "No hay resultados con esos filtros."}</p>
          </div>
        ) : (
          <div className="ds-table-scroll overflow-x-auto">
            <table className="ds-table w-full min-w-[72rem]">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Origen</th>
                  <th>Empresa</th>
                  <th>Ciudad</th>
                  <th>Trabajos cerca</th>
                  <th>Última entrada</th>
                  <th>Entradas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.userId}>
                    <td>
                      {r.name || "—"}
                      <div className="text-xs text-[var(--ds-color-muted)]">#{r.userId}</div>
                    </td>
                    <td>
                      <div>
                        {r.email} {r.emailVerified ? "✓" : <span className="text-xs text-amber-600">(sin validar)</span>}
                      </div>
                      {r.whatsapp ? (
                        <a className="text-xs underline" href={`https://wa.me/${r.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                          WhatsApp {r.whatsapp}
                        </a>
                      ) : null}
                      {r.instagram ? (
                        <div>
                          <a className="text-xs underline" href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noreferrer">
                            @{r.instagram}
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td>{ORIGIN_LABEL(r.fromCamOfDuty)}</td>
                    <td>{r.company || "—"}</td>
                    <td>{[r.city, r.province].filter(Boolean).join(", ") || "—"}</td>
                    <td>{r.jobAlerts ? `Sí${r.jobAlertsAt ? ` (desde ${formatDate(r.jobAlertsAt)})` : ""}` : "No"}</td>
                    <td>{formatDate(r.lastVisitAt)}</td>
                    <td>{r.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
