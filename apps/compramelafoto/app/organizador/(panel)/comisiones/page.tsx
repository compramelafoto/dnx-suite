"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import { ensureOrganizerSession } from "@/lib/organizer-session-client";
import { DsDashboardInner, DsInfoPanel, DsPageShell } from "@/components/ui/DsLayout";
import { DsField } from "@/components/ui/DsField";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import OrganizerPayoutSettingsSection from "@/components/organizer/OrganizerPayoutSettingsSection";
import CollaborativeEventSaleBreakdown from "@/components/sales/CollaborativeEventSaleBreakdown";
import { validateOrganizerPayoutSettingsFieldsClient } from "@/lib/organizer-withdrawal-payout-fields";

const TZ = "America/Argentina/Buenos_Aires";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En espera",
  AVAILABLE: "Disponible",
  WITHDRAWAL_REQUESTED: "Retiro solicitado",
  PAID: "Liquidado por plataforma",
  PAID_DIRECT_TO_ORGANIZER: "Cobrado en tu Mercado Pago",
  CANCELLED: "Cancelado",
};

/** Etiquetas compactas para badges en tablas (evita overflow). */
const STATUS_BADGE_LABELS: Record<string, string> = {
  PENDING: "En espera",
  AVAILABLE: "Disponible",
  WITHDRAWAL_REQUESTED: "En retiro",
  PAID: "Liquidado",
  PAID_DIRECT_TO_ORGANIZER: "Cobro directo MP",
  CANCELLED: "Cancelado",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

type Summary = {
  totalPending: number;
  totalAvailable: number;
  totalPaid: number;
  totalDirectMpCollection: number;
  totalPlatformHeldGenerated: number;
  totalGenerated: number;
  totalWithdrawable: number;
};

type CommissionItem = {
  commissionId: number;
  orderId: number;
  eventId: number;
  eventTitle: string;
  photographerUserId: number;
  photographerName: string;
  albumId: number;
  organizerCommissionPercentage: number;
  photographerBaseAmount: number;
  organizerCommissionAmount: number;
  photographerNetAmount: number;
  totalPaidAmount: number;
  platformFeeAmount: number;
  status: string;
  statusLabel?: string;
  payoutMode: string;
  collectionType?: string;
  collectionTypeLabel?: string;
  availableAt: string;
  paidAt: string | null;
  createdAt: string;
};

function formatMoneyARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}%`;
}

function withdrawalStatusBadgeClass(status: string): string {
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

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Solicitado",
  APPROVED: "Aprobado",
  PAID: "Pagado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

type WithdrawalRequestRow = {
  id: number;
  amount: number;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  adminNotes: string | null;
  paymentReference: string | null;
  payoutAliasSnapshot: string | null;
  payoutBankSnapshot: string | null;
  payoutAccountHolderSnapshot: string | null;
  hasReceipt: boolean;
  receiptViewUrl: string | null;
  payoutReceiptFileName: string | null;
  commissionsIncluded: number;
};

function FeedbackBanner({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 text-sm ${
        type === "success" ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-800"
      }`}
      role="status"
    >
      {text}
    </div>
  );
}

