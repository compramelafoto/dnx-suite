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
  totalUsers: number;
  totalPhotos: number;
  totalAmountSold: number;
};

const LANDING_STATS_POLL_MS = 15_000;

function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function fetchLandingStats(): Promise<LandingStats | null> {
  const r = await fetch(`/api/public/landing-stats?_=${Date.now()}`, {
    cache: "no-store",
    headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as Record<string, unknown>;
  if (
    typeof data.daysActive !== "number" ||
    typeof data.totalUsers !== "number" ||
    typeof data.totalPhotos !== "number" ||
    typeof data.totalAmountSold !== "number"
  ) {
    return null;
  }
  return {
    daysActive: data.daysActive,
    totalUsers: data.totalUsers,
    totalPhotos: data.totalPhotos,
    totalAmountSold: data.totalAmountSold,
  };
}

/** Unsplash — rubro / formación / encuentros (referidos y comunidad profesional) */
const IMG_HERO =
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";
const IMG_BENEFIT_COLLAB =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80";
/** Networking / colaboración en equipo */
const IMG_CRED_NETWORK =
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=80";
/** Compartir recurso o enlace en contexto profesional */
const IMG_CRED_SHARE =
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1600&q=80";

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
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-5 py-3 sm:px-8 lg:px-12">
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
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-black/5 bg-[#f7f5f2]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(194,123,61,0.2),transparent_50%)]" />
          <div className="relative mx-auto grid w-full max-w-screen-2xl gap-12 px-5 py-14 sm:px-8 md:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:px-12 lg:py-20">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#92400e] shadow-sm ring-1 ring-[#c27b3d]/30">
                  Oportunidad real si tenés llegada al rubro
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#4b5563] shadow-sm ring-1 ring-black/10">
                  Herramienta concreta para fotógrafos
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#166534] shadow-sm ring-1 ring-emerald-200">
                  Beneficios según el programa vigente
                </span>
              </div>
              <h1 className="mt-7 text-[1.65rem] font-bold leading-[1.12] tracking-tight text-[#111827] sm:text-4xl sm:leading-[1.1] lg:text-[2.5rem]">
                Tu red de fotógrafos puede convertirse en una oportunidad real
              </h1>
              <p className="mt-5 max-w-none text-lg leading-snug text-[#374151] sm:max-w-[40rem] sm:text-[1.25rem] sm:leading-relaxed lg:max-w-[44rem]">
                Si ya trabajás con fotógrafos —por eventos, comunidad, institución o audiencia— podés recomendar
                ComprameLaFoto, una plataforma pensada para vender fotos online, y acceder a beneficios según el
                programa vigente.
              </p>
              <p className="mt-3 max-w-none text-sm leading-relaxed text-[#6b7280] sm:max-w-[40rem] sm:text-base lg:max-w-[44rem]">
                No tenés que armar nada: obtenés tu link y un mensaje listo para compartir.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full justify-center px-8 py-4 text-base font-semibold sm:w-auto"
                  onClick={scrollToForm}
                >
                  {primaryCtaLabel}
                </Button>
                <a
                  href="#como-funciona"
                  className="text-center text-base font-semibold text-[#c27b3d] hover:underline sm:text-left"
                >
                  Ver cómo funciona
                </a>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-6 lg:max-w-none">
              <div className="relative h-60 w-full overflow-hidden rounded-2xl bg-[#1a1a1a] shadow-xl ring-1 ring-black/10 sm:h-72 lg:h-80">
                <Image
                  src={IMG_HERO}
                  alt="Personas en un encuentro de formación o taller profesional, contexto de comunidad y aprendizaje"
                  fill
                  className="object-cover object-[center_35%]"
                  sizes="(max-width: 1024px) 100vw, 44vw"
                  priority
                />
              </div>
              <ReferralUiMockup />
            </div>
          </div>
        </section>

        {/* Marco estratégico: qué vendemos → acción */}
        <section className="border-b border-black/5 bg-white py-12 sm:py-14">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <h2 className="text-center text-xl font-bold text-[#111827] sm:text-2xl">En una frase</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  k: "Qué es",
                  v: "Una plataforma para que fotógrafos vendan online con orden y profesionalismo.",
                },
                {
                  k: "Para quién es este programa",
                  v: "Para quien ya tiene llegada a fotógrafos, instituciones, laboratorios, comunidades o audiencia del rubro.",
                },
                {
                  k: "Qué problemas resuelve",
                  v: "Ventas desordenadas, cobros engorrosos y poca claridad para el cliente final.",
                },
                {
                  k: "Qué resultado buscás",
                  v: "Aportar una herramienta seria al ecosistema y, si califica, convertir esa recomendación en beneficio dentro del programa vigente.",
                },
                {
                  k: "Qué tenés que hacer",
                  v: "Registrarte, compartir tu enlace con criterio y usar los mensajes que te damos. Sin infraestructura propia.",
                },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-black/5 bg-[#f7f5f2] p-5 shadow-sm ring-1 ring-black/[0.03] sm:p-6"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[#c27b3d]">{item.k}</p>
                  <p className="mt-2 text-base leading-relaxed text-[#374151]">{item.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Beneficio real: por qué conviene */}
        <section className="border-b border-black/5 bg-[#faf9f7] py-14 sm:py-16">
          <div className="mx-auto grid w-full max-w-screen-2xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:gap-14 lg:px-12">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">
                Por qué te puede convenir recomendar ComprameLaFoto
              </h2>
              <p className="mt-4 max-w-none text-base leading-relaxed text-[#4b5563] sm:max-w-[48rem] sm:text-lg">
                Si ya tenés llegada a fotógrafos —por tu trabajo, tu institución o tu audiencia—{" "}
                <strong className="font-semibold text-[#111827]">no arrancás de cero</strong>: ese vínculo es un activo.
                Acá lo podés usar para pasar una herramienta concreta: cobros, galerías y flujos pensados para el rubro.
              </p>
              <ul className="mt-8 max-w-none space-y-4 text-base leading-relaxed text-[#374151] sm:max-w-[48rem] sm:text-lg">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                  Recomendás algo que el otro puede usar mañana, no una idea vaga de &ldquo;vender mejor&rdquo;.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                  Esa recomendación, cuando califique según el programa vigente, puede traducirse en un beneficio real —
                  sin promesas mágicas: depende de reglas, uso y condiciones.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                  Vos no montás plataforma ni integraciones: compartís tu link y el mensaje; ComprameLaFoto resuelve la
                  experiencia del lado técnico.
                </li>
              </ul>
              <div className="mt-10">
                <Button type="button" variant="primary" className="px-8 py-3.5 text-base font-semibold" onClick={scrollToForm}>
                  Quiero recomendar ComprameLaFoto
                </Button>
              </div>
            </div>
            <div className="relative mx-auto min-h-[220px] w-full max-w-lg overflow-hidden rounded-2xl bg-[#e8e4df] shadow-lg ring-1 ring-black/5 sm:min-h-[280px] lg:max-w-none">
              <Image
                src={IMG_BENEFIT_COLLAB}
                alt="Equipo colaborando: trabajo en conjunto y recomendación entre pares"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
        </section>

        {/* Público objetivo explícito */}
        <section className="border-b border-black/5 bg-[#f7f5f2] py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <h2 className="text-center text-2xl font-bold text-[#111827] sm:text-3xl">Ideal para…</h2>
            <p className="mx-auto mt-3 max-w-5xl text-center text-base leading-relaxed text-[#6b7280] sm:text-lg">
              El programa no está pensado solo para fotógrafos individuales: sirve para cualquier perfil que cruce
              habitualmente con el ecosistema de la fotografía y quiera recomendar con fundamento.
            </p>
            <ul className="mx-auto mt-8 flex max-w-6xl flex-wrap justify-center gap-3">
              {[
                "Fotógrafos y estudios",
                "Escuelas o instituciones vinculadas a la fotografía",
                "Laboratorios",
                "Organizadores de workshops, congresos y encuentros del rubro",
                "Influencers o referentes con audiencia fotográfica",
                "Empresas o marcas que trabajan con fotógrafos",
                "Comunidades, asociaciones y grupos del sector",
              ].map((label) => (
                <li
                  key={label}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm ring-1 ring-black/8"
                >
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex justify-center">
              <Button type="button" variant="primary" className="px-8 py-3.5 text-base font-semibold" onClick={scrollToForm}>
                Quiero recomendar ComprameLaFoto
              </Button>
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-24 border-b border-black/5 bg-white py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <h2 className="text-center text-2xl font-bold text-[#111827] sm:text-3xl">Cómo funciona</h2>
            <p className="mx-auto mt-3 max-w-5xl text-center text-base leading-relaxed text-[#6b7280] sm:text-lg">
              Cuatro pasos, sin vueltas: registrarte, obtener tu canal de recomendación y salir a compartir con mensajes
              listos.
            </p>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: "1",
                  t: "Completás tus datos",
                  d: "Nombre, email y WhatsApp. Instagram y tipo de perfil son opcionales pero nos ayudan a entenderte.",
                },
                {
                  n: "2",
                  t: "Te activamos como recomendador",
                  d: "Te damos acceso a la plataforma como recomendador y, si hace falta, te pedimos que valides el correo.",
                },
                {
                  n: "3",
                  t: "Recibís tu canal de recomendación",
                  d: "Link personal y mensajes sugeridos para copiar o enviar por WhatsApp Web: tenés todo para explicar la propuesta con claridad.",
                },
                {
                  n: "4",
                  t: "Empezás a compartir con criterio",
                  d: "Colegas, alumnos, institución o audiencia: vos elegís dónde y cuándo; la herramienta ya está del otro lado.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex flex-col rounded-2xl border border-black/5 bg-[#f7f5f2] p-5 sm:p-6 shadow-sm"
                >
                  <span className="text-sm font-bold text-[#c27b3d]">{step.n}</span>
                  <h3 className="mt-2 text-base font-bold text-[#111827]">{step.t}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#6b7280] sm:text-base">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Escenario realista (sin promesas exageradas) */}
        <section className="border-b border-black/5 bg-gradient-to-b from-[#fffdfb] to-[#f7f5f2] py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border-2 border-[#c27b3d]/25 bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04]">
              <div className="border-b border-[#c27b3d]/15 bg-gradient-to-r from-[#c27b3d]/10 to-transparent px-6 py-4 sm:px-10 sm:py-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#92400e]">Ejemplo concreto</p>
                <h2 className="mt-1 text-xl font-bold text-[#111827] sm:text-2xl">
                  Un escenario que podés imaginar (sin cuentas de fantasía)
                </h2>
              </div>
              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <p className="text-base leading-relaxed text-[#4b5563] sm:text-lg">
                  Imaginá que compartís tu enlace en una comunidad, un taller, un evento o una institución. No todos se
                  van a registrar: eso es normal. Pongamos un caso prudente: de un grupo de interesados, unas pocas
                  personas dan el paso; entre ellas, una empieza a usar la plataforma en serio para vender fotos.
                </p>
                <div className="mt-6 rounded-2xl border border-[#c27b3d]/25 bg-gradient-to-br from-[#fffbf7] to-[#faf8f5] p-5 shadow-sm ring-1 ring-[#c27b3d]/10 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#92400e]">
                    Ejemplo numérico (ilustrativo, no promesa)
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-[#374151] sm:text-lg">
                    Suponé que tu recomendación le llega a <strong className="font-semibold text-[#111827]">100</strong>{" "}
                    fotógrafos y que, solo para simplificar la cuenta, cada uno{" "}
                    <strong className="font-semibold text-[#111827]">factura $100.000 por mes</strong> a través de la
                    plataforma. Son números redondos nomás: en ese supuesto, habría{" "}
                    <strong className="font-semibold text-[#111827]">$10.000.000 por mes</strong> de facturación combinada
                    entre esas cuentas (100 × $100.000).
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#6b7280] sm:text-base">
                    Eso no dice cuánto recibís vos como recomendador: eso lo fija el programa vigente, los porcentajes y
                    los términos. Acá lo único que hacemos es mostrar la magnitud cuando hay escala y uso real del otro
                    lado.
                  </p>
                </div>
                <p className="mt-6 text-base leading-relaxed text-[#4b5563] sm:text-lg">
                  En ese tipo de escenario, tu recomendación deja de ser solo un consejo suelto y pasa a ser{" "}
                  <strong className="font-semibold text-[#111827]">una oportunidad concreta dentro del programa vigente</strong>
                  —siempre sujeta a términos, condiciones y a lo que efectivamente ocurra del otro lado.
                </p>
                <ol className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      n: "1",
                      t: "Compartís tu link donde tiene sentido: comunidad, taller, encuentro o institución.",
                    },
                    {
                      n: "2",
                      t: "Algunas personas se registran; el volumen depende del contexto y del interés real.",
                    },
                    {
                      n: "3",
                      t: "Quien use la plataforma para vender suma actividad al ecosistema.",
                    },
                    {
                      n: "4",
                      t: "Si corresponde según el programa vigente, tu rol puede asociarse a beneficios o comisiones.",
                    },
                  ].map((row) => (
                    <li
                      key={row.n}
                      className="flex gap-4 rounded-2xl border border-black/5 bg-[#fafaf9] p-4 shadow-sm"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c27b3d]/15 text-sm font-bold text-[#b45309]"
                        aria-hidden
                      >
                        {row.n}
                      </span>
                      <p className="text-sm leading-relaxed text-[#374151] sm:text-base">{row.t}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-8 text-sm leading-relaxed text-[#6b7280]">
                  No hay montos garantizados ni resultados automáticos: lo que sí hay es una herramienta real y un programa
                  con reglas claras. Los detalles finos están en los{" "}
                  <Link href="/terminos" className="font-semibold text-[#c27b3d] underline-offset-2 hover:underline">
                    términos y condiciones
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Beneficios — primero beneficio, después condiciones */}
        <section className="border-b border-black/5 bg-[#f7f5f2] py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <h2 className="text-center text-2xl font-bold text-[#111827] sm:text-3xl">
              Qué ganás al sumarte como recomendador
            </h2>
            <p className="mx-auto mt-3 max-w-5xl text-center text-base leading-relaxed text-[#6b7280] sm:text-lg">
              Primero el valor que aportás al rubro; después, cómo se conecta eso con beneficios concretos según el
              programa vigente.
            </p>
            <ul className="mx-auto mt-10 max-w-6xl space-y-4">
              {[
                "Recomendás una herramienta útil: cobros, galerías y flujos pensados para que los fotógrafos vendan online sin caos.",
                "Ayudás a otros del rubro —colegas, alumnos, clientes o derivaciones— a ordenar la experiencia de compra y el cobro.",
                "Obtenés tu enlace y mensajes listos para compartir: en minutos podés actuar sin redactar todo desde cero.",
                "Podés acceder a beneficios o comisiones según el esquema vigente y los requisitos que correspondan (registros, uso, pagos, etc.).",
                "No necesitás usar ComprameLaFoto como vendedor para empezar: muchos recomendadores entran solo con ese rol.",
                "Más adelante vas a poder seguir resultados y gestionar lo referido desde tu panel, a medida que habilitemos más vistas.",
              ].map((text) => (
                <li
                  key={text.slice(0, 28)}
                  className="flex gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="mt-0.5 shrink-0 font-bold text-[#c27b3d]">✓</span>
                  <span className="text-base leading-relaxed text-[#374151]">{text}</span>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-8 max-w-5xl text-center text-sm leading-relaxed text-[#6b7280] sm:text-base">
              Porcentajes, plazos, topes y requisitos para cobrar comisiones: todo eso está detallado en los{" "}
              <Link href="/terminos" className="font-semibold text-[#c27b3d] underline-offset-2 hover:underline">
                términos y condiciones
              </Link>
              . Si algo no te cierra, leelos antes de asumir condiciones que no aplican.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button type="button" variant="primary" className="px-8 py-3.5 font-semibold" onClick={scrollToForm}>
                Empezar a recomendar ahora
              </Button>
            </div>
          </div>
        </section>

        {/* Credibilidad */}
        <section className="border-b border-black/5 bg-white py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <h2 className="text-center text-2xl font-bold text-[#111827] sm:text-3xl">Por qué confiar</h2>
            <p className="mx-auto mt-3 max-w-5xl text-center text-base leading-relaxed text-[#6b7280] sm:text-lg">
              Los mismos números públicos que mostramos en la landing principal: actividad real de la plataforma. Se
              actualizan automáticamente.
            </p>
            {landingStats && (
              <div className="mx-auto mt-8 max-w-5xl space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      fetchLandingStats().then((s) => {
                        if (s) setLandingStats(s);
                      });
                    }}
                    className="text-xs text-[#6b7280] underline-offset-2 transition-colors hover:text-[#c27b3d] hover:underline"
                  >
                    Actualizar números
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-black/5 bg-[#f7f5f2] p-4 text-center shadow-sm">
                    <p className="text-xl font-bold text-[#c27b3d] sm:text-2xl">
                      {landingStats.daysActive.toLocaleString("es-AR")}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280] sm:text-sm">
                      Días de plataforma activa
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[#f7f5f2] p-4 text-center shadow-sm">
                    <p className="text-xl font-bold text-[#c27b3d] sm:text-2xl">
                      {landingStats.totalUsers.toLocaleString("es-AR")}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280] sm:text-sm">
                      Usuarios registrados
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[#f7f5f2] p-4 text-center shadow-sm">
                    <p className="text-xl font-bold text-[#c27b3d] sm:text-2xl">
                      {landingStats.totalPhotos.toLocaleString("es-AR")}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280] sm:text-sm">
                      Fotos subidas
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[#f7f5f2] p-4 text-center shadow-sm">
                    <p className="break-words text-lg font-bold leading-tight text-[#c27b3d] sm:text-xl md:text-2xl">
                      {formatARS(landingStats.totalAmountSold)}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280] sm:text-sm">
                      Vendido en la plataforma
                    </p>
                  </div>
                </div>
              </div>
            )}
            <ul className="mx-auto mt-8 max-w-5xl space-y-3 text-base leading-relaxed text-[#4b5563] sm:text-lg">
              <li className="flex gap-3">
                <span className="text-[#c27b3d]">●</span>
                Plataforma en uso: los números de arriba reflejan actividad real, no una promesa de marketing.
              </li>
              <li className="flex gap-3">
                <span className="text-[#c27b3d]">●</span>
                Producto pensado para el rubro: cobros, galerías y experiencia de compra ordenada.
              </li>
              <li className="flex gap-3">
                <span className="text-[#c27b3d]">●</span>
                Tu cuenta de recomendador queda registrada: enlace, código y seguimiento asociados a vos.
              </li>
            </ul>
            <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-[#e8e4df] shadow-lg ring-1 ring-black/5 sm:h-64 lg:h-72">
                <Image
                  src={IMG_CRED_NETWORK}
                  alt="Personas en contexto de trabajo colaborativo y redes profesionales"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-[#1a1a1a] shadow-lg ring-1 ring-black/10 sm:h-64 lg:h-72">
                <Image
                  src={IMG_CRED_SHARE}
                  alt="Compartir recursos o enlaces en un entorno profesional digital"
                  fill
                  className="object-cover object-[center_45%]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA intermedia */}
        <section className="border-b border-black/5 bg-[#faf9f7] py-10">
          <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8 lg:px-12">
            <p className="max-w-4xl text-center text-lg font-semibold leading-snug text-[#111827] sm:flex-1 sm:text-left sm:text-xl">
              ¿Querés pasar de tener contactos a recomendar con herramienta y respaldo claros?
            </p>
            <Button type="button" variant="primary" className="w-full shrink-0 px-8 py-3.5 font-semibold sm:w-auto" onClick={scrollToForm}>
              Empezar a recomendar ahora
            </Button>
          </div>
        </section>

        {/* FORMULARIO */}
        <section id="formulario-recomendanos" className="scroll-mt-24 border-b border-black/5 bg-white py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            {success ? (
              <div className="mx-auto w-full max-w-5xl">
                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-[#ecfdf5] to-white p-6 shadow-lg sm:p-10">
                  <p className="text-2xl font-bold text-emerald-950">Listo: ya podés recomendar con fundamento</p>
                  <p className="mt-2 text-base text-emerald-900/90">
                    Tenés tu enlace y mensajes para compartir. Copiá el link, el texto o mandalo por WhatsApp Web. Si
                    querés seguir más tarde, entrá desde <strong>Ingresar</strong>.
                  </p>
                  {success.infoMessage && (
                    <p className="mt-4 rounded-xl bg-white/80 p-3 text-sm text-emerald-900/95 ring-1 ring-emerald-200/80">
                      {success.infoMessage}
                    </p>
                  )}
                  <div className="mt-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">Tu enlace personal</p>
                    <p className="mt-2 break-all font-mono text-sm font-medium text-[#111827]">{success.referralUrl}</p>
                    <Button type="button" variant="primary" className="mt-4 w-full font-semibold" onClick={copyLink}>
                      {copyLinkFlash ? "Copiado" : "Copiar link"}
                    </Button>
                  </div>
                  <div className="mt-5 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">Mensaje sugerido</p>
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
              </div>
            ) : (
              <>
                <div className="mx-auto w-full max-w-5xl text-center lg:text-left">
                  <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">Activá tu perfil de recomendador</h2>
                  <p className="mt-4 text-lg font-medium leading-relaxed text-[#374151] sm:text-xl">
                    Unos datos básicos y en el acto tenés tu enlace y mensajes listos. El link es la herramienta para
                    llevar adelante la recomendación; el valor está en lo que habilitás del otro lado.
                  </p>
                </div>
                <div className="mt-10">
                  <form
                    onSubmit={onSubmit}
                    className="mx-auto w-full max-w-4xl space-y-5 lg:max-w-5xl"
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
                          Generando tu acceso…
                        </span>
                      ) : (
                        primaryCtaLabel
                      )}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-black/5 bg-[#f7f5f2] py-14 sm:py-16">
          <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
            <h2 className="text-center text-2xl font-bold text-[#111827] sm:text-3xl">Preguntas frecuentes</h2>
            <p className="mx-auto mt-2 max-w-5xl text-center text-base text-[#6b7280] sm:text-lg">
              Respuestas claras para sacarte dudas antes de mandar el formulario.
            </p>
            <dl className="mx-auto mt-8 max-w-5xl space-y-3">
              <FaqItem
                q="¿Tengo que pagar algo para recomendar?"
                a="No. Entrar al programa y obtener tu perfil de recomendador no tiene costo. Para cobrar comisiones o beneficios puede haber requisitos (por ejemplo, Mercado Pago conectado cuando corresponda): eso está en los términos y en tu cuenta."
              />
              <FaqItem
                q="¿Cómo sé si alguien se registró con mi link?"
                a="Cuando uses tu cuenta de ComprameLaFoto vas a poder ver información de referidos según las pantallas que tengamos activas. Desde esta página lo que hacés es sacar el enlace y empezar a compartir: el seguimiento fino lo ves después en el panel."
              />
              <FaqItem
                q="¿Puedo recomendar aunque todavía no use la plataforma para vender?"
                a="Sí. Mucha gente recomienda antes de vender ella misma. Tu rol acá es pasar una herramienta útil; si más adelante querés usarla como fotógrafo, ya vas a tener usuario."
              />
              <FaqItem
                q="¿Después puedo entrar a mi cuenta?"
                a="Obvio. Usá el inicio de sesión de fotógrafos. Si te mandamos mail de verificación, abrilo; si no recordás la contraseña, pedí recuperar desde el login."
              />
              <FaqItem
                q="¿Qué pasa si más adelante quiero usar ComprameLaFoto para vender?"
                a="Mejor todavía: ya tenés base. Entrás, conectás lo que falte (por ejemplo Mercado Pago) y seguís el mismo camino que cualquier fotógrafo nuevo, sin perder tu historial de recomendador."
              />
            </dl>
          </div>
        </section>

        {/* Cierre */}
        <section className="bg-gradient-to-b from-white to-[#f7f5f2] py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
            <h2 className="text-2xl font-bold text-[#111827] sm:text-3xl">
              Si tenés llegada al rubro, podés empezar a recomendar con criterio hoy
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#4b5563] sm:text-xl">
              Registrate, obtené tu enlace y los textos para compartir. No es solo un link: es la forma concreta de acercar
              ComprameLaFoto a quien te escucha —con transparencia y respaldo de plataforma.
            </p>
            <Button
              type="button"
              variant="primary"
              className="mt-10 px-10 py-4 text-base font-bold shadow-lg"
              onClick={scrollToForm}
            >
              {primaryCtaLabel}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-[#f7f5f2] py-8 text-center text-sm text-[#6b7280]">
        <div className="mx-auto w-full max-w-screen-2xl px-5 sm:px-8 lg:px-12">
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
