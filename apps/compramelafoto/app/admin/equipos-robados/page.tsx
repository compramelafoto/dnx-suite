"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/**
 * Equipos robados — sólo administradores.
 * Denuncias (aprobar mirando la factura), coincidencias y buscador de números de serie.
 * Nada de esto se muestra a fotógrafos ni al público.
 */

type UserCard = { id: number; name: string | null; email: string; phone: string | null } | null;

type Report = {
  id: number;
  kind: "BODY" | "LENS";
  make: string;
  model: string;
  serialRaw: string;
  serialNormalized: string;
  stolenAt: string;
  stolenPlace: string | null;
  description: string | null;
  policeReportNumber: string | null;
  policeReportKey: string | null;
  status: "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "RECOVERED" | "WITHDRAWN";
  rejectionReason: string | null;
  adminNotes: string | null;
  lastScannedAt: string | null;
  createdAt: string;
  reporter: UserCard;
  reviewedBy: { id: number; name: string | null } | null;
  _count: { matches: number };
};

type Sighting = {
  id: number;
  kind: "BODY" | "LENS";
  make: string;
  model: string;
  serialRaw: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUploadedAt: string;
  photosCount: number;
  lastAlbumId: number | null;
  lastAlbumTitle: string | null;
  photographerLabel: string | null;
  photographer: UserCard;
};

type Match = {
  id: number;
  status: "NEW" | "REVIEWING" | "CONFIRMED" | "DISMISSED";
  makeMismatch: boolean;
  detectedAt: string;
  adminNotes: string | null;
  report: {
    id: number;
    kind: "BODY" | "LENS";
    make: string;
    model: string;
    serialRaw: string;
    stolenAt: string;
    status: Report["status"];
    reporter: UserCard;
  };
  sighting: Sighting;
};

type History = {
  serialNormalized: string | null;
  sightings: Sighting[];
  reports: { id: number; kind: string; make: string; model: string; status: Report["status"]; stolenAt: string; reporter: UserCard }[];
};

const REPORT_STATUS: Record<Report["status"], string> = {
  PENDING_REVIEW: "En revisión",
  ACTIVE: "Activa (buscando)",
  REJECTED: "Rechazada",
  RECOVERED: "Recuperado",
  WITHDRAWN: "Retirada",
};

const MATCH_STATUS: Record<Match["status"], string> = {
  NEW: "Nueva",
  REVIEWING: "Revisando",
  CONFIRMED: "Confirmada",
  DISMISSED: "Descartada",
};

