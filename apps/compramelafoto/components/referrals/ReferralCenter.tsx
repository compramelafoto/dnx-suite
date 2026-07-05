"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { ReferralSharePath } from "@/lib/referral-link";
import {
  REFERRAL_SHARE_OPTIONS,
  buildReferralUrlForPath,
  referralShareHelperText,
} from "@/lib/referrals/referral-share-options";
import {
  ReferralsMeProvider,
  ReferralsMeGate,
  ReferralsTermsModal,
  useReferralsMe,
} from "@/components/referrals/ReferralsMeProvider";
import {
  ReferralsSharePanel,
  ReferralsTrainingPanel,
  ReferralsReferredPanel,
  ReferralsFinancesPanel,
  ReferralCommercialBlock,
} from "@/components/referrals/ReferralsMePanels";

type SuggestedMessage = {
  id: string;
  label: string;
  text: string;
};

type ReferralCenterData = {
  referralCode: { code: string; url: string } | null;
  metrics: {
    clicksGenerated: number | null;
    registeredUsers: number;
    activeReferrals: number;
    benefitsGeneratedCents: number;
    referredPhotographersCount?: number;
    referredOrganizersCount?: number;
    activePhotographersCount?: number;
    activeOrganizersCount?: number;
    photographerReferralEarningsCents?: number;
    organizerReferralEarningsCents?: number;
  };
};

type AuthRole = "PHOTOGRAPHER" | "LAB" | "LAB_PHOTOGRAPHER" | "ADMIN" | "CLIENT" | "ORGANIZER" | string;

const SUGGESTED_MESSAGES: SuggestedMessage[] = [
  {
    id: "fotografos",
    label: "Para fotógrafos",
    text: "Estoy usando ComprameLaFoto para vender fotos online, organizar pedidos y trabajar de forma más profesional. Miralo acá 👇",
  },
  {
    id: "fotografos-escolares",
    label: "Para fotógrafos escolares",
    text: "Si hacés fotografía escolar, este sistema te puede ahorrar muchísimo tiempo: preventa online, pedidos ordenados, diseños automáticos y etiquetas para entregar sobres. Miralo acá 👇",
  },
  {
    id: "escuelas",
    label: "Para escuelas",
    text: "Les comparto una herramienta para ordenar la fotografía escolar: las familias pueden comprar online, elegir sus fotos y recibir todo de forma más organizada. Miren cómo funciona 👇",
  },
];

