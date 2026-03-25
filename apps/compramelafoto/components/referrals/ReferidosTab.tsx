"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";
import QRCode from "qrcode";
import { REFERRAL_TERMS_TEXT } from "@/lib/terms/referralTerms";

function GiftIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="8" y="28" width="48" height="32" rx="2" fill="#F97316" opacity="0.2" stroke="#F97316" strokeWidth="2" />
      <path d="M32 28v32M18 28h28M32 28c0-6 4-12 10-12 4 0 6 2 6 6s-2 6-6 6H32M32 28c0-6-4-12-10-12-4 0-6 2-6 6s2 6 6 6h10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      <rect x="26" y="14" width="12" height="6" rx="1" fill="#F97316" />
      <path d="M32 20v8M28 18l4 2 4-2" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyReferralsIllu({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="48" cy="48" r="44" fill="#FEF3C7" />
      <circle cx="48" cy="42" r="14" fill="#FCD34D" opacity="0.8" />
      <path d="M32 56c0-8 6-14 16-14s16 6 16 14" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M24 70c0-12 10-20 24-20s24 8 24 20" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
      <circle cx="36" cy="38" r="4" fill="#F97316" />
      <circle cx="60" cy="38" r="4" fill="#F97316" />
      <path d="M48 28v4M48 52v6" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="48" cy="72" rx="20" ry="6" fill="#FDE68A" opacity="0.6" />
    </svg>
  );
}

function ShareLinkIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="1.5" />
      <path d="M20 12v16M12 20h16" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 26l6-6 6 6M14 14l6 6 6-6" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ReferredRow = {
  id: number;
  maskedEmail: string;
  maskedName: string;
  createdAt: string;
  status: string;
  salesCount: number;
};

type PayoutRequestRow = {
  id: number;
  amountCents: number;
  status: string;
  requestedAt: string;
  paidAt: string | null;
};

type ReferidosTabProps = {
  /** Ruta para conectar Mercado Pago (ej: /fotografo/configuracion?tab=mercadopago o /lab/configuracion/mercadopago) */
  mercadopagoLink?: string;
};

type ReferralsData = {
  mpConnected: boolean;
  cbu?: string | null;
  cbuTitular?: string | null;
  referralCode: { code: string; url: string } | null;
  totalReferred: number;
  referred: ReferredRow[];
  balanceCents?: number;
  totalPaidCents?: number;
  payoutRequests?: PayoutRequestRow[];
};

