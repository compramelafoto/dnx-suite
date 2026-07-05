"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import QRCode from "qrcode";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { REFERRAL_TERMS_TEXT } from "@/lib/terms/referralTerms";
import type { ReferralSharePath } from "@/lib/referral-link";
import {
  REFERRAL_SHARE_OPTIONS,
  buildReferralUrlForPath,
  referralShareHelperText,
} from "@/lib/referrals/referral-share-options";

export type ReferralProgramType = "PHOTOGRAPHER_REFERRAL" | "ORGANIZER_REFERRAL";

export type ReferredRow = {
  id: number;
  maskedEmail: string;
  maskedName: string;
  createdAt: string;
  status: string;
  salesCount: number;
  earningsGeneratedCents: number;
  referralProgram: ReferralProgramType;
  referralOriginLabel?: string | null;
};

type TrainingPromoRow = {
  id: number;
  title: string;
  slug: string;
  eventDate: string | null;
  promotionalUrl: string;
  thumbnailUrl?: string | null;
};

export type ReferralProgramStats = {
  referredPhotographersCount: number;
  referredOrganizersCount: number;
  activePhotographersCount: number;
  activeOrganizersCount: number;
  photographerReferralEarningsCents: number;
  organizerReferralEarningsCents: number;
  photographerBalanceCents: number;
  organizerBalanceCents: number;
};

export type ReferralsMeData = {
  mpConnected: boolean;
  cbu?: string | null;
  cbuTitular?: string | null;
  referralCode: { code: string; url: string } | null;
  trainingPromos?: TrainingPromoRow[];
  totalReferred: number;
  referred: ReferredRow[];
  balanceCents?: number;
  totalPaidCents?: number;
  referredPhotographersCount?: number;
  referredOrganizersCount?: number;
  activePhotographersCount?: number;
  activeOrganizersCount?: number;
  photographerReferralEarningsCents?: number;
  organizerReferralEarningsCents?: number;
  photographerBalanceCents?: number;
  organizerBalanceCents?: number;
  programStats?: ReferralProgramStats;
  payoutRequests?: Array<{
    id: number;
    amountCents: number;
    status: string;
    requestedAt: string;
    paidAt: string | null;
  }>;
};

type ReferralsMeContextValue = {
  data: ReferralsMeData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  selectedSharePath: ReferralSharePath;
  setSelectedSharePath: (path: ReferralSharePath) => void;
  selectedReferralLink: string;
  canCopyAndQR: boolean;
  copied: boolean;
  copyLink: (link: string) => void;
  shareByWhatsApp: (link: string) => void;
  downloadQR: (link: string) => void;
  copiedTrainingId: number | null;
  copyTrainingLink: (promo: TrainingPromoRow) => void;
  cbuInput: string;
  setCbuInput: (v: string) => void;
  cbuTitularInput: string;
  setCbuTitularInput: (v: string) => void;
  savingCbu: boolean;
  cbuSaved: boolean;
  saveCbu: () => Promise<void>;
  requestingPayout: boolean;
  payoutMessage: string | null;
  requestPayout: () => Promise<void>;
  canRequestPayout: boolean;
  hasPendingPayout: boolean;
  hasCbuData: boolean;
  balanceCents: number;
  totalPaidCents: number;
  formatPesos: (amount: number) => string;
  showTerms: boolean;
  setShowTerms: (v: boolean) => void;
  creating: boolean;
  mercadopagoLink: string;
};

const ReferralsMeContext = createContext<ReferralsMeContextValue | null>(null);

export function useReferralsMe() {
  const ctx = useContext(ReferralsMeContext);
  if (!ctx) throw new Error("useReferralsMe debe usarse dentro de ReferralsMeProvider");
  return ctx;
}

type ReferralsMeProviderProps = {
  children: ReactNode;
  mercadopagoLink?: string;
};