function statusBadgeClass(status: string): string {
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

export default function OrganizadorComisionesPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ organizerId: number; name?: string | null; email?: string | null } | null>(
    null
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<CommissionItem[]>([]);
  const [events, setEvents] = useState<{ id: number; title: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestRow[]>([]);
  const [withdrawalListLoading, setWithdrawalListLoading] = useState(true);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedCommissionId, setExpandedCommissionId] = useState<number | null>(null);
  const [payoutAlias, setPayoutAlias] = useState("");
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");
  const [payoutSettingsLoading, setPayoutSettingsLoading] = useState(true);
  const [payoutSettingsSaving, setPayoutSettingsSaving] = useState(false);
  const [payoutSettingsComplete, setPayoutSettingsComplete] = useState(false);
  const [payoutSettingsFeedback, setPayoutSettingsFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [payoutFieldErrors, setPayoutFieldErrors] = useState<{
    payoutAlias?: string;
    payoutBank?: string;
    payoutAccountHolder?: string;
  }>({});
  const [expandedWithdrawalId, setExpandedWithdrawalId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function auth() {
      const s = await ensureOrganizerSession();
      if (!active) return;
      if (!s) {
        router.push("/login");
        return;
      }
      setSession(s);
      setAuthLoading(false);
    }
    auth();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (authLoading || !session) return;
    let active = true;
    fetch("/api/organizer/events", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setEvents(list.map((e: { id: number; title: string }) => ({ id: e.id, title: e.title })));
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [authLoading, session]);

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (eventFilter) params.set("eventId", eventFilter);
      const qs = params.toString();
      const res = await fetch(`/api/organizer/commissions${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "No se pudieron cargar las comisiones");
        setSummary(null);
        setItems([]);
        return;
      }
      const data = await res.json();
      setSummary(data.summary ?? null);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Error de conexión");
      setSummary(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [eventFilter, router, statusFilter]);

  const loadPayoutSettings = useCallback(async () => {
    setPayoutSettingsLoading(true);
    try {
      const res = await fetch("/api/organizer/payout-settings", { credentials: "include" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setPayoutSettingsComplete(false);
        return;
      }
      const data = await res.json();
      setPayoutAlias(data.payoutAlias ?? "");
      setPayoutBank(data.payoutBank ?? "");
      setPayoutAccountHolder(data.payoutAccountHolder ?? "");
      setPayoutSettingsComplete(Boolean(data.isComplete));
    } catch {
      setPayoutSettingsComplete(false);
    } finally {
      setPayoutSettingsLoading(false);
    }
  }, [router]);

  const loadWithdrawalRequests = useCallback(async () => {
    setWithdrawalListLoading(true);
    try {
      const res = await fetch("/api/organizer/commissions/withdrawal-requests", {
        credentials: "include",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setWithdrawalRequests([]);
        return;
      }
      const data = await res.json();
      setWithdrawalRequests(Array.isArray(data.items) ? data.items : []);
    } catch {
      setWithdrawalRequests([]);
    } finally {
      setWithdrawalListLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading || !session) return;
    loadPayoutSettings();
    loadWithdrawalRequests();
  }, [authLoading, session, loadPayoutSettings, loadWithdrawalRequests]);

  useEffect(() => {
    if (authLoading || !session) return;
    loadCommissions();
  }, [authLoading, session, loadCommissions]);

  const totalWithdrawable = summary ? summary.totalWithdrawable ?? 0 : 0;

  async function savePayoutSettings() {
    setPayoutSettingsFeedback(null);
    const validation = validateOrganizerPayoutSettingsFieldsClient({
      payoutAlias,
      payoutBank,
      payoutAccountHolder,
    });
    if (!validation.valid) {
      setPayoutFieldErrors(validation.errors);
      return;
    }
    setPayoutFieldErrors({});
    setPayoutSettingsSaving(true);
    try {
      const res = await fetch("/api/organizer/payout-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutAlias: payoutAlias.trim(),
          payoutBank: payoutBank.trim(),
          payoutAccountHolder: payoutAccountHolder.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setPayoutSettingsFeedback({
          type: "error",
          text: body?.error ?? "No se pudieron guardar los datos.",
        });
        return;
      }
      setPayoutSettingsComplete(Boolean(body.isComplete));
      setPayoutSettingsFeedback({ type: "success", text: "Datos bancarios guardados correctamente." });
    } catch {
      setPayoutSettingsFeedback({ type: "error", text: "Error de conexión al guardar." });
    } finally {
      setPayoutSettingsSaving(false);
    }
  }

  async function submitWithdrawalRequest() {
    setWithdrawFeedback(null);
    if (totalWithdrawable <= 0) return;
    if (!payoutSettingsComplete) {
      setWithdrawFeedback({
        type: "error",
        text: "Antes de solicitar un retiro necesitás configurar una cuenta de cobro.",
      });
      return;
    }
    if (
      !window.confirm(
        `¿Confirmás la solicitud de retiro por ${formatMoneyARS(totalWithdrawable)}?\n\nSe incluirán todas las comisiones disponibles que ya pueden retirarse.`
      )
    ) {
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await fetch("/api/organizer/commissions/withdrawal-request", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setWithdrawFeedback({
          type: "error",
          text: body?.error ?? "No se pudo crear la solicitud.",
        });
        return;
      }
      setWithdrawFeedback({
        type: "success",
        text: `Solicitud registrada (${formatMoneyARS(Number(body.amount ?? 0))}, ${Number(body.commissionsCount ?? 0)} comisión(es)).`,
      });
      await Promise.all([loadCommissions(), loadWithdrawalRequests()]);
    } catch {
      setWithdrawFeedback({ type: "error", text: "Error de conexión al solicitar el retiro." });
    } finally {
      setWithdrawSubmitting(false);
    }
  }

  if (!session && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader
        organizer={session ? { organizerId: session.organizerId, name: session.name, email: session.email } : null}
      />
      <DsPageShell className="py-6 md:py-8 flex-1 w-full min-w-0">
        <DsDashboardInner className="ds-stack-section">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 m-0">Comisiones por eventos</h1>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 mt-2 m-0 max-w-3xl">
              Seguí tus comisiones por venta, configurá tu cuenta de cobro y solicitá retiros cuando el saldo esté
              disponible.
            </p>
          </div>

          <DsInfoPanel title="Información importante">
            <p className="ds-readable-text ds-readable-text--fluid text-gray-700 m-0 mb-2">
              Las comisiones se calculan en pesos sobre el <strong>precio base</strong> que define cada fotógrafo por foto.
            </p>
            <ul className="ds-readable-text ds-readable-text--fluid text-gray-700 m-0 pl-5 space-y-2 text-sm list-disc">
              <li>
                Con comisión <strong>menor al 100%</strong>, el cobro entra al Mercado Pago del fotógrafo. Tu parte queda
                en espera y se habilita para retiro <strong>15 días después</strong> del pago aprobado.
              </li>
              <li>
                Con comisión del <strong>100%</strong>, el cobro va directo a tu Mercado Pago conectado: aparece como{" "}
                <strong>cobro directo MP</strong> y <strong>no suma</strong> al saldo de retiro manual.
              </li>
            </ul>
            <p className="ds-readable-text ds-readable-text--fluid text-gray-600 m-0 mt-3 text-sm">
              El retiro manual solo aplica a comisiones retenidas por la plataforma. Solicitás el pago desde esta pantalla
              cuando haya saldo disponible; el equipo lo revisa y acredita con referencia de pago.
            </p>
          </DsInfoPanel>

          <Card className="p-5 sm:p-6 border border-gray-200 shadow-sm ds-card">
            <h2 className="text-sm font-semibold text-gray-900 m-0 mb-4">Filtrar movimientos</h2>
            <div className="ds-form-grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
              <DsField label="Estado" htmlFor="commission-status">
                <Select
                  id="commission-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </DsField>
              <DsField label="Evento" htmlFor="commission-event">
                <Select
                  id="commission-event"
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                >
                  <option value="">Todos los eventos</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.title}
                    </option>
                  ))}
                </Select>
              </DsField>
            </div>
          </Card>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm" role="alert">
              {error}
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 min-w-0">
              <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card min-w-0">
                <p className="text-sm text-gray-500 mb-1 m-0">Total registrado</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-900 tabular-nums break-words">
                  {formatMoneyARS(summary.totalGenerated)}
                </p>
                <p className="text-xs text-gray-400 mt-1 m-0">Retenido + cobro directo MP</p>
              </Card>
              <Card className="p-4 sm:p-5 border border-blue-200 shadow-sm ds-card bg-blue-50/30 min-w-0">
                <p className="text-sm text-gray-500 mb-1 m-0">Cobrado en tu MP</p>
                <p className="text-lg sm:text-xl font-semibold text-blue-900 tabular-nums break-words">
                  {formatMoneyARS(summary.totalDirectMpCollection ?? 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1 m-0">Comisión 100% — sin retiro manual</p>
              </Card>
              <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card min-w-0">
                <p className="text-sm text-gray-500 mb-1 m-0">Pendiente (plataforma)</p>
                <p className="text-lg sm:text-xl font-semibold text-amber-900 tabular-nums break-words">
                  {formatMoneyARS(summary.totalPending)}
                </p>
              </Card>
              <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card ring-1 ring-emerald-100 min-w-0">
                <p className="text-sm text-gray-500 mb-1 m-0">Disponible para retiro</p>
                <p className="text-lg sm:text-xl font-semibold text-emerald-900 tabular-nums break-words">
                  {formatMoneyARS(summary.totalAvailable)}
                </p>
                <p className="text-xs text-gray-400 mt-1 m-0">
                  Listas ahora: {formatMoneyARS(totalWithdrawable)}
                </p>
              </Card>
              <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card min-w-0 sm:col-span-2 lg:col-span-1">
                <p className="text-sm text-gray-500 mb-1 m-0">Liquidado por plataforma</p>
                <p className="text-lg sm:text-xl font-semibold text-green-900 tabular-nums break-words">
                  {formatMoneyARS(summary.totalPaid)}
                </p>
                <p className="text-xs text-gray-400 mt-1 m-0">Retiros ya transferidos</p>
              </Card>
            </div>
          )}

          {summary && (
            <OrganizerPayoutSettingsSection
              payoutAlias={payoutAlias}
              payoutBank={payoutBank}
              payoutAccountHolder={payoutAccountHolder}
              loading={payoutSettingsLoading}
              saving={payoutSettingsSaving}
              isComplete={payoutSettingsComplete}
              fieldErrors={payoutFieldErrors}
              feedback={payoutSettingsFeedback}
              onAliasChange={(v) => {
                setPayoutAlias(v);
                if (payoutFieldErrors.payoutAlias) {
                  setPayoutFieldErrors((e) => ({ ...e, payoutAlias: undefined }));
                }
              }}
              onBankChange={(v) => {
                setPayoutBank(v);
                if (payoutFieldErrors.payoutBank) {
                  setPayoutFieldErrors((e) => ({ ...e, payoutBank: undefined }));
                }
              }}
              onHolderChange={(v) => {
                setPayoutAccountHolder(v);
                if (payoutFieldErrors.payoutAccountHolder) {
                  setPayoutFieldErrors((e) => ({ ...e, payoutAccountHolder: undefined }));
                }
              }}
              onSave={() => void savePayoutSettings()}
            />
          )}

          {summary && (
            <Card className="p-5 sm:p-6 border border-gray-200 shadow-sm ds-card w-full min-w-0 self-stretch">
              <div className="ds-stack-section space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 m-0 mb-1">Solicitar retiro</h2>
                  <p className="ds-readable-text ds-readable-text--fluid text-gray-600 text-sm m-0">
                    Vas a solicitar el retiro de <strong>todas</strong> las comisiones disponibles que ya pueden
                    retirarse (estado &quot;Disponible&quot; y fecha de disponibilidad cumplida). No podés elegir un
                    subconjunto.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-1">Monto a retirar ahora</p>
                  <p className="text-2xl font-bold text-emerald-900 m-0 tabular-nums">{formatMoneyARS(totalWithdrawable)}</p>
                </div>
                {!payoutSettingsLoading && !payoutSettingsComplete ? (
                  <p className="ds-readable-text text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 m-0">
                    Antes de solicitar un retiro necesitás configurar una cuenta de cobro en la sección anterior.
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 w-full sm:max-w-md">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={
                      totalWithdrawable <= 0 ||
                      withdrawSubmitting ||
                      loading ||
                      payoutSettingsLoading ||
                      !payoutSettingsComplete
                    }
                    onClick={() => void submitWithdrawalRequest()}
                    className="w-full whitespace-nowrap"
                  >
                    {withdrawSubmitting ? "Enviando…" : "Solicitar retiro"}
                  </Button>
                  {totalWithdrawable <= 0 && !loading ? (
                    <p className="ds-readable-text text-xs text-gray-500 m-0 text-center">
                      No hay montos listos para retiro en este momento.
                    </p>
                  ) : null}
                </div>
                {withdrawFeedback ? (
                  <FeedbackBanner type={withdrawFeedback.type} text={withdrawFeedback.text} />
                ) : null}
              </div>
            </Card>
          )}

          <Card className="p-5 sm:p-6 border border-gray-200 shadow-sm ds-card">
            <h2 className="text-lg font-semibold text-gray-900 m-0 mb-4">Solicitudes de retiro</h2>
            {withdrawalListLoading ? (
              <p className="text-gray-600 text-sm m-0">Cargando solicitudes...</p>
            ) : withdrawalRequests.length === 0 ? (
              <DsEmptyState title="No registraste solicitudes de retiro">
                <p className="ds-readable-text ds-readable-text--fluid text-gray-600 m-0">
                  Cuando solicites un retiro, vas a ver acá el historial con el estado y los datos que cargue el equipo.
                </p>
              </DsEmptyState>
            ) : (
              <div className="ds-table-scroll">
                <table className="min-w-[960px] w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700">
                      <th className="px-3 py-2 font-semibold whitespace-nowrap">Fecha</th>
                      <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Monto</th>
                      <th className="px-3 py-2 font-semibold whitespace-nowrap">Estado</th>
                      <th className="px-3 py-2 font-semibold">Cuenta</th>
                      <th className="px-3 py-2 font-semibold whitespace-nowrap">Comisiones</th>
                      <th className="px-3 py-2 font-semibold">Referencia de pago</th>
                      <th className="px-3 py-2 font-semibold whitespace-nowrap">Comprobante</th>
                      <th className="px-3 py-2 font-semibold">Notas del equipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalRequests.map((wr) => (
                      <Fragment key={wr.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                          {new Date(wr.requestedAt).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: TZ,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{formatMoneyARS(wr.amount)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${withdrawalStatusBadgeClass(wr.status)}`}
                          >
                            {WITHDRAWAL_STATUS_LABELS[wr.status] ?? wr.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 ds-content-container min-w-[140px]">
                          {wr.payoutAliasSnapshot ? (
                            <div className="space-y-0.5">
                              <p className="m-0 text-xs text-gray-500 truncate" title={wr.payoutBankSnapshot ?? ""}>
                                {wr.payoutBankSnapshot ?? "—"}
                              </p>
                              <p className="m-0 font-medium tabular-nums">{wr.payoutAliasSnapshot}</p>
                              <button
                                type="button"
                                className="text-xs text-[#c27b3d] underline"
                                onClick={() =>
                                  setExpandedWithdrawalId((prev) => (prev === wr.id ? null : wr.id))
                                }
                              >
                                {expandedWithdrawalId === wr.id ? "Ocultar" : "Ver titular"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Sin datos (solicitud anterior)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{wr.commissionsIncluded}</td>
                        <td className="px-3 py-2 text-gray-700 ds-content-container">
                          {wr.paymentReference ? (
                            <span className="break-all">{wr.paymentReference}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {wr.status === "PAID" && wr.hasReceipt && wr.receiptViewUrl ? (
                            <a
                              href={wr.receiptViewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#c27b3d] underline font-medium"
                            >
                              Ver comprobante
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 ds-content-container max-w-[280px]">
                          {wr.adminNotes ? (
                            <span className="ds-readable-text">{wr.adminNotes}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                      {expandedWithdrawalId === wr.id && wr.payoutAccountHolderSnapshot ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-2 bg-gray-50 text-sm text-gray-700">
                            <span className="text-gray-500">Titular:</span>{" "}
                            <span className="font-medium">{wr.payoutAccountHolderSnapshot}</span>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm ds-card">
            {loading ? (
              <div className="p-12 text-center text-gray-600">Cargando movimientos...</div>
            ) : items.length === 0 ? (
              <div className="p-8">
                <DsEmptyState title="Todavía no hay comisiones registradas">
                  <p className="ds-readable-text text-gray-600 m-0">
                    Cuando un cliente compre fotos en un álbum vinculado a tu evento y el pago se acredite, vas a ver
                    acá el detalle por venta. Podés filtrar por estado o por evento cuando haya movimientos.
                  </p>
                </DsEmptyState>
              </div>
            ) : (
              <div className="ds-table-scroll">
                <table className="min-w-[1100px] w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Evento</th>
                      <th className="px-4 py-3 font-semibold">Fotógrafo</th>
                      <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Cliente pagó</th>
                      <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Base fotógrafo</th>
                      <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">%</th>
                      <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Tu comisión</th>
                      <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Neto fotógrafo</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Detalle</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Estado</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Disponible desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <Fragment key={row.commissionId}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: TZ,
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-900 min-w-[140px] ds-content-container">
                          <span className="block truncate max-w-[240px]" title={row.eventTitle}>
                            {row.eventTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 min-w-[120px] ds-content-container">
                          <span className="block truncate max-w-[200px]" title={row.photographerName}>
                            {row.photographerName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap tabular-nums">
                          {formatMoneyARS(row.totalPaidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap tabular-nums">
                          {formatMoneyARS(row.photographerBaseAmount)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                          {formatPct(row.organizerCommissionPercentage)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-violet-900 whitespace-nowrap tabular-nums">
                          {formatMoneyARS(row.organizerCommissionAmount)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap tabular-nums">
                          {formatMoneyARS(row.photographerNetAmount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            className="text-xs text-[#c27b3d] underline"
                            onClick={() =>
                              setExpandedCommissionId((prev) =>
                                prev === row.commissionId ? null : row.commissionId
                              )
                            }
                          >
                            {expandedCommissionId === row.commissionId ? "Ocultar" : "Ver"}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top min-w-[8.5rem] max-w-[11rem]">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span
                              className={`inline-flex max-w-full items-center px-2 py-1 rounded-full text-xs font-medium border whitespace-normal leading-snug ${statusBadgeClass(row.status)}`}
                              title={row.statusLabel ?? STATUS_LABELS[row.status] ?? row.status}
                            >
                              {STATUS_BADGE_LABELS[row.status] ??
                                row.statusLabel ??
                                STATUS_LABELS[row.status] ??
                                row.status}
                            </span>
                            {row.collectionTypeLabel ? (
                              <span className="text-[11px] text-gray-500 leading-snug">
                                {row.collectionTypeLabel}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {row.status === "PAID_DIRECT_TO_ORGANIZER" ? (
                            <span className="text-gray-500 text-xs">Al cobrar en tu MP</span>
                          ) : (
                            new Date(row.availableAt).toLocaleString("es-AR", {
                              dateStyle: "short",
                              timeStyle: "short",
                              timeZone: TZ,
                            })
                          )}
                        </td>
                      </tr>
                      {expandedCommissionId === row.commissionId ? (
                        <tr key={`${row.commissionId}-detail`}>
                          <td colSpan={10} className="px-4 py-3 bg-violet-50/40">
                            <CollaborativeEventSaleBreakdown
                              breakdown={{
                                active: true,
                                eventId: row.eventId,
                                eventTitle: row.eventTitle,
                                organizerCommissionPercentage: row.organizerCommissionPercentage,
                                totalPaidAmount: row.totalPaidAmount,
                                photographerBaseAmount: row.photographerBaseAmount,
                                organizerCommissionAmount: row.organizerCommissionAmount,
                                platformFeeAmount: row.platformFeeAmount,
                                photographerNetAmount: row.photographerNetAmount,
                              }}
                              variant="compact"
                              audience="organizer"
                            />
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
