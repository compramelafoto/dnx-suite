"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarRange,
  Download,
  Filter,
  RefreshCw,
  Wallet,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsEmptyTableCell } from "@/components/ui/DsEmptyTableCell";
import { formatCurrencyArs, formatDate, formatDateTime } from "@/lib/admin/school-detail-format";
import type { OrganizerCommissionRow, OrganizerCommissionSummary } from "@/components/admin/school-detail/types";

const STATUS_LABEL: Record<OrganizerCommissionRow["status"], string> = {
  PENDING: "Pendiente",
  REQUESTED: "Solicitado",
  PAID: "Pagado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const STATUS_BADGE: Record<OrganizerCommissionRow["status"], string> = {
  PENDING: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  REQUESTED: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
  PAID: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-800 ring-1 ring-red-200",
  CANCELLED: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

type Props = {
  schoolId: string;
};

export function SchoolCommissionsTab({ schoolId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OrganizerCommissionSummary | null>(null);
  const [rows, setRows] = useState<OrganizerCommissionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrganizerCommissionRow["status"] | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/organizer-commissions`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setSummary(data.summary as OrganizerCommissionSummary);
      setRows(Array.isArray(data.commissions) ? data.commissions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando comisiones");
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const t = new Date(r.createdAt).getTime();
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (t < from.getTime()) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (t > to.getTime()) return false;
      }
      return true;
    });
  }, [rows, statusFilter, dateFrom, dateTo]);

  function exportCsv() {
    const header = [
      "id",
      "fecha",
      "organizador",
      "email",
      "album_id",
      "album",
      "pedido_id",
      "monto",
      "estado",
      "metodo",
    ];
    const lines = filteredRows.map((r) =>
      [
        r.id,
        r.createdAt,
        r.organizerUser?.name ?? "",
        r.organizerUser?.email ?? "",
        r.album.id,
        r.album.title.replace(/"/g, '""'),
        r.order.id,
        r.amount,
        r.status,
        (r.paymentMethod ?? "").replace(/"/g, '""'),
      ]
        .map((cell) => `"${String(cell)}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comisiones-escuela-${schoolId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !summary && rows.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafafa] text-sm text-[#6b7280]">
        Cargando comisiones…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary ? (
          <>
            <Card className="rounded-2xl border border-[#ebe8e4] p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdf8f3] text-[#c27b3d] ring-1 ring-[#e8dcc8]">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Acumulado</p>
                  <p className="mt-1 text-2xl font-semibold text-[#111827]">
                    {formatCurrencyArs(summary.acumulado)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
                  <BadgeDollarSign className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Pendiente</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-950">
                    {formatCurrencyArs(summary.pendiente)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-sky-100 bg-sky-50/35 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-900">
                  <CalendarRange className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/80">Solicitado</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-950">
                    {formatCurrencyArs(summary.solicitado)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/35 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900">
                  <BadgeDollarSign className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">Pagado</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-950">
                    {formatCurrencyArs(summary.pagado)}
                  </p>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <p className="col-span-full text-sm text-[#6b7280]">No hay resumen de comisiones.</p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-[#9ca3af]" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Filtros</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="min-h-[42px] rounded-xl border border-[#111827]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
          >
            <option value="all">Todos los estados</option>
            {(Object.keys(STATUS_LABEL) as OrganizerCommissionRow["status"][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <Input
            type="date"
            className="max-w-[160px]"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Desde"
          />
          <Input
            type="date"
            className="max-w-[160px]"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Hasta"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4 inline" aria-hidden />
            Actualizar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={filteredRows.length === 0}>
            <Download className="mr-2 h-4 w-4 inline" aria-hidden />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] p-0 shadow-sm">
        <div className="border-b border-[#f3f4f6] px-5 py-4">
          <h3 className="text-sm font-semibold text-[#111827]">Movimientos</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
            Mostrando {filteredRows.length} registro(s). La plataforma no liquida estos montos; el pago corre por
            cuenta del fotógrafo.
          </p>
        </div>
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="min-w-[920px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Fecha
                </th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Organizador
                </th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Álbum / Pedido
                </th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Monto
                </th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Estado
                </th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Método
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <DsEmptyTableCell colSpan={6}>
                    No hay comisiones con los filtros actuales.
                  </DsEmptyTableCell>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="border-b border-[#f9fafb] px-4 py-4 text-[#374151]">
                      <div>{formatDate(r.createdAt)}</div>
                      <div className="text-xs text-[#9ca3af]">{formatDateTime(r.createdAt)}</div>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <div className="font-medium text-[#111827]">{r.organizerUser?.name || "—"}</div>
                      <div className="text-xs text-[#6b7280]">{r.organizerUser?.email || "—"}</div>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <div className="text-[#111827]">{r.album.title}</div>
                      <div className="text-xs text-[#6b7280]">
                        Álbum #{r.album.id} · Pedido #{r.order.id}
                      </div>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4 font-semibold text-[#111827]">
                      {formatCurrencyArs(r.amount)}
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4 text-[#374151]">
                      {r.paymentMethod || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