export function ReferralsMeProvider({
  children,
  mercadopagoLink = "/fotografo/configuracion?tab=mercadopago",
}: ReferralsMeProviderProps) {
  const [data, setData] = useState<ReferralsMeData | null>(null);
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
  const [copiedTrainingId, setCopiedTrainingId] = useState<number | null>(null);
  const [selectedSharePath, setSelectedSharePath] = useState<ReferralSharePath>("/");

  const load = useCallback(async () => {
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
        setCreating(true);
        try {
          const createRes = await fetch("/api/referrals/me", {
            method: "POST",
            credentials: "include",
          });
          if (createRes.ok) {
            const created = await createRes.json();
            setData((prev) =>
              prev ? { ...prev, referralCode: created.referralCode } : null
            );
          }
        } catch {
          setError("No se pudo crear el código de referido");
        } finally {
          setCreating(false);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mpConnected = data?.mpConnected ?? false;
  const referralCode = data?.referralCode ?? null;
  const canCopyAndQR = Boolean(mpConnected && referralCode);
  const selectedOption =
    REFERRAL_SHARE_OPTIONS.find((option) => option.path === selectedSharePath) ??
    REFERRAL_SHARE_OPTIONS[0];
  const selectedReferralLink =
    referralCode?.url && referralCode?.code
      ? buildReferralUrlForPath(referralCode.url, referralCode.code, selectedOption.path)
      : "";

  const balanceCents = data?.balanceCents ?? 0;
  const totalPaidCents = data?.totalPaidCents ?? 0;
  const hasPendingPayout = (data?.payoutRequests ?? []).some((r) => r.status === "PENDING");
  const hasCbuData = !!(data?.cbu?.trim() && data?.cbuTitular?.trim());
  const canRequestPayout = balanceCents >= 1 && !hasPendingPayout && hasCbuData;
  const formatPesos = useCallback(
    (amount: number) =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
      }).format(amount),
    []
  );

  const copyLink = useCallback(
    (link: string) => {
      if (!mpConnected || !link) return;
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    },
    [mpConnected]
  );

  const copyTrainingLink = useCallback(
    (promo: TrainingPromoRow) => {
      if (!mpConnected) return;
      navigator.clipboard.writeText(promo.promotionalUrl).then(() => {
        setCopiedTrainingId(promo.id);
        setTimeout(() => setCopiedTrainingId(null), 2000);
      });
    },
    [mpConnected]
  );

  const downloadQR = useCallback(
    async (link: string) => {
      if (!link || !referralCode?.code || !mpConnected) return;
      try {
        const dataUrl = await QRCode.toDataURL(link, { width: 256, margin: 2 });
        const a = document.createElement("a");
        a.href = dataUrl;
        const safePathName =
          selectedSharePath === "/" ? "home" : selectedSharePath.replace("/", "");
        a.download = `compramelafoto-ref-${safePathName}-${referralCode.code}.png`;
        a.click();
      } catch (err) {
        console.error("Error generando QR:", err);
      }
    },
    [mpConnected, referralCode?.code, selectedSharePath]
  );

  const shareByWhatsApp = useCallback(
    (link: string) => {
      if (!link) return;
      const message = selectedOption.whatsappMessage;
      const text = `${message}\n${link}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    },
    [selectedOption.whatsappMessage]
  );

  const saveCbu = useCallback(async () => {
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
    } catch (e: unknown) {
      setPayoutMessage(e instanceof Error ? e.message : "Error al guardar CBU");
    } finally {
      setSavingCbu(false);
    }
  }, [cbuInput, cbuTitularInput]);

  const requestPayout = useCallback(async () => {
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
      await load();
    } catch {
      setPayoutMessage("Error de conexión.");
    } finally {
      setRequestingPayout(false);
    }
  }, [load]);

  const value = useMemo<ReferralsMeContextValue>(
    () => ({
      data,
      loading,
      error,
      reload: load,
      selectedSharePath,
      setSelectedSharePath,
      selectedReferralLink,
      canCopyAndQR,
      copied,
      copyLink,
      shareByWhatsApp,
      downloadQR,
      copiedTrainingId,
      copyTrainingLink,
      cbuInput,
      setCbuInput,
      cbuTitularInput,
      setCbuTitularInput,
      savingCbu,
      cbuSaved,
      saveCbu,
      requestingPayout,
      payoutMessage,
      requestPayout,
      canRequestPayout,
      hasPendingPayout,
      hasCbuData,
      balanceCents,
      totalPaidCents,
      formatPesos,
      showTerms,
      setShowTerms,
      creating,
      mercadopagoLink,
    }),
    [
      data,
      loading,
      error,
      load,
      selectedSharePath,
      selectedReferralLink,
      canCopyAndQR,
      copied,
      copyLink,
      shareByWhatsApp,
      downloadQR,
      copiedTrainingId,
      copyTrainingLink,
      cbuInput,
      cbuTitularInput,
      savingCbu,
      cbuSaved,
      saveCbu,
      requestingPayout,
      payoutMessage,
      requestPayout,
      canRequestPayout,
      hasPendingPayout,
      hasCbuData,
      balanceCents,
      totalPaidCents,
      formatPesos,
      showTerms,
      creating,
      mercadopagoLink,
    ]
  );

  return <ReferralsMeContext.Provider value={value}>{children}</ReferralsMeContext.Provider>;
}

export function ReferralsMeGate({ children }: { children: ReactNode }) {
  const { loading, error, reload } = useReferralsMe();
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
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }
  return <>{children}</>;
}

export function ReferralsTermsModal() {
  const { showTerms, setShowTerms } = useReferralsMe();
  if (!showTerms) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setShowTerms(false)}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[min(48rem,calc(100vw-2rem))] p-6 sm:p-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">
          Condiciones del programa de referidos
        </h3>
        <p className="text-sm text-[#4b5563] whitespace-pre-line">{REFERRAL_TERMS_TEXT}</p>
        <div className="mt-6">
          <Button variant="primary" onClick={() => setShowTerms(false)}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
