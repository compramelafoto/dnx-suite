"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AppModal from "@/components/ui/AppModal";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import OrganizerCommissionFinancialCommandCenter from "@/components/admin/OrganizerCommissionFinancialCommandCenter";
import CollaborativeEventSaleBreakdown from "@/components/sales/CollaborativeEventSaleBreakdown";
import type { OrganizerCommissionFinancialDashboard } from "@/lib/admin/organizer-commission-financial-dashboard";
import type { OrganizerFinancialSnapshot } from "@/lib/admin/organizer-commission-financial-dashboard";

type Summary = {
  totalRequested: number;
  totalApproved: number;
  totalPaid: number;
  totalRejected: number;
};

type WithdrawalRow = {
  id: number;
  organizerUserId: number;
  organizerName: string;
  organizerEmail: string;
  amount: number;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedById: number | null;
  reviewedByName: string | null;
  paymentReference: string | null;
  adminNotes: string | null;
  payoutAliasSnapshot: string | null;
  payoutBankSnapshot: string | null;
  payoutAccountHolderSnapshot: string | null;
  hasReceipt: boolean;
  commissionsCount: number;
  organizerTotalGenerated: number;
  organizerTotalPaid: number;
  organizerPendingBalance: number;
  organizerLastWithdrawalAt: string | null;
};

type DetailResponse = {
  request: {
    id: number;
    organizerUserId: number;
    organizerName: string;
    organizerEmail: string;
    amount: number;
    status: string;
    requestedAt: string;
    reviewedAt: string | null;
    reviewedById: number | null;
    reviewedByName: string | null;
    paymentReference: string | null;
    adminNotes: string | null;
    payoutAliasSnapshot: string | null;
    payoutBankSnapshot: string | null;
    payoutAccountHolderSnapshot: string | null;
    payoutReceiptFileName: string | null;
    payoutReceiptMimeType: string | null;
    payoutReceiptUploadedAt: string | null;
    hasReceipt: boolean;
    receiptViewUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
  commissions: {
    id: number;
    orderId: number;
    orderStatus: string;
    orderTotalPaidAmount: number;
    eventId: number;
    eventTitle: string;
    photographerUserId: number;
    photographerName: string;
    albumId: number;
    status: string;
    organizerCommissionPercentage: number;
    photographerBaseAmount: number;
    organizerCommissionAmount: number;
    photographerNetAmount: number;
    totalPaidAmount: number;
    platformFeeAmount: number;
    paidAt: string | null;
    availableAt: string;
    createdAt: string;
  }[];
  organizerFinancial: OrganizerFinancialSnapshot;
};

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Solicitado",
  APPROVED: "Aprobado",
  PAID: "Pagado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En espera",
  AVAILABLE: "Disponible",
  WITHDRAWAL_REQUESTED: "Retiro solicitado",
  PAID: "Liquidado por plataforma",
  PAID_DIRECT_TO_ORGANIZER: "Cobro directo MP (organizador)",
  CANCELLED: "Cancelado",
};

/** Etiquetas compactas para badges en tablas del modal. */
const COMMISSION_STATUS_BADGE_LABELS: Record<string, string> = {
  PENDING: "En espera",
  AVAILABLE: "Disponible",
  WITHDRAWAL_REQUESTED: "En retiro",
  PAID: "Liquidado",
  PAID_DIRECT_TO_ORGANIZER: "Cobro directo MP",
  CANCELLED: "Cancelado",
};

function withdrawalRowBadgeClass(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "APPROVED":
      return "bg-blue-50 text-blue-900 border-blue-200";
    case "PAID":
      return "bg-green-50 text-green-900 border-green-200";
    case "REJECTED":
      return "bg-red-50 text-red-900 border-red-200";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-50 text-gray-800 border-gray-200";
  }
}

function commissionRowBadgeClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "WITHDRAWAL_REQUESTED":
      return "bg-sky-50 text-sky-900 border-sky-200";
    case "PAID":
      return "bg-green-50 text-green-900 border-green-200";
    case "PAID_DIRECT_TO_ORGANIZER":
      return "bg-blue-50 text-blue-900 border-blue-200";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-50 text-gray-800 border-gray-200";
  }
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function dt(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

async function copyText(label: string, text: string): Promise<void> {
  if (!text?.trim()) return;
  try {
    await navigator.clipboard.writeText(text.trim());
    alert(`${label} copiado al portapapeles`);
  } catch {
    alert("No se pudo copiar. Copiá manualmente.");
  }
}

function formatPayoutBlock(req: {
  payoutAccountHolderSnapshot: string | null;
  payoutBankSnapshot: string | null;
  payoutAliasSnapshot: string | null;
}): string {
  return [
    `Titular: ${req.payoutAccountHolderSnapshot ?? "—"}`,
    `Banco / billetera: ${req.payoutBankSnapshot ?? "—"}`,
    `Alias / CBU / CVU: ${req.payoutAliasSnapshot ?? "—"}`,
  ].join("\n");
}

export default function AdminOrganizerCommissionWithdrawalsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dashboard, setDashboard] = useState<OrganizerCommissionFinancialDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [items, setItems] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [organizerIdFilter, setOrganizerIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [markPaidRef, setMarkPaidRef] = useState("");
  const [markPaidNotes, setMarkPaidNotes] = useState("");

  function closeDetailModal() {
    setDetail(null);
    setDetailLoading(false);
  }

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await fetch("/api/admin/organizer-commission-withdrawals/dashboard", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (organizerIdFilter.trim()) params.set("organizerUserId", organizerIdFilter.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minAmount.trim()) params.set("minAmount", minAmount.trim());
      if (maxAmount.trim()) params.set("maxAmount", maxAmount.trim());
      if (search.trim()) params.set("search", search.trim());
      const qs = params.toString();
      const res = await fetch(`/api/admin/organizer-commission-withdrawals${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || "Error cargando listado");
        return;
      }
      const data = await res.json();
      setSummary(data.summary ?? null);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, maxAmount, minAmount, organizerIdFilter, search, statusFilter]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    load();
  }, [load]);

  function refreshAll() {
    void loadDashboard();
    void load();
  }

  async function openDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/organizer-commission-withdrawals/${id}`, { credentials: "include" });
      if (!res.ok) {
        alert("No se pudo cargar el detalle");
        return;
      }
      const data = await res.json();
      setDetail(data);
    } catch {
      alert("Error de conexión");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshAfterAction(withdrawalId: number) {
    await Promise.all([loadDashboard(), load()]);
    if (detail?.request.id === withdrawalId) {
      await openDetail(withdrawalId);
    }
  }

  async function handleApprove(id: number) {
    if (!window.confirm("¿Aprobar esta solicitud? Las comisiones siguen en «Retiro solicitado» hasta marcarlas pagadas.")) {
      return;
    }
    const notes = window.prompt("Notas (opcional):") ?? "";
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/organizer-commission-withdrawals/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Error");
        return;
      }
      alert("Solicitud aprobada.");
      await refreshAfterAction(id);
    } catch {
      alert("Error de conexión");
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(id: number) {
    const notes = window.prompt("Motivo del rechazo (obligatorio, mínimo 3 caracteres):");
    if (!notes || notes.trim().length < 3) {
      alert("Las notas son obligatorias para rechazar.");
      return;
    }
    if (
      !window.confirm(
        "¿Rechazar la solicitud? Las comisiones volverán a «Disponible» para que el organizador pueda solicitar de nuevo."
      )
    ) {
      return;
    }
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/organizer-commission-withdrawals/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Error");
        return;
      }
      alert("Solicitud rechazada.");
      closeDetailModal();
      await load();
    } catch {
      alert("Error de conexión");
    } finally {
      setActionId(null);
    }
  }

  function openMarkPaidModal(id: number) {
    setMarkPaidId(id);
    setMarkPaidRef("");
    setMarkPaidNotes("");
    setMarkPaidOpen(true);
  }

  function closeMarkPaidModal() {
    if (actionId != null) return;
    setMarkPaidOpen(false);
    setMarkPaidId(null);
  }

  async function handleMarkPaidSubmit() {
    const id = markPaidId;
    if (id == null) return;
    const ref = markPaidRef.trim();
    if (ref.length < 2) {
      alert("La referencia de pago es obligatoria (mínimo 2 caracteres).");
      return;
    }
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/organizer-commission-withdrawals/${id}/mark-paid`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentReference: ref,
          adminNotes: markPaidNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Error");
        return;
      }
      alert("Marcado como pagado.");
      setMarkPaidOpen(false);
      setMarkPaidId(null);
      closeDetailModal();
      await load();
    } catch {
      alert("Error de conexión");
    } finally {
      setActionId(null);
    }
  }

  async function uploadReceipt(withdrawalId: number, file: File) {
    setReceiptUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/admin/organizer-commission-withdrawals/${withdrawalId}/receipt`,
        { method: "POST", credentials: "include", body: form }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "No se pudo subir el comprobante");
        return;
      }
      if (detail?.request.id === withdrawalId) {
        setDetail({
          ...detail,
          request: {
            ...detail.request,
            hasReceipt: true,
            payoutReceiptFileName: data.payoutReceiptFileName ?? file.name,
            payoutReceiptMimeType: data.payoutReceiptMimeType ?? file.type,
            payoutReceiptUploadedAt: data.payoutReceiptUploadedAt ?? new Date().toISOString(),
            receiptViewUrl: data.receiptViewUrl ?? detail.request.receiptViewUrl,
          },
        });
      }
      await load();
      alert("Comprobante guardado.");
    } catch {
      alert("Error de conexión al subir comprobante");
    } finally {
      setReceiptUploading(false);
    }
  }

  async function handleCancel(id: number) {
    if (
      !window.confirm(
        "¿Cancelar esta solicitud administrativamente? Las comisiones volverán a «Disponible»."
      )
    ) {
      return;
    }
    const notes = window.prompt("Motivo de la cancelación (opcional):") ?? "";
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/organizer-commission-withdrawals/${id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Error");
        return;
      }
      alert("Solicitud cancelada.");
      closeDetailModal();
      await load();
    } catch {
      alert("Error de conexión");
    } finally {
      setActionId(null);
    }
  }

  function canApprove(status: string) {
    return status === "REQUESTED";
  }
  function canRejectOrCancelOrPay(status: string) {
    return status === "REQUESTED" || status === "APPROVED";
  }

  return (
    <div className="space-y-6 ds-fill-width min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">
            Command center — comisiones organizadores
          </h1>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 mt-1">
            Retiros, deuda pendiente y flujo financiero de comisiones por eventos.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 shrink-0">
          ← Volver al dashboard
        </Link>
      </div>

      <DsInfoPanel title="Proceso de pago">
        <p className="ds-readable-text ds-readable-text--fluid text-gray-700 m-0 mb-2 text-sm">
          Las comisiones del organizador se generan en pesos sobre el precio base del fotógrafo. Con comisión{" "}
          <strong>menor al 100%</strong>, la plataforma retiene la parte del organizador y solo puede cobrarse después de{" "}
          <strong>15 días</strong> desde la aprobación del pago, mediante solicitud de retiro.
        </p>
        <p className="ds-readable-text ds-readable-text--fluid text-gray-600 m-0 text-sm">
          Con comisión del <strong>100%</strong>, el cobro va directo al Mercado Pago del organizador y{" "}
          <strong>no entra</strong> al pipeline de retiros de esta pantalla. Desde acá gestionás solicitudes de retiro
          manual: aprobá o rechazá, cancelá si hace falta, y al transferir marcá como pagado con la{" "}
          <strong>referencia de pago</strong> (obligatoria).
        </p>
      </DsInfoPanel>

      <OrganizerCommissionFinancialCommandCenter data={dashboard} loading={dashboardLoading} />

      <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-0 items-end">
        <div className="min-w-0 w-full">
          <label htmlFor="admin-ocw-status" className="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>
          <Select
            id="admin-ocw-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 text-sm w-full"
          >
            <option value="">Todos</option>
            {Object.entries(WITHDRAWAL_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 w-full">
          <label htmlFor="admin-ocw-organizer-id" className="block text-sm font-medium text-gray-700 mb-1">
            ID organizador
          </label>
          <Input
            id="admin-ocw-organizer-id"
            type="number"
            inputMode="numeric"
            value={organizerIdFilter}
            onChange={(e) => setOrganizerIdFilter(e.target.value)}
            placeholder="Ej. 42"
            className="py-2 text-sm w-full"
          />
        </div>
        <div className="min-w-0 w-full sm:col-span-2">
          <label htmlFor="admin-ocw-search" className="block text-sm font-medium text-gray-700 mb-1">
            Buscar organizador
          </label>
          <Input
            id="admin-ocw-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o email"
            className="py-2 text-sm w-full"
          />
        </div>
        <div className="min-w-0 w-full">
          <label htmlFor="admin-ocw-min-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Monto mín.
          </label>
          <Input
            id="admin-ocw-min-amount"
            type="number"
            min={0}
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="0"
            className="py-2 text-sm w-full"
          />
        </div>
        <div className="min-w-0 w-full">
          <label htmlFor="admin-ocw-max-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Monto máx.
          </label>
          <Input
            id="admin-ocw-max-amount"
            type="number"
            min={0}
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="—"
            className="py-2 text-sm w-full"
          />
        </div>
        <div className="min-w-0 w-full">
            <label htmlFor="admin-ocw-date-from" className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <Input
              id="admin-ocw-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="py-2 text-sm w-full min-w-0"
            />
          </div>
        <div className="min-w-0 w-full">
            <label htmlFor="admin-ocw-date-to" className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <Input
              id="admin-ocw-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="py-2 text-sm w-full min-w-0"
            />
          </div>
        <div className="min-w-0 w-full">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto whitespace-nowrap"
            onClick={refreshAll}
          >
            Actualizar
          </Button>
        </div>
      </div>
      </Card>

      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 border border-gray-200 ds-card">
            <p className="text-xs text-gray-500 m-0">Solicitudes (filtro actual)</p>
            <p className="text-xl font-semibold text-amber-900 m-0 mt-1">{summary.totalRequested}</p>
          </Card>
          <Card className="p-4 border border-gray-200 ds-card">
            <p className="text-xs text-gray-500 m-0">Aprobadas (filtro)</p>
            <p className="text-xl font-semibold text-blue-900 m-0 mt-1">{summary.totalApproved}</p>
          </Card>
          <Card className="p-4 border border-gray-200 ds-card">
            <p className="text-xs text-gray-500 m-0">Pagadas (filtro)</p>
            <p className="text-xl font-semibold text-green-900 m-0 mt-1">{summary.totalPaid}</p>
          </Card>
          <Card className="p-4 border border-gray-200 ds-card">
            <p className="text-xs text-gray-500 m-0">Rechazadas (filtro)</p>
            <p className="text-xl font-semibold text-red-800 m-0 mt-1">{summary.totalRejected}</p>
          </Card>
        </div>
      ) : null}

      <Card className="p-5 sm:p-6 border border-gray-200 shadow-sm ds-card min-w-0">
        {loading ? (
          <p className="text-gray-600 text-sm m-0" role="status">
            Cargando solicitudes…
          </p>
        ) : items.length === 0 ? (
          <DsEmptyState title="No hay solicitudes con estos filtros">
            <p className="ds-readable-text ds-readable-text--fluid text-gray-600 m-0 text-sm">
              Probá cambiar el estado, el rango de fechas o el ID de organizador. Si acaba de llegar una solicitud,
              pulsá <strong>Actualizar</strong>.
            </p>
          </DsEmptyState>
        ) : (
          <div className="ds-table-scroll">
            <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-700">
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Fecha</th>
                  <th className="px-3 py-2 font-semibold min-w-[10rem]">Organizador</th>
                  <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Monto retiro</th>
                  <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Deuda org.</th>
                  <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Pagado org.</th>
                  <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Generado org.</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Últ. retiro</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Estado</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Com.</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{dt(r.requestedAt)}</td>
                    <td className="px-3 py-2 ds-content-container min-w-[10rem]">
                      <div className="font-medium text-gray-900">{r.organizerName}</div>
                      <div className="text-xs text-gray-500">{r.organizerEmail}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-900 whitespace-nowrap tabular-nums">
                      {formatMoney(r.organizerPendingBalance)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-800 whitespace-nowrap tabular-nums">
                      {formatMoney(r.organizerTotalPaid)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {formatMoney(r.organizerTotalGenerated)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {r.organizerLastWithdrawalAt ? dt(r.organizerLastWithdrawalAt) : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${withdrawalRowBadgeClass(r.status)}`}
                      >
                        {WITHDRAWAL_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap text-center">{r.commissionsCount}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2 max-w-[280px] sm:max-w-[320px]">
                        <Button
                          type="button"
                          variant="outline"
                          className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                          onClick={() => void openDetail(r.id)}
                        >
                          Detalle
                        </Button>
                        {canApprove(r.status) && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                            disabled={actionId === r.id}
                            onClick={() => void handleApprove(r.id)}
                          >
                            Aprobar
                          </Button>
                        )}
                        {canRejectOrCancelOrPay(r.status) && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                              disabled={actionId === r.id}
                              onClick={() => void handleReject(r.id)}
                            >
                              Rechazar
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                              disabled={actionId === r.id}
                              onClick={() => openMarkPaidModal(r.id)}
                            >
                              Marcar pagado
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                              disabled={actionId === r.id}
                              onClick={() => void handleCancel(r.id)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AppModal
        open={detail !== null || detailLoading}
        onClose={closeDetailModal}
        title={
          detailLoading ? "Cargando solicitud…" : detail ? `Solicitud #${detail.request.id}` : "Detalle"
        }
        description={
          detail && !detailLoading ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${withdrawalRowBadgeClass(detail.request.status)}`}
            >
              {WITHDRAWAL_STATUS_LABELS[detail.request.status] ?? detail.request.status}
            </span>
          ) : undefined
        }
        size="xl"
        maxWidthCapRem="72rem"
      >
        <div className="p-5 sm:p-6 space-y-4">
          {detailLoading ? (
            <p className="text-gray-600 text-sm m-0" role="status">
              Cargando detalle…
            </p>
          ) : detail ? (
            <>
              <div className="ds-card rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-3">
                <h3 className="text-base font-semibold text-gray-900 m-0">Resumen financiero del organizador</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Total generado</p>
                    <p className="font-semibold text-gray-900 m-0 tabular-nums break-words">
                      {formatMoney(detail.organizerFinancial.totalGenerated)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Cobro directo MP</p>
                    <p className="font-semibold text-blue-900 m-0 tabular-nums break-words">
                      {formatMoney(detail.organizerFinancial.totalDirectMpCollection)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Retenido plataforma</p>
                    <p className="font-semibold text-gray-900 m-0 tabular-nums break-words">
                      {formatMoney(detail.organizerFinancial.totalPlatformHeldGenerated)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Total pagado (retiros)</p>
                    <p className="font-semibold text-emerald-800 m-0 tabular-nums break-words">
                      {formatMoney(detail.organizerFinancial.totalPaid)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Pendiente</p>
                    <p className="font-semibold text-amber-900 m-0 tabular-nums">
                      {formatMoney(detail.organizerFinancial.pendingBalance)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Retenido (espera)</p>
                    <p className="font-semibold m-0 tabular-nums">{formatMoney(detail.organizerFinancial.heldRetained)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Eventos</p>
                    <p className="font-semibold m-0">{detail.organizerFinancial.eventsCount}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Ventas con comisión</p>
                    <p className="font-semibold m-0">{detail.organizerFinancial.salesCount}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Comisión promedio</p>
                    <p className="font-semibold m-0 tabular-nums">
                      {formatMoney(detail.organizerFinancial.averageCommission)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 m-0">Último retiro pagado</p>
                    <p className="font-semibold m-0 text-xs">
                      {detail.organizerFinancial.lastWithdrawalAt
                        ? dt(detail.organizerFinancial.lastWithdrawalAt)
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm ds-content-container">
                <p className="m-0 ds-readable-text">
                  <span className="text-gray-500">Organizador:</span> {detail.request.organizerName} (
                  {detail.request.organizerEmail})
                </p>
                <p className="m-0 ds-readable-text">
                  <span className="text-gray-500">Monto:</span>{" "}
                  <strong className="tabular-nums">{formatMoney(detail.request.amount)}</strong>
                </p>
                <p className="m-0 ds-readable-text">
                  <span className="text-gray-500">Solicitado:</span> {dt(detail.request.requestedAt)}
                </p>
                <p className="m-0 ds-readable-text">
                  <span className="text-gray-500">Revisado:</span>{" "}
                  {detail.request.reviewedAt ? dt(detail.request.reviewedAt) : "—"}
                </p>
              <div className="sm:col-span-2 ds-card rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="text-base font-semibold text-gray-900 m-0">Datos para transferencia</h3>
                  {detail.request.payoutAliasSnapshot ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs whitespace-nowrap"
                        onClick={() =>
                          void copyText("Alias", detail.request.payoutAliasSnapshot ?? "")
                        }
                      >
                        Copiar alias
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs whitespace-nowrap"
                        onClick={() => void copyText("Datos", formatPayoutBlock(detail.request))}
                      >
                        Copiar datos
                      </Button>
                    </div>
                  ) : null}
                </div>
                {detail.request.payoutAliasSnapshot ? (
                  <dl className="m-0 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-gray-500 m-0">Titular</dt>
                      <dd className="font-medium text-gray-900 m-0 mt-0.5">
                        {detail.request.payoutAccountHolderSnapshot}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 m-0">Banco / billetera</dt>
                      <dd className="font-medium text-gray-900 m-0 mt-0.5">{detail.request.payoutBankSnapshot}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500 m-0">Alias / CBU / CVU</dt>
                      <dd className="font-medium text-gray-900 m-0 mt-0.5 tabular-nums break-all">
                        {detail.request.payoutAliasSnapshot}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-600 m-0 ds-readable-text">
                    Esta solicitud no tiene datos de cuenta (creada antes de registrar alias/CBU).
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 ds-card rounded-xl border border-violet-100 bg-violet-50/30 p-4 space-y-3">
                <h3 className="text-base font-semibold text-gray-900 m-0">Comprobante de pago</h3>
                {detail.request.hasReceipt && detail.request.receiptViewUrl ? (
                  <div className="space-y-2 text-sm">
                    <p className="m-0 text-gray-700">
                      <span className="text-gray-500">Archivo:</span>{" "}
                      {detail.request.payoutReceiptFileName ?? "comprobante"}
                    </p>
                    {detail.request.payoutReceiptUploadedAt ? (
                      <p className="m-0 text-gray-600 text-xs">
                        Subido: {dt(detail.request.payoutReceiptUploadedAt)}
                      </p>
                    ) : null}
                    <a
                      href={detail.request.receiptViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[#c27b3d] underline font-medium"
                    >
                      Ver comprobante
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 m-0">Todavía no hay comprobante cargado.</p>
                )}
                {(detail.request.status === "REQUESTED" ||
                  detail.request.status === "APPROVED" ||
                  detail.request.status === "PAID") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {detail.request.hasReceipt ? "Actualizar comprobante" : "Subir comprobante"}{" "}
                      <span className="font-normal text-gray-500">(JPG, PNG o PDF, máx. 10 MB)</span>
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,application/pdf"
                      disabled={receiptUploading}
                      className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#c27b3d] file:text-white hover:file:bg-[#a86a32] disabled:opacity-50"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadReceipt(detail.request.id, file);
                      }}
                    />
                    {receiptUploading ? (
                      <p className="text-xs text-gray-500 mt-2 m-0">Subiendo…</p>
                    ) : null}
                  </div>
                )}
              </div>

                <p className="m-0 sm:col-span-2 ds-readable-text break-all">
                  <span className="text-gray-500">Referencia pago (manual):</span>{" "}
                  {detail.request.paymentReference || "—"}
                </p>
                <p className="m-0 sm:col-span-2 ds-readable-text whitespace-pre-wrap">
                  <span className="text-gray-500">Notas:</span> {detail.request.adminNotes || "—"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {canApprove(detail.request.status) && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                    disabled={actionId === detail.request.id}
                    onClick={() => void handleApprove(detail.request.id)}
                  >
                    Aprobar
                  </Button>
                )}
                {canRejectOrCancelOrPay(detail.request.status) && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                      disabled={actionId === detail.request.id}
                      onClick={() => void handleReject(detail.request.id)}
                    >
                      Rechazar
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                      disabled={actionId === detail.request.id}
                      onClick={() => openMarkPaidModal(detail.request.id)}
                    >
                      Marcar pagado
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap shrink-0 text-xs px-3 py-2"
                      disabled={actionId === detail.request.id}
                      onClick={() => void handleCancel(detail.request.id)}
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>

              <div className="min-w-0 pt-2 border-t border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 m-0 mb-3">Comisiones incluidas</h3>
                <div className="ds-table-scroll rounded-xl border border-gray-200">
                  <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr className="text-gray-700">
                        <th className="px-3 py-2 font-semibold whitespace-nowrap">Pedido</th>
                        <th className="px-3 py-2 font-semibold">Evento</th>
                        <th className="px-3 py-2 font-semibold">Fotógrafo</th>
                        <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Cliente pagó</th>
                        <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Base fotógr.</th>
                        <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Comisión org.</th>
                        <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Neto fotógr.</th>
                        <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Retiene plataforma</th>
                        <th className="px-3 py-2 font-semibold whitespace-nowrap">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.commissions.map((c) => (
                        <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-800">#{c.orderId}</td>
                          <td className="px-3 py-2 ds-content-container max-w-[200px]">
                            <span className="ds-readable-text">{c.eventTitle}</span>
                          </td>
                          <td className="px-3 py-2 ds-content-container max-w-[180px]">
                            <span className="ds-readable-text">{c.photographerName}</span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                            {formatMoney(c.totalPaidAmount)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                            {formatMoney(c.photographerBaseAmount)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                            {formatMoney(c.organizerCommissionAmount)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                            {formatMoney(c.photographerNetAmount)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-gray-700">
                            {formatMoney(c.platformFeeAmount + c.organizerCommissionAmount)}
                          </td>
                          <td className="px-3 py-2 align-top min-w-[7.5rem] max-w-[10rem]">
                            <span
                              className={`inline-flex max-w-full items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-normal leading-snug ${commissionRowBadgeClass(c.status)}`}
                              title={COMMISSION_STATUS_LABELS[c.status] ?? c.status}
                            >
                              {COMMISSION_STATUS_BADGE_LABELS[c.status] ??
                                COMMISSION_STATUS_LABELS[c.status] ??
                                c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={markPaidOpen}
        onClose={closeMarkPaidModal}
        title="Marcar retiro como pagado"
        size="md"
      >
        <div className="p-5 sm:p-6 space-y-4 min-w-0">
          <div>
            <label htmlFor="mark-paid-ref" className="block text-sm font-medium text-gray-700 mb-1">
              Referencia de pago (obligatoria)
            </label>
            <Input
              id="mark-paid-ref"
              value={markPaidRef}
              onChange={(e) => setMarkPaidRef(e.target.value)}
              placeholder="Ej: transferencia #12345"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="mark-paid-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales (opcional)
            </label>
            <Input
              id="mark-paid-notes"
              value={markPaidNotes}
              onChange={(e) => setMarkPaidNotes(e.target.value)}
              placeholder="Observaciones internas"
              className="w-full"
            />
          </div>
          <p className="text-sm text-gray-600 m-0">
            Las comisiones incluidas pasarán a estado «Pagado». Podés subir el comprobante antes o después desde el
            detalle de la solicitud.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="md" onClick={closeMarkPaidModal} disabled={actionId != null}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={actionId != null}
              onClick={() => void handleMarkPaidSubmit()}
            >
              {actionId != null ? "Guardando…" : "Confirmar pago"}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
