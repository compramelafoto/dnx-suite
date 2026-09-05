"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { FUNNEL_EVENTS } from "@/lib/funnel-events";
import type { ReferralShareMessages } from "@/lib/referral-share-messages";

type ApiSuccess = {
  ok: true;
  existingUser: boolean;
  referralCode: string;
  referralUrl: string;
  messages: ReferralShareMessages;
  infoMessage?: string;
};

type ApiError = {
  ok: false;
  message: string;
};

type LandingStats = {
  daysActive: number;
  totalPhotographers: number;
  totalPhotos: number;
  totalAmountSold: number;
};

const LANDING_STATS_POLL_MS = 15_000;

/**
 * Números reales del programa (no son un ejemplo inventado):
 * - ComprameLaFoto cobra `PLATFORM_FEE_PERCENT` sobre el precio que pone el fotógrafo.
 * - El recomendador se lleva `REFERRAL_FEE_SHARE` de ese fee (lib/referral/referral-program.ts).
 * → 15% × 50% = 7,5% de lo que factura el fotógrafo referido.
 */
const PLATFORM_FEE_PERCENT = 15;
const REFERRAL_FEE_SHARE = 0.5;
const REFERRAL_PERCENT = (PLATFORM_FEE_PERCENT * REFERRAL_FEE_SHARE) / 100; // 0.075
const EXAMPLE_MONTHLY_SALES_PER_PHOTOGRAPHER = 100_000;
const ATTRIBUTION_MONTHS = 12;
const EXAMPLE_PHOTOGRAPHER_COUNTS = [1, 10, 50, 100];