export default function ReferidosTab({ mercadopagoLink = "/fotografo/configuracion?tab=mercadopago" }: ReferidosTabProps) {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [creating, setCreating] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [cbuInput, setCbuInput] = useState("");
  const [cbuTitularInput, setCbuTitularInput] = useState("");
  const [savingCbu, setSavingCbu] = useState(false);
  const [cbuSaved, setCbuSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals/me", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Error cargando referidos");
      }
      const json = await res.json();
      setData(json);
      setCbuInput(json.cbu ?? "");
      setCbuTitularInput(json.cbuTitular ?? "");
      if (json.referralCode === null && json.mpConnected) {
        createCodeAfterLoad();
      }
    } catch (e: any) {
      setError(e?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  async function createCodeAfterLoad() {
    setCreating(true);
    try {
      const res = await fetch("/api/referrals/me", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev) =>
          prev ? { ...prev, referralCode: json.referralCode } : null
        );
      }
    } catch {
      setError("No se pudo crear el código de referido");
    } finally {
      setCreating(false);
    }
  }

  function copyLink() {
    if (!data?.referralCode?.url || !data.mpConnected) return;
    navigator.clipboard.writeText(data.referralCode.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function downloadQR() {
    if (!data?.referralCode?.url || !data.mpConnected) return;
    try {
      const dataUrl = await QRCode.toDataURL(data.referralCode.url, {
        width: 256,
        margin: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `compramelafoto-ref-${data.referralCode.code}.png`;
      a.click();
    } catch (err) {
      console.error("Error generando QR:", err);
    }
  }

  async function saveCbu() {
    setCbuSaved(false);
    setSavingCbu(true);
    try {
      const res = await fetch("/api/referrals/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cbu: cbuInput.trim() || null,
          cbuTitular: cbuTitularInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Error guardando");
      }
      const json = await res.json();
      setData((prev) => (prev ? { ...prev, cbu: json.cbu, cbuTitular: json.cbuTitular } : null));
      setCbuSaved(true);
      setTimeout(() => setCbuSaved(false), 3000);
    } catch (e: any) {
      setPayoutMessage(e?.message || "Error al guardar CBU");
    } finally {
      setSavingCbu(false);
    }
  }

  async function requestPayout() {
    setPayoutMessage(null);
    setRequestingPayout(true);
    try {
      const res = await fetch("/api/referrals/me/request-payout", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayoutMessage(json?.error || "Error al solicitar cobro");
        return;
      }
      setPayoutMessage(json?.message || "Solicitud enviada.");
      load();
    } catch {
      setPayoutMessage("Error de conexión.");
    } finally {
      setRequestingPayout(false);
    }
  }

  const balanceCents = data?.balanceCents ?? 0;
  const totalPaidCents = data?.totalPaidCents ?? 0;
  const hasPendingPayout = (data?.payoutRequests ?? []).some((r) => r.status === "PENDING");
  const hasCbuData = !!(data?.cbu?.trim() && data?.cbuTitular?.trim());
  const canRequestPayout = balanceCents >= 1 && !hasPendingPayout && hasCbuData;
  // En este sistema los campos *Cents almacenan PESOS (no centavos)
  const formatPesos = (amount: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(amount);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-[#6b7280]">Cargando referidos...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-600">{error}</p>
      </Card>
    );
  }

  const mpConnected = data?.mpConnected ?? false;
  const referralCode = data?.referralCode ?? null;
  const canCopyAndQR = mpConnected && referralCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="flex-shrink-0 text-orange-500">
          <GiftIcon className="w-14 h-14" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a]">Programa de referidos</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">
            Fotógrafos, laboratorios, organizadores y clientes pueden recomendar con su link. Solo los fotógrafos referidos que venden generan comisión: cobrás el 50% del fee por 12 meses.
          </p>
        </div>
      </div>

      <Card className="p-6 border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5 text-orange-400">
            <ShareLinkIcon />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <h3 className="text-sm font-semibold text-[#374151]">
              Tu link de referido
            </h3>
            {!mpConnected ? (
            <>
              <p className="text-base text-[#1a1a1a] font-medium mb-2">
                Para generar y usar tu link de referidos tenés que conectar Mercado Pago.
              </p>
              <p className="text-sm text-[#6b7280] mb-4">
                Si alguien se registra con tu link y hace ventas pero vos no tenés MP conectado en ese momento, esa comisión se pierde (no se acumula).
              </p>
              <Link href={mercadopagoLink}>
                <Button variant="primary">Conectar Mercado Pago</Button>
              </Link>
            </>
          ) : (
            <>
              {referralCode ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralCode.url}
                      className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm"
                    />
                    <Button
                      variant="secondary"
                      onClick={copyLink}
                      disabled={!canCopyAndQR}
                    >
                      {copied ? "Copiado" : "Copiar link"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={downloadQR}
                      disabled={!canCopyAndQR}
                    >
                      Descargar QR
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  {creating
                    ? "Creando tu código..."
                    : "No tenés código de referido aún. Entrá a esta pestaña y se creará automáticamente."}
                </p>
              )}
            </>
          )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTerms(true)}
            >
              Ver condiciones
            </Button>
          </div>
        </div>
      </Card>

      {mpConnected && (
        <>
          <Card className="p-6 border-slate-100">
            <h3 className="text-sm font-semibold text-[#374151] mb-2">
              Datos para cobro (transferencia bancaria)
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Ingresá tu CBU (o Alias) y el titular de la cuenta para recibir las comisiones por transferencia. Sin estos datos no podés solicitar cobro.
            </p>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">CBU o Alias</label>
                  <input
                    type="text"
                    value={cbuInput}
                    onChange={(e) => setCbuInput(e.target.value)}
                    placeholder="Ej: 0000000000000000000000 o mi.alias"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    maxLength={30}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Titular de la cuenta</label>
                  <input
                    type="text"
                    value={cbuTitularInput}
                    onChange={(e) => setCbuTitularInput(e.target.value)}
                    placeholder="Nombre del titular"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    maxLength={120}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={saveCbu}
                  disabled={savingCbu}
                >
                  {savingCbu ? "Guardando..." : cbuSaved ? "Guardado" : "Guardar"}
                </Button>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#374151] mb-1">
                Comisiones por referidos
              </h3>
              <p className="text-2xl font-semibold text-emerald-700">
                {formatPesos(balanceCents)} <span className="text-sm font-normal text-gray-500">disponibles</span>
              </p>
              {totalPaidCents > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Ya cobraste: {formatPesos(totalPaidCents)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={requestPayout}
                disabled={!canRequestPayout || requestingPayout}
              >
                {requestingPayout ? "Enviando..." : "Solicitar cobro"}
              </Button>
              {!canRequestPayout && balanceCents > 0 && balanceCents < 1 && (
                <span className="text-xs text-gray-500">Mínimo $1 para solicitar</span>
              )}
              {!canRequestPayout && balanceCents >= 1 && !hasCbuData && (
                <span className="text-xs text-amber-600">Completá CBU y titular de la cuenta arriba para solicitar cobro</span>
              )}
              {hasPendingPayout && (
                <span className="text-xs text-amber-600">Tenés una solicitud pendiente</span>
              )}
            </div>
          </div>
          {payoutMessage && (
            <p className={`mt-3 text-sm ${payoutMessage.startsWith("Tu solicitud") ? "text-emerald-600" : "text-amber-600"}`}>
              {payoutMessage}
            </p>
          )}
          {data?.payoutRequests && data.payoutRequests.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Últimas solicitudes</p>
              <ul className="text-sm space-y-1">
                {data.payoutRequests.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{formatPesos(r.amountCents)}</span>
                    <span className={r.status === "PAID" ? "text-emerald-600" : r.status === "PENDING" ? "text-amber-600" : "text-gray-500"}>
                      {r.status === "PAID" ? "Pagado" : r.status === "PENDING" ? "Pendiente" : "Cancelado"}
                      {r.paidAt && r.status === "PAID" && ` · ${new Date(r.paidAt).toLocaleDateString("es-AR")}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        </>
      )}

      <Card className="p-6 border-amber-100 bg-gradient-to-br from-white to-amber-50/20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-shrink-0 flex justify-center sm:block">
            <EmptyReferralsIllu className="w-20 h-20 sm:w-16 sm:h-16 text-amber-400/90" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#374151] mb-1">
              Referidos dados de alta: <span className="text-orange-600">{data?.totalReferred ?? 0}</span>
            </h3>
            {data?.referred && data.referred.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Referido</th>
                  <th className="py-2 pr-4">Fecha alta</th>
                  <th className="py-2 pr-4">Ventas</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.referred.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <span className="text-[#1a1a1a]">{r.maskedEmail}</span>
                      {r.maskedName !== "—" && (
                        <span className="text-gray-500 ml-1">
                          ({r.maskedName})
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(r.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2 pr-4">{r.salesCount}</td>
                    <td className="py-2">
                      <span
                        className={
                          r.status === "ACTIVE"
                            ? "text-green-600"
                            : r.status === "EXPIRED"
                              ? "text-amber-600"
                              : "text-gray-500"
                        }
                      >
                        {r.status === "ACTIVE"
                          ? "Activo"
                          : r.status === "EXPIRED"
                            ? "Expirado"
                            : "Bloqueado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            ) : (
              <p className="text-sm text-[#6b7280] mt-2">
                Aún no tenés fotógrafos referidos. Compartí tu link para sumar referidos y empezar a cobrar tu parte del fee.
              </p>
            )}
          </div>
        </div>
      </Card>

      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">
              Condiciones del programa de referidos
            </h3>
            <p className="text-sm text-[#4b5563] whitespace-pre-line">
              {REFERRAL_TERMS_TEXT}
            </p>
            <div className="mt-6">
              <Button variant="primary" onClick={() => setShowTerms(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