const MATERIALS = [
  {
    title: "Flyers para redes",
    text: "Flyers listos para publicar en Instagram, Facebook y WhatsApp.",
  },
  {
    title: "Videos cortos",
    text: "Videos breves para explicar ComprameLaFoto y sus funcionalidades.",
  },
  {
    title: "Logos y recursos de marca",
    text: "Archivos visuales para acompañar tus publicaciones.",
  },
  {
    title: "PDFs comerciales",
    text: "Presentaciones para enviar a escuelas, fotógrafos o instituciones.",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

function ReferralStepsCard() {
  return (
    <Card className="p-6 md:p-8 border-[#c27b3d]/25 bg-gradient-to-br from-[#fffaf5] via-white to-[#f8fafc]">
      <h2 className="text-lg font-semibold text-[#1a1a1a]">Cómo conseguir más referidos</h2>
      <p className="mt-2 text-sm text-[#6b7280]">
        Usá esta secuencia simple para compartir mejor y convertir más.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          "Elegí la landing más adecuada.",
          "Copiá tu link personalizado.",
          "Compartilo por WhatsApp, Instagram o email.",
          "Usá los mensajes sugeridos.",
          "Invitá a la persona a crear su usuario.",
        ].map((step, index) => (
          <article
            key={step}
            className="rounded-xl border border-[#111827]/10 bg-white p-3.5"
          >
            <p className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#c27b3d]/15 text-xs font-semibold text-[#9a5c2a]">
              {index + 1}
            </p>
            <p className="mt-2 text-sm text-[#374151]">{step}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 rounded-xl border border-[#c27b3d]/20 bg-[#fffaf0] p-3 text-sm text-[#4b5563]">
        Si hablás con fotógrafos escolares, compartí la landing de fotografía escolar.
        Si hablás con una institución, elegí «Recomendar a una escuela» en tu link de referido.
        Para otros rubros, usá la landing general.
      </p>
    </Card>
  );
}

function ReferralMetricsSection({ data }: { data: ReferralCenterData | null }) {
  const metrics = data?.metrics;
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
            Clicks generados
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">
            {metrics?.clicksGenerated ?? "Próximamente"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
            Usuarios registrados
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">
            {metrics?.registeredUsers ?? 0}
          </p>
          {(metrics?.referredPhotographersCount != null ||
            metrics?.referredOrganizersCount != null) && (
            <p className="mt-1 text-xs text-[#9ca3af]">
              {metrics?.referredPhotographersCount ?? 0} fotógrafos ·{" "}
              {metrics?.referredOrganizersCount ?? 0} organizadores
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
            Referidos activos
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">
            {metrics?.activeReferrals ?? 0}
          </p>
          {(metrics?.activePhotographersCount != null ||
            metrics?.activeOrganizersCount != null) && (
            <p className="mt-1 text-xs text-[#9ca3af]">
              {metrics?.activePhotographersCount ?? 0} fotógrafos ·{" "}
              {metrics?.activeOrganizersCount ?? 0} organizadores
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
            Beneficios generados
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">
            {typeof metrics?.benefitsGeneratedCents === "number"
              ? formatCurrency(metrics.benefitsGeneratedCents)
              : "Disponible próximamente"}
          </p>
          {(metrics?.photographerReferralEarningsCents != null ||
            metrics?.organizerReferralEarningsCents != null) && (
            <p className="mt-1 text-xs text-[#9ca3af]">
              {formatCurrency(metrics?.photographerReferralEarningsCents ?? 0)} fotógrafos ·{" "}
              {formatCurrency(metrics?.organizerReferralEarningsCents ?? 0)} organizadores
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}

function ReferralMessagesSection({ referralLink }: { referralLink: string }) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  async function copyText(text: string, success: () => void) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    success();
  }

  function shareOnWhatsApp(message: string) {
    const text = `${message}\n${referralLink}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="p-6 md:p-8 space-y-4">
      <h2 className="text-lg font-semibold text-[#1a1a1a]">Mensajes listos para copiar</h2>
      <p className="text-sm text-[#6b7280]">
        Copiá un mensaje ya armado con tu link incluido, o compartilo directo por WhatsApp.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SUGGESTED_MESSAGES.map((message) => {
          const combinedMessage = `${message.text}\n${referralLink}`;
          return (
            <article
              key={message.id}
              className="rounded-2xl border border-[#111827]/10 bg-white p-4"
            >
              <h3 className="text-sm font-semibold text-[#1a1a1a]">{message.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">{message.text}</p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  disabled={!referralLink}
                  onClick={() =>
                    copyText(combinedMessage, () => {
                      setCopiedMessageId(message.id);
                      setTimeout(() => setCopiedMessageId(null), 1800);
                    })
                  }
                >
                  {copiedMessageId === message.id ? "Mensaje copiado" : "Copiar mensaje"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!referralLink}
                  onClick={() => shareOnWhatsApp(message.text)}
                >
                  Compartir por WhatsApp
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function ReferralMessagesFromProvider() {
  const { selectedReferralLink } = useReferralsMe();
  return <ReferralMessagesSection referralLink={selectedReferralLink} />;
}

function ReferralMaterialsSection() {
  return (
    <Card className="p-6 md:p-8 space-y-4">
      <h2 className="text-lg font-semibold text-[#1a1a1a]">Materiales para promocionar</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {MATERIALS.map((material) => (
          <article
            key={material.title}
            className="rounded-2xl border border-[#111827]/10 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#1a1a1a]">{material.title}</h3>
              <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold text-[#6b7280]">
                Próximamente
              </span>
            </div>
            <p className="mt-2 text-sm text-[#4b5563]">{material.text}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

function BasicShareCard({
  referralCode,
  selectedPath,
  onPathChange,
}: {
  referralCode: { code: string; url: string };
  selectedPath: ReferralSharePath;
  onPathChange: (path: ReferralSharePath) => void;
}) {
  const [copiedLink, setCopiedLink] = useState(false);

  const selectedReferralLink = useMemo(
    () => buildReferralUrlForPath(referralCode.url, referralCode.code, selectedPath),
    [referralCode, selectedPath]
  );

  async function copyText(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  }

  function shareOnWhatsApp() {
    const text = `Mirá cómo funciona 👇\n${selectedReferralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="p-6 md:p-8 space-y-4">
      <h2 className="text-lg font-semibold text-[#1a1a1a]">Tu link de referido</h2>
      <div className="space-y-3">
        <select
          value={selectedPath}
          onChange={(e) => onPathChange(e.target.value as ReferralSharePath)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1f2937]"
        >
          {REFERRAL_SHARE_OPTIONS.map((option) => (
            <option key={option.path} value={option.path}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs leading-relaxed text-[#6b7280]">
          {referralShareHelperText(selectedPath)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="primary"
            onClick={() => void copyText(selectedReferralLink)}
            className="w-full sm:w-auto"
          >
            {copiedLink ? "Enlace copiado" : "Copiar enlace de invitación"}
          </Button>
          <input
            type="text"
            readOnly
            value={selectedReferralLink}
            className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
          />
          <Button variant="secondary" onClick={shareOnWhatsApp}>
            Compartir por WhatsApp
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AdvancedReferralManagement({
  mercadopagoLink,
  centerData,
}: {
  mercadopagoLink: string;
  centerData: ReferralCenterData | null;
}) {
  return (
    <ReferralsMeProvider mercadopagoLink={mercadopagoLink}>
      <ReferralsMeGate>
        <div className="space-y-6">
          <Card className="p-6 md:p-8 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Tu link de referido</h2>
              <p className="mt-1 text-sm text-[#6b7280]">
                Elegí la landing, copiá tu link y compartilo. Las comisiones y cobros están más abajo.
              </p>
            </div>
            <ReferralsSharePanel embedded />
          </Card>
          <ReferralMessagesFromProvider />
          <ReferralMetricsSection data={centerData} />
          <ReferralsTrainingPanel />
          <Card className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Gestión avanzada de referidos</h2>
              <p className="mt-1 text-sm text-[#6b7280]">
                Revisá quién se registró con tu link y gestioná tus cobros por comisión.
              </p>
            </div>
            <ReferralsReferredPanel />
            <ReferralsFinancesPanel />
          </Card>
        </div>
      </ReferralsMeGate>
      <ReferralsTermsModal />
    </ReferralsMeProvider>
  );
}

export default function ReferralCenter() {
  const [data, setData] = useState<ReferralCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<ReferralSharePath>("/");
  const [authRole, setAuthRole] = useState<AuthRole | null>(null);
  const [commercialCopied, setCommercialCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals/center", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "No se pudo cargar el centro de referidos.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando datos.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setAuthRole(json?.user?.role ?? null))
      .catch(() => setAuthRole(null));
  }, []);

  const canUseAdvancedReferralPanel =
    authRole === "PHOTOGRAPHER" || authRole === "LAB" || authRole === "LAB_PHOTOGRAPHER";

  const mercadopagoLink =
    authRole === "LAB" || authRole === "LAB_PHOTOGRAPHER"
      ? "/lab/configuracion/mercadopago"
      : "/fotografo/configuracion?tab=mercadopago";

  const basicReferralLink = useMemo(() => {
    if (!data?.referralCode) return "";
    return buildReferralUrlForPath(data.referralCode.url, data.referralCode.code, selectedPath);
  }, [data?.referralCode, selectedPath]);

  async function copyCommercialLink() {
    if (!basicReferralLink) return;
    await navigator.clipboard.writeText(basicReferralLink);
    setCommercialCopied(true);
    setTimeout(() => setCommercialCopied(false), 2000);
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-[#6b7280]">Cargando centro de referidos...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-600">{error}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="referrals-center space-y-6">
      <Card className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-[#1a1a1a]">Panel de Referidos</h1>
        <p className="mt-2 block w-full max-w-none text-sm text-[#6b7280]">
          Compartí ComprameLaFoto con un solo enlace: recomendá fotógrafos u organizadores y
          sumá beneficios por cada referido activo.
        </p>
      </Card>

      <ReferralCommercialBlock
        referralLink={basicReferralLink}
        canCopy={!!data?.referralCode}
        copied={commercialCopied}
        onCopyLink={() => void copyCommercialLink()}
      />

      <ReferralStepsCard />

      {canUseAdvancedReferralPanel ? (
        <AdvancedReferralManagement
          mercadopagoLink={mercadopagoLink}
          centerData={data}
        />
      ) : (
        <>
          {data?.referralCode ? (
            <BasicShareCard
              referralCode={data.referralCode}
              selectedPath={selectedPath}
              onPathChange={setSelectedPath}
            />
          ) : (
            <Card className="p-6 md:p-8">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Tu link de referido</h2>
              <p className="mt-2 text-sm text-[#6b7280]">
                Tu código de referido se generará cuando esté disponible para tu cuenta.
              </p>
            </Card>
          )}
          <ReferralMessagesSection referralLink={basicReferralLink} />
          <ReferralMetricsSection data={data} />
          <Card className="p-6 md:p-8">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Gestión avanzada de referidos</h2>
            <p className="mt-2 text-sm text-[#6b7280]">
              Las funciones avanzadas de comisiones y cobros (CBU, solicitudes de pago y
              referidos activos) están disponibles para cuentas de fotógrafo y laboratorio.
            </p>
          </Card>
        </>
      )}

      <ReferralMaterialsSection />
    </div>
  );
}