function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function fetchLandingStats(): Promise<LandingStats | null> {
  try {
    const r = await fetch(`/api/public/landing-stats?_=${Date.now()}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    if (
      typeof data.daysActive !== "number" ||
      typeof data.totalPhotos !== "number" ||
      typeof data.totalAmountSold !== "number"
    ) {
      return null;
    }
    return {
      daysActive: data.daysActive,
      totalPhotographers:
        typeof data.totalPhotographers === "number" ? data.totalPhotographers : 0,
      totalPhotos: data.totalPhotos,
      totalAmountSold: data.totalAmountSold,
    };
  } catch {
    // Sin conexión o respuesta ilegible: la sección de números simplemente no se muestra.
    return null;
  }
}

async function trackFunnelEvent(
  event: (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS],
  extra?: { path?: string }
) {
  try {
    await fetch("/api/analytics/funnel", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, path: extra?.path ?? "/recomendanos" }),
    });
  } catch {
    /* noop */
  }
}

const PROFILE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Seleccioná tu perfil (opcional)" },
  { value: "FOTOGRAFO", label: "Fotógrafo/a" },
  { value: "INSTITUCION", label: "Escuela o institución (fotografía)" },
  { value: "LABORATORIO", label: "Laboratorio" },
  { value: "MARCA", label: "Marca o empresa del rubro" },
  { value: "COMUNIDAD", label: "Comunidad o asociación" },
  { value: "INFLUENCER", label: "Influencer o perfil con audiencia" },
  { value: "CREADOR", label: "Creador/a de contenido" },
  { value: "ESTUDIO", label: "Estudio" },
  { value: "OTRO", label: "Otro" },
];

function ReferralUiMockup() {
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/5"
      aria-hidden
    >
      <div className="mb-4 flex items-center gap-2 border-b border-black/5 pb-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]">
          ComprameLaFoto · recomendadores
        </span>
      </div>
      <p className="text-xs font-semibold text-[#374151]">Tu enlace de recomendación</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="min-h-[40px] min-w-0 flex-1 rounded-xl bg-[#f7f5f2] px-3 py-2.5 font-mono text-xs leading-snug text-[#111827] ring-1 ring-black/5 sm:text-[13px]">
          compramelafoto.com/land?ref=••••••••
        </div>
        <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#c27b3d] px-4 py-2.5 text-xs font-semibold text-white sm:text-sm">
          Copiar link
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-[#f0fdf4] p-3 ring-1 ring-emerald-200/70">
        <p className="text-xs font-medium text-emerald-900/90">Mensaje sugerido</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 sm:text-sm">
          Te comparto ComprameLaFoto… [texto listo para pegar]
        </p>
      </div>
      <div className="mt-3 flex items-center justify-center rounded-xl bg-[#25D366] py-2.5 text-xs font-semibold text-white">
        Compartir por WhatsApp Web
      </div>
    </div>
  );
}

export default function RecomendanosClient() {
  const searchParams = useSearchParams();
  const formStarted = useRef(false);
  const [landingStats, setLandingStats] = useState<LandingStats | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [profileType, setProfileType] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ApiSuccess | null>(null);
  const [copyLinkFlash, setCopyLinkFlash] = useState(false);
  const [copyMsgFlash, setCopyMsgFlash] = useState(false);

  useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.REFERRAL_LANDING_VIEW);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function loadStats() {
      fetchLandingStats().then((s) => {
        if (!cancelled && s) setLandingStats(s);
      });
    }

    loadStats();
    const interval = setInterval(loadStats, LANDING_STATS_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") loadStats();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const markFormStarted = useCallback(() => {
    if (formStarted.current) return;
    formStarted.current = true;
    trackFunnelEvent(FUNNEL_EVENTS.REFERRAL_FORM_STARTED);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const incomingRef = searchParams?.get("ref")?.trim() || "";
      const utm = {
        utm_source: searchParams?.get("utm_source") ?? "",
        utm_medium: searchParams?.get("utm_medium") ?? "",
        utm_campaign: searchParams?.get("utm_campaign") ?? "",
        utm_content: searchParams?.get("utm_content") ?? "",
        utm_term: searchParams?.get("utm_term") ?? "",
      };
      const res = await fetch("/api/public/referral-ambassador/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          whatsapp,
          instagram: instagram || undefined,
          profileType: profileType || undefined,
          termsAccepted,
          incomingRef: incomingRef || undefined,
          source: searchParams?.get("source") ?? undefined,
          ...utm,
        }),
      });
      const data = (await res.json()) as ApiSuccess | ApiError;
      if (!res.ok || !data.ok) {
        setError((data as ApiError).message || "Algo salió mal. Probá de nuevo.");
        return;
      }
      setSuccess(data);
    } catch {
      setError("No pudimos conectar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!success) return;
    navigator.clipboard.writeText(success.referralUrl).then(() => {
      setCopyLinkFlash(true);
      trackFunnelEvent(FUNNEL_EVENTS.REFERRAL_COPY_LINK);
      setTimeout(() => setCopyLinkFlash(false), 2000);
    });
  }

  function copyMessage(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsgFlash(true);
      trackFunnelEvent(FUNNEL_EVENTS.REFERRAL_COPY_MESSAGE);
      setTimeout(() => setCopyMsgFlash(false), 2000);
    });
  }

  const waWebHref =
    success &&
    `https://web.whatsapp.com/send?text=${encodeURIComponent(success.messages.whatsapp)}`;

  function scrollToForm() {
    document.getElementById("formulario-recomendanos")?.scrollIntoView({ behavior: "smooth" });
  }

  const primaryCtaLabel = "Quiero mi link de referidos";

  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/watermark.png"
              alt="ComprameLaFoto"
              width={48}
              height={48}
              className="h-11 w-11 rounded-full ring-1 ring-black/10"
              priority
            />
            <span className="hidden text-sm font-semibold tracking-wide text-[#1a1a1a] sm:block">
              ComprameLaFoto
            </span>
          </Link>
          <Link
            href="/fotografo/login"
            className="text-sm font-medium text-[#6b7280] transition-colors hover:text-[#c27b3d]"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <main className={success ? undefined : "pb-24 sm:pb-0"}>
        {/* 1 · HERO — la promesa en una línea */}
        <section className="relative overflow-hidden border-b border-black/5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(194,123,61,0.18),transparent_55%)]" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-20">
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#92400e] shadow-sm ring-1 ring-[#c27b3d]/30">
                Programa de recomendados
              </span>
              <h1 className="mt-6 text-[1.75rem] font-bold leading-[1.12] tracking-tight text-[#111827] sm:text-4xl lg:text-[2.6rem]">
                Recomendá ComprameLaFoto y ganá el{" "}
                <span className="text-[#c27b3d]">7,5%</span> de todo lo que venda cada fotógrafo que
                traigas
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-[#374151] sm:text-xl">
                Te damos un link y un mensaje listo. Cada fotógrafo que se registra con tu link te
                deja el 7,5% de su facturación durante {ATTRIBUTION_MONTHS} meses. No cuesta nada
                sumarse.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full justify-center px-8 py-4 text-base font-semibold sm:w-auto"
                  onClick={scrollToForm}
                >
                  {primaryCtaLabel}
                </Button>
                <a
                  href="#cuanto-ganas"
                  className="text-center text-base font-semibold text-[#c27b3d] hover:underline sm:text-left"
                >
                  Ver cuánto se gana
                </a>
              </div>
            </div>
            <ReferralUiMockup />
          </div>
        </section>

        {/* 2 · CUÁNTO GANÁS — el número real, con la cuenta hecha */}
        <section id="cuanto-ganas" className="scroll-mt-20 border-b border-black/5 bg-white py-14 sm:py-16">
          <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
            <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">Cuánto ganás</h2>
            <p className="mt-4 text-base leading-relaxed text-[#4b5563] sm:text-lg">
              ComprameLaFoto le suma un {PLATFORM_FEE_PERCENT}% al precio que pone el fotógrafo (lo
              paga el comprador). De ese {PLATFORM_FEE_PERCENT}%, la mitad es tuya:{" "}
              <strong className="font-semibold text-[#111827]">
                el 7,5% de lo que factura cada fotógrafo que recomendás
              </strong>
              , todos los meses, durante {ATTRIBUTION_MONTHS} meses desde que se registra.
            </p>

            <div className="mt-8 overflow-hidden rounded-2xl border border-[#c27b3d]/25 bg-[#fffbf7] shadow-sm">
              <div className="border-b border-[#c27b3d]/15 px-5 py-4 sm:px-6">
                <p className="text-sm font-bold text-[#92400e]">
                  Ejemplo con la cuenta hecha
                </p>
                <p className="mt-1 text-sm text-[#6b7280]">
                  Suponiendo que cada fotógrafo factura{" "}
                  {formatARS(EXAMPLE_MONTHLY_SALES_PER_PHOTOGRAPHER)} por mes en la plataforma.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left">
                  <thead>
                    <tr className="bg-white/70 text-xs uppercase tracking-wide text-[#6b7280]">
                      <th className="px-5 py-3 font-semibold sm:px-6">Fotógrafos que traés</th>
                      <th className="px-5 py-3 font-semibold sm:px-6">Facturan por mes</th>
                      <th className="px-5 py-3 font-semibold sm:px-6">Ganás por mes</th>
                      <th className="px-5 py-3 font-semibold sm:px-6">
                        Ganás en {ATTRIBUTION_MONTHS} meses
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXAMPLE_PHOTOGRAPHER_COUNTS.map((count) => {
                      const monthlySales = count * EXAMPLE_MONTHLY_SALES_PER_PHOTOGRAPHER;
                      const monthlyEarnings = monthlySales * REFERRAL_PERCENT;
                      return (
                        <tr key={count} className="border-t border-[#c27b3d]/10">
                          <td className="px-5 py-4 text-base font-semibold text-[#111827] sm:px-6">
                            {count}
                          </td>
                          <td className="px-5 py-4 text-base text-[#4b5563] sm:px-6">
                            {formatARS(monthlySales)}
                          </td>
                          <td className="px-5 py-4 text-base font-bold text-[#c27b3d] sm:px-6">
                            {formatARS(monthlyEarnings)}
                          </td>
                          <td className="px-5 py-4 text-base font-semibold text-[#166534] sm:px-6">
                            {formatARS(monthlyEarnings * ATTRIBUTION_MONTHS)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-[#6b7280]">
              Los {formatARS(EXAMPLE_MONTHLY_SALES_PER_PHOTOGRAPHER)} por mes son un supuesto para
              que la cuenta sea fácil de seguir: cada fotógrafo factura lo que factura, y si no vende
              no hay comisión. Lo que no cambia es el porcentaje: siempre te llevás el 7,5% de sus
              ventas.
            </p>

            <div className="mt-6 rounded-2xl border border-black/5 bg-[#f7f5f2] p-5 sm:p-6">
              <p className="text-sm font-bold text-[#374151]">Dos condiciones, sin letra chica:</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#4b5563] sm:text-base">
                <li className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                  La comisión corre {ATTRIBUTION_MONTHS} meses desde que el fotógrafo se registra con
                  tu link.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                  Para cobrar necesitás tener Mercado Pago conectado en tu cuenta cuando se hace la
                  venta.
                </li>
              </ul>
              <p className="mt-4 text-sm text-[#6b7280]">
                El detalle completo está en los{" "}
                <Link href="/terminos" className="font-semibold text-[#c27b3d] underline-offset-2 hover:underline">
                  términos y condiciones
                </Link>
                .
              </p>
            </div>

            <div className="mt-8">
              <Button
                type="button"
                variant="primary"
                className="w-full justify-center px-8 py-3.5 text-base font-semibold sm:w-auto"
                onClick={scrollToForm}
              >
                {primaryCtaLabel}
              </Button>
            </div>
          </div>
        </section>

        {/* 3 · CÓMO FUNCIONA — tres pasos */}
        <section className="border-b border-black/5 bg-[#f7f5f2] py-14 sm:py-16">
          <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
            <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">Cómo funciona</h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-3">
              {[
                {
                  n: "1",
                  t: "Completás el formulario",
                  d: "Nombre, email y WhatsApp. Nada más.",
                },
                {
                  n: "2",
                  t: "Recibís tu link al instante",
                  d: "Con un mensaje ya escrito para copiar o mandar por WhatsApp.",
                },
                {
                  n: "3",
                  t: "Compartís y cobrás",
                  d: "Cada fotógrafo que se registra con tu link te genera el 7,5% de sus ventas.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex flex-col rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c27b3d]/15 text-sm font-bold text-[#b45309]">
                    {step.n}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-[#111827]">{step.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6b7280] sm:text-base">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4 · QUIÉN PUEDE — corto */}
        <section className="border-b border-black/5 bg-white py-12 sm:py-14">
          <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
            <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">Quién puede recomendar</h2>
            <p className="mt-3 text-base leading-relaxed text-[#4b5563] sm:text-lg">
              Cualquiera que tenga llegada a fotógrafos. No hace falta que uses la plataforma para
              vender ni que sepas de tecnología.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {[
                "Fotógrafos y estudios",
                "Escuelas e instituciones",
                "Laboratorios",
                "Organizadores de eventos y workshops",
                "Comunidades y asociaciones",
                "Influencers del rubro",
                "Marcas y proveedores",
              ].map((label) => (
                <li
                  key={label}
                  className="rounded-full bg-[#f7f5f2] px-4 py-2 text-sm font-medium text-[#374151] ring-1 ring-black/5"
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5 · NÚMEROS REALES */}
        {landingStats && (
          <section className="border-b border-black/5 bg-[#f7f5f2] py-12 sm:py-14">
            <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
              <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">
                La plataforma en números
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#4b5563] sm:text-lg">
                Datos reales de ComprameLaFoto, actualizados automáticamente.
              </p>
              <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  {
                    value: landingStats.totalPhotographers.toLocaleString("es-AR"),
                    label: "Fotógrafos registrados",
                  },
                  {
                    value: landingStats.totalPhotos.toLocaleString("es-AR"),
                    label: "Fotos subidas",
                  },
                  {
                    value: formatARS(landingStats.totalAmountSold),
                    label: "Vendido en la plataforma",
                  },
                  {
                    value: landingStats.daysActive.toLocaleString("es-AR"),
                    label: "Días de plataforma activa",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-black/5 bg-white p-4 text-center shadow-sm"
                  >
                    <p className="break-words text-lg font-bold leading-tight text-[#c27b3d] sm:text-xl md:text-2xl">
                      {stat.value}
                    </p>
                    <p className="mt-1.5 text-xs font-medium leading-snug text-[#6b7280] sm:text-sm">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 6 · FORMULARIO */}
        <section id="formulario-recomendanos" className="scroll-mt-20 border-b border-black/5 bg-white py-14 sm:py-16">
          <div className="mx-auto w-full max-w-2xl px-5 sm:px-8">
            {success ? (
              <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-[#ecfdf5] to-white p-6 shadow-lg sm:p-8">
                <p className="text-2xl font-bold text-emerald-950">Listo, ya podés empezar</p>
                <p className="mt-2 text-base text-emerald-900/90">
                  Copiá el link, el mensaje o mandalo directo por WhatsApp. Para volver más tarde,
                  entrá desde <strong>Ingresar</strong>.
                </p>
                {success.infoMessage && (
                  <p className="mt-4 rounded-xl bg-white/80 p-3 text-sm text-emerald-900/95 ring-1 ring-emerald-200/80">
                    {success.infoMessage}
                  </p>
                )}
                <div className="mt-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                    Tu enlace personal
                  </p>
                  <p className="mt-2 break-all font-mono text-sm font-medium text-[#111827]">
                    {success.referralUrl}
                  </p>
                  <Button type="button" variant="primary" className="mt-4 w-full font-semibold" onClick={copyLink}>
                    {copyLinkFlash ? "Copiado" : "Copiar link"}
                  </Button>
                </div>
                <div className="mt-5 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                    Mensaje sugerido
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-[#374151]">
                    {success.messages.defaultMessage}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full font-medium sm:flex-1"
                      onClick={() => copyMessage(success.messages.defaultMessage)}
                    >
                      {copyMsgFlash ? "Copiado" : "Copiar mensaje completo"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full font-medium sm:flex-1"
                      onClick={() => copyMessage(success.messages.short)}
                    >
                      Copiar versión corta
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-[#6b7280]">
                    También:{" "}
                    <button
                      type="button"
                      className="font-semibold text-[#c27b3d] hover:underline"
                      onClick={() => copyMessage(success.messages.instagramDm)}
                    >
                      variante para Instagram DM
                    </button>
                  </p>
                </div>
                {waWebHref && (
                  <a
                    href={waWebHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#25D366] py-3.5 text-base font-semibold text-white transition hover:bg-[#1ebe5d]"
                    onClick={() => trackFunnelEvent(FUNNEL_EVENTS.REFERRAL_WHATSAPP_SHARE_CLICKED)}
                  >
                    Abrir WhatsApp Web con el mensaje
                  </a>
                )}
                <Link href="/fotografo/login" className="mt-4 block">
                  <Button type="button" variant="secondary" className="w-full border-black/15 py-3.5 font-medium">
                    Ingresar a mi cuenta
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">
                  Pedí tu link de referidos
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[#4b5563] sm:text-lg">
                  Tres datos y lo tenés en pantalla al instante. Es gratis.
                </p>
                <form
                  onSubmit={onSubmit}
                  className="mt-8 space-y-5"
                  aria-busy={loading}
                >
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                      {error}
                    </div>
                  )}
                  <div>
                    <label htmlFor="ref-nombre" className="block text-sm font-semibold text-[#374151]">
                      Nombre y apellido
                    </label>
                    <input
                      id="ref-nombre"
                      required
                      placeholder="Ej.: María González"
                      className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3.5 text-[#111827] outline-none transition focus:border-[#c27b3d]/60 focus:bg-white focus:ring-2 focus:ring-[#c27b3d]/20"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        markFormStarted();
                      }}
                      onFocus={markFormStarted}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="ref-email" className="block text-sm font-semibold text-[#374151]">
                      Email
                    </label>
                    <input
                      id="ref-email"
                      required
                      type="email"
                      inputMode="email"
                      placeholder="tu@email.com"
                      className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3.5 text-[#111827] outline-none transition focus:border-[#c27b3d]/60 focus:bg-white focus:ring-2 focus:ring-[#c27b3d]/20"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        markFormStarted();
                      }}
                      onFocus={markFormStarted}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="ref-wa" className="block text-sm font-semibold text-[#374151]">
                      WhatsApp
                    </label>
                    <input
                      id="ref-wa"
                      required
                      placeholder="Código de país + número, ej. +54 9 11 2345-6789"
                      className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3.5 text-[#111827] outline-none transition focus:border-[#c27b3d]/60 focus:bg-white focus:ring-2 focus:ring-[#c27b3d]/20"
                      value={whatsapp}
                      onChange={(e) => {
                        setWhatsapp(e.target.value);
                        markFormStarted();
                      }}
                      onFocus={markFormStarted}
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label htmlFor="ref-ig" className="block text-sm font-semibold text-[#374151]">
                      Instagram <span className="font-normal text-[#9ca3af]">(opcional)</span>
                    </label>
                    <input
                      id="ref-ig"
                      placeholder="@tu_usuario o link al perfil"
                      className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3.5 text-[#111827] outline-none transition focus:border-[#c27b3d]/60 focus:bg-white focus:ring-2 focus:ring-[#c27b3d]/20"
                      value={instagram}
                      onChange={(e) => {
                        setInstagram(e.target.value);
                        markFormStarted();
                      }}
                      onFocus={markFormStarted}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="ref-perfil" className="block text-sm font-semibold text-[#374151]">
                      Tipo de perfil <span className="font-normal text-[#9ca3af]">(opcional)</span>
                    </label>
                    <select
                      id="ref-perfil"
                      className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3.5 text-[#111827] outline-none transition focus:border-[#c27b3d]/60 focus:bg-white focus:ring-2 focus:ring-[#c27b3d]/20"
                      value={profileType}
                      onChange={(e) => {
                        setProfileType(e.target.value);
                        markFormStarted();
                      }}
                      onFocus={markFormStarted}
                    >
                      {PROFILE_OPTIONS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/5 bg-[#f7f5f2] p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-black/20 text-[#c27b3d] focus:ring-[#c27b3d]"
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        markFormStarted();
                      }}
                    />
                    <span className="text-base leading-relaxed text-[#374151]">
                      Acepto los{" "}
                      <Link href="/terminos" className="font-semibold text-[#c27b3d] hover:underline" target="_blank">
                        términos
                      </Link>{" "}
                      y la{" "}
                      <Link href="/privacidad" className="font-semibold text-[#c27b3d] hover:underline" target="_blank">
                        política de privacidad
                      </Link>
                      .
                    </span>
                  </label>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full py-4 text-base font-bold shadow-md"
                    disabled={loading || !termsAccepted}
                  >
                    {loading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <svg
                          className="h-5 w-5 animate-spin text-white/90"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-90"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Generando tu link…
                      </span>
                    ) : (
                      primaryCtaLabel
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </section>

        {/* 7 · FAQ */}
        <section className="bg-[#f7f5f2] py-14 sm:py-16">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
            <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">Preguntas frecuentes</h2>
            <dl className="mt-7 space-y-3">
              <FaqItem
                q="¿Cuánto cobro exactamente?"
                a="El 7,5% de todo lo que facture cada fotógrafo que se registre con tu link, durante 12 meses desde su alta. Sale del fee del 15% que cobra ComprameLaFoto: la mitad de ese fee es tuya. No se le descuenta nada al fotógrafo."
              />
              <FaqItem
                q="¿Tengo que pagar algo para recomendar?"
                a="No. Sumarte y obtener tu link es gratis. Para que te paguemos las comisiones necesitás tener Mercado Pago conectado en tu cuenta cuando se hace la venta."
              />
              <FaqItem
                q="¿Puedo recomendar aunque no venda fotos yo?"
                a="Sí. Muchos recomendadores nunca subieron una foto. Alcanza con tener llegada a fotógrafos."
              />
              <FaqItem
                q="¿Cómo sé si alguien se registró con mi link?"
                a="Entrando a tu cuenta desde Ingresar. Ahí ves tus referidos y las comisiones que se van generando."
              />
              <FaqItem
                q="¿Y si más adelante quiero vender mis fotos acá?"
                a="Podés. Tu cuenta ya queda creada como fotógrafo: entrás, conectás Mercado Pago y empezás, sin perder tu historial de recomendador."
              />
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white py-8 text-center text-sm text-[#6b7280]">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <p>© {new Date().getFullYear()} ComprameLaFoto</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/terminos" className="hover:text-[#c27b3d]">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-[#c27b3d]">
              Privacidad
            </Link>
          </div>
        </div>
      </footer>

      {!success && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md sm:hidden">
          <Button type="button" variant="primary" className="w-full py-3.5 text-base font-bold" onClick={scrollToForm}>
            {primaryCtaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-base font-bold text-[#111827] sm:px-6 sm:text-lg"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {q}
        <span className="shrink-0 font-normal text-[#c27b3d]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <p className="border-t border-black/5 px-5 pb-5 pt-1 text-base leading-relaxed text-[#6b7280] sm:px-6">{a}</p>
      )}
    </div>
  );
}