const MATCH_TONE: Record<Match["status"], string> = {
  NEW: "bg-red-50 text-red-800 border-red-200",
  REVIEWING: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-green-50 text-green-800 border-green-200",
  DISMISSED: "bg-gray-100 text-gray-600 border-gray-200",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function kindLabel(k: string) {
  return k === "LENS" ? "Lente" : "Cámara";
}

function Person({ u, fallback }: { u: UserCard; fallback?: string | null }) {
  if (!u) return <span className="text-gray-500">{fallback ? `${fallback} (cuenta borrada)` : "Cuenta borrada"}</span>;
  return (
    <span>
      <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-blue-700 hover:underline">
        {u.name || u.email}
      </Link>
      <span className="text-gray-500"> · {u.email}{u.phone ? ` · ${u.phone}` : ""}</span>
    </span>
  );
}

type Tab = "matches" | "reports" | "search";

export default function AdminEquiposRobadosPage() {
  const [tab, setTab] = useState<Tab>("matches");
  const [reports, setReports] = useState<Report[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [serial, setSerial] = useState("");
  const [history, setHistory] = useState<History | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/equipos-robados", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports ?? []);
      setMatches(data.matches ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function reportAction(id: number, action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/equipos-robados/denuncias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error || "No se pudo guardar.");
    else if (action === "approve")
      setMsg(
        data.newMatches > 0
          ? `Aprobada. ¡Ya aparece en ${data.newMatches} cuenta(s)! Mirá Coincidencias.`
          : "Aprobada. Por ahora no aparece en CLF; se revisa todos los días."
      );
    await load();
    setBusy(false);
  }

  async function matchAction(id: number, body: { status?: string; notes?: string }) {
    setBusy(true);
    await fetch(`/api/admin/equipos-robados/coincidencias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    setBusy(false);
  }

  async function scanNow() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/equipos-robados", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Búsqueda hecha: ${data.newMatches} coincidencia(s) nueva(s) en ${data.reportsScanned} denuncia(s) activas.` : "Falló la búsqueda.");
    await load();
    setBusy(false);
  }

  async function searchSerial(e: React.FormEvent) {
    e.preventDefault();
    if (!serial.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/equipos-robados?serie=${encodeURIComponent(serial.trim())}`, { cache: "no-store" });
    setHistory(res.ok ? await res.json() : null);
    setBusy(false);
  }

  const pending = reports.filter((r) => r.status === "PENDING_REVIEW").length;
  const active = reports.filter((r) => r.status === "ACTIVE").length;
  const openMatches = matches.filter((m) => m.status === "NEW" || m.status === "REVIEWING").length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "matches", label: `Coincidencias${openMatches ? ` (${openMatches})` : ""}` },
    { id: "reports", label: `Denuncias${pending ? ` · ${pending} por revisar` : ""}` },
    { id: "search", label: "Buscar número de serie" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Equipos robados</h1>
          <p className="text-sm text-gray-600 mt-1 m-0">
            Privado. Las denuncias se cruzan todos los días con los números de serie de las fotos subidas a CLF.
            {" "}{active} denuncia(s) activa(s). Los fotógrafos cargan en <code>/fotografo/equipos-robados</code>.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={scanNow} disabled={busy}>
          Buscar ahora
        </Button>
      </div>

      {msg && <p className="text-sm text-gray-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 m-0">{msg}</p>}

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : tab === "matches" ? (
        matches.length === 0 ? (
          <Card className="p-6 text-sm text-gray-600">Todavía no apareció ningún equipo denunciado.</Card>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <Card key={m.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 m-0">
                    {kindLabel(m.report.kind)} {m.report.make} {m.report.model} · serie {m.report.serialRaw}
                  </p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded border ${MATCH_TONE[m.status]}`}>
                    {MATCH_STATUS[m.status]}
                  </span>
                </div>
                {m.makeMismatch && (
                  <p className="text-sm text-amber-800 m-0">
                    Ojo: la marca en las fotos ({m.sighting.make} {m.sighting.model}) no coincide con la denuncia. Puede ser
                    otro equipo con el mismo número.
                  </p>
                )}
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="m-0">
                    <strong>Lo está usando:</strong> <Person u={m.sighting.photographer} fallback={m.sighting.photographerLabel} />
                  </p>
                  <p className="m-0">
                    Visto entre {fmt(m.sighting.firstSeenAt)} y {fmt(m.sighting.lastSeenAt)} · última subida{" "}
                    {fmt(m.sighting.lastUploadedAt)} · {m.sighting.photosCount} foto(s)
                    {m.sighting.lastAlbumTitle ? ` · último álbum: ${m.sighting.lastAlbumTitle} (#${m.sighting.lastAlbumId})` : ""}
                  </p>
                  <p className="m-0">
                    <strong>Denunció:</strong> <Person u={m.report.reporter} /> · robado el {fmt(m.report.stolenAt)} · denuncia #
                    {m.report.id}
                  </p>
                  <p className="text-xs text-gray-500 m-0">Detectado el {fmt(m.detectedAt)}</p>
                </div>
                <textarea
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  rows={2}
                  placeholder="Notas internas (qué se hizo, con quién se habló)"
                  defaultValue={m.adminNotes ?? ""}
                  onBlur={(e) => e.target.value !== (m.adminNotes ?? "") && matchAction(m.id, { notes: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  {(["REVIEWING", "CONFIRMED", "DISMISSED"] as const)
                    .filter((s) => s !== m.status)
                    .map((s) => (
                      <Button key={s} size="sm" variant="outline" disabled={busy} onClick={() => matchAction(m.id, { status: s })}>
                        {s === "REVIEWING" ? "Revisando" : s === "CONFIRMED" ? "Confirmar" : "Descartar"}
                      </Button>
                    ))}
                  {m.report.status === "ACTIVE" && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => reportAction(m.report.id, "recovered")}>
                      Equipo recuperado
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === "reports" ? (
        reports.length === 0 ? (
          <Card className="p-6 text-sm text-gray-600">No hay denuncias cargadas.</Card>
        ) : (
          <div className="space-y-3">
            {[...reports]
              .sort((a, b) => Number(b.status === "PENDING_REVIEW") - Number(a.status === "PENDING_REVIEW"))
              .map((r) => (
                <Card key={r.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 m-0">
                      #{r.id} · {kindLabel(r.kind)} {r.make} {r.model} · serie {r.serialRaw}
                    </p>
                    <span className="text-xs font-semibold px-2 py-1 rounded border bg-gray-50 border-gray-200 text-gray-700">
                      {REPORT_STATUS[r.status]}
                      {r._count.matches ? ` · ${r._count.matches} coincidencia(s)` : ""}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p className="m-0">
                      <strong>Denunció:</strong> <Person u={r.reporter} /> · el {fmt(r.createdAt)}
                    </p>
                    <p className="m-0">
                      Robado el {fmt(r.stolenAt)}
                      {r.stolenPlace ? ` en ${r.stolenPlace}` : ""}
                      {r.policeReportNumber ? ` · denuncia policial N° ${r.policeReportNumber}` : ""}
                    </p>
                    {r.description && <p className="m-0 text-gray-600">“{r.description}”</p>}
                    {r.rejectionReason && <p className="m-0 text-red-700">Motivo del rechazo: {r.rejectionReason}</p>}
                    {r.lastScannedAt && <p className="text-xs text-gray-500 m-0">Último cruce: {fmt(r.lastScannedAt)}</p>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <a className="text-blue-700 hover:underline" href={`/api/admin/equipos-robados/denuncias/${r.id}/archivo?cual=factura`} target="_blank" rel="noreferrer">
                      Ver factura
                    </a>
                    {r.policeReportKey && (
                      <a className="text-blue-700 hover:underline" href={`/api/admin/equipos-robados/denuncias/${r.id}/archivo?cual=denuncia`} target="_blank" rel="noreferrer">
                        Ver denuncia policial
                      </a>
                    )}
                    <button
                      type="button"
                      className="text-blue-700 hover:underline"
                      onClick={() => {
                        setSerial(r.serialRaw);
                        setTab("search");
                      }}
                    >
                      Historial de esta serie
                    </button>
                  </div>
                  <textarea
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    rows={2}
                    placeholder="Notas internas"
                    defaultValue={r.adminNotes ?? ""}
                    onBlur={(e) => e.target.value !== (r.adminNotes ?? "") && reportAction(r.id, "notes", { notes: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(r.status === "PENDING_REVIEW" || r.status === "REJECTED") && (
                      <Button size="sm" disabled={busy} onClick={() => reportAction(r.id, "approve")}>
                        Aprobar y buscar
                      </Button>
                    )}
                    {r.status === "PENDING_REVIEW" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt("Motivo del rechazo (lo ve el fotógrafo):");
                          if (reason?.trim()) reportAction(r.id, "reject", { reason });
                        }}
                      >
                        Rechazar
                      </Button>
                    )}
                    {r.status === "ACTIVE" && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => reportAction(r.id, "recovered")}>
                        Equipo recuperado
                      </Button>
                    )}
                    {(r.status === "RECOVERED" || r.status === "WITHDRAWN") && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => reportAction(r.id, "reopen")}>
                        Reabrir
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <form onSubmit={searchSerial} className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Número de serie de cámara o lente"
              maxLength={80}
            />
            <Button type="submit" disabled={busy}>
              Buscar
            </Button>
          </form>
          {history &&
            (history.serialNormalized == null ? (
              <p className="text-sm text-gray-600">Ese número es muy corto o no es válido.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 m-0">
                  Serie normalizada <code>{history.serialNormalized}</code>: {history.sightings.length} cuenta(s) la usaron
                  {history.reports.length ? ` · ${history.reports.length} denuncia(s)` : ""}.
                </p>
                {history.reports.map((r) => (
                  <Card key={`r${r.id}`} className="p-3 text-sm border-red-200 bg-red-50">
                    Denuncia #{r.id} · {kindLabel(r.kind)} {r.make} {r.model} · {REPORT_STATUS[r.status]} · robado el {fmt(r.stolenAt)} ·{" "}
                    <Person u={r.reporter} />
                  </Card>
                ))}
                {history.sightings.length === 0 ? (
                  <Card className="p-4 text-sm text-gray-600">Esa serie nunca apareció en fotos de CLF.</Card>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-3">Equipo</th>
                          <th className="py-2 pr-3">Cuenta</th>
                          <th className="py-2 pr-3">Primera vez</th>
                          <th className="py-2 pr-3">Última vez</th>
                          <th className="py-2 pr-3">Fotos</th>
                          <th className="py-2 pr-3">Último álbum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.sightings.map((s) => (
                          <tr key={s.id} className="border-b align-top">
                            <td className="py-2 pr-3">
                              {kindLabel(s.kind)} {s.make} {s.model}
                            </td>
                            <td className="py-2 pr-3">
                              <Person u={s.photographer} fallback={s.photographerLabel} />
                            </td>
                            <td className="py-2 pr-3">{fmt(s.firstSeenAt)}</td>
                            <td className="py-2 pr-3">{fmt(s.lastSeenAt)}</td>
                            <td className="py-2 pr-3">{s.photosCount}</td>
                            <td className="py-2 pr-3">{s.lastAlbumTitle ? `${s.lastAlbumTitle} (#${s.lastAlbumId})` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
