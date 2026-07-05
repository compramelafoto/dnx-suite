"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CHARLAS_FPR_TALK_SLUG } from "@/lib/charlasfpr";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Layers,
  MapPin,
  MessageCircle,
  Rocket,
  Sparkles,
  Ticket,
  TrendingUp,
  User,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";

const CTA_PRIMARY = "Reservar mi lugar gratis";

/** Fecha y hora del evento (texto visible en la landing y coherente con admin/DB) */
const CHARLA_FECHA_HORA = "14 de mayo · 19:00 Hrs";

/** Banner del hero (OG / preview social siguen este arte en page.tsx) */
const CHARLAS_HERO_ART = "/images/charlasfpr/hero-sfpr-banner-v5.png";

/** Miniatura cuadrada del bloque Disertante (retrato, no el banner) */
const CHARLAS_DISERTANTE_THUMB = "/images/charlasfpr/charlas-disertante-thumb-v2.png";

const MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=Ricchieri+426%2C+Rosario%2C+Santa+Fe%2C+Argentina";

const MAPS_EMBED_GOOGLE =
  "https://www.google.com/maps/embed?origin=mfe&pb=!1m4!2m1!1sRicchieri+426,+Rosario,+Santa+Fe,+Argentina!5e0!6i16!3m1!1ses!5m1!1ses";

function PackageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  );
}

const FORYOU_CARDS = [
  "Hacés fotos escolares y terminás con cientos de mensajes.",
  "Cubrís deportes o eventos y después te cuesta vender las fotos.",
  "Usás planillas, WhatsApp y carpetas desordenadas para entregar.",
  "Querés cobrar mejor y perder menos tiempo administrativo.",
  "Querés sumar una herramienta para vender fotos de forma más profesional.",
];

const PROBLEM_LIST = [
  "Pierdo horas respondiendo mensajes.",
  "No logro organizar bien las entregas.",
  "Las escuelas me generan demasiado trabajo administrativo.",
  "No sé cómo vender más después de sacar las fotos.",
  "Me cuesta cobrar y ordenar pedidos.",
  "Tengo miles de fotos desordenadas.",
];

type LearnItemIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const LEARN_ITEMS: { icon: LearnItemIcon; text: string }[] = [
  { icon: TrendingUp, text: "Cómo vender más fotos después de una cobertura." },
  { icon: Layers, text: "Cómo ordenar fotos por curso, equipo, alumno o participante." },
  { icon: MessageCircle, text: "Cómo reducir mensajes manuales." },
  { icon: Wallet, text: "Cómo cobrar y registrar pedidos sin planillas eternas." },
  { icon: PackageIcon, text: "Cómo preparar entregas físicas más ordenadas." },
  { icon: Sparkles, text: "Cómo usar IA y automatización para ahorrar tiempo." },
  { icon: GraduationCap, text: "Cómo aplicar ComprameLaFoto en fotografía escolar y deportiva." },
  { icon: Rocket, text: "Cómo transformar una cobertura en una oportunidad real de negocio." },
];

const CLF_BULLETS = [
  "Galerías online listas para vender.",
  "Organización por cursos, equipos o eventos.",
  "Pedidos identificados y fáciles de entregar.",
  "Menos WhatsApp y menos errores.",
  "Mejor experiencia para clientes, escuelas y familias.",
  "Más control sobre cada venta.",
];

const BEFORE_ITEMS = [
  "Mensajes por todos lados",
  "Pedidos anotados a mano",
  "Fotos difíciles de encontrar",
  "Cobros desordenados",
  "Entregas con riesgo de error",
];

const AFTER_ITEMS = [
  "Galería online",
  "Pedidos centralizados",
  "Fotos organizadas",
  "Cobros y entregas más simples",
  "Flujo más profesional y rentable",
];

const DANIEL_TAGS = [
  "Eventos sociales",
  "Emprendimiento",
  "Automatización",
  "CRM",
  "Ventas",
  "Organización de flujos",
];

const PHOTO_TYPES = [
  { value: "", label: "Seleccioná una opción" },
  { value: "Escolar", label: "Escolar" },
  { value: "Deportiva", label: "Deportiva" },
  { value: "Escolar y deportiva", label: "Escolar y deportiva" },
  { value: "Eventos / social", label: "Eventos / social" },
  { value: "Otro", label: "Otro" },
];

const META_ITEMS = [
  { icon: Calendar, label: "Fecha y hora", value: CHARLA_FECHA_HORA },
  { icon: MapPin, label: "Lugar", value: "SFPR — Sociedad de Fotógrafos Profesionales de Rosario" },
  { icon: Ticket, label: "Dirección", value: "Ricchieri 426, Rosario, Santa Fe" },
  { icon: BadgeCheck, label: "Modalidad", value: "Presencial y gratuita" },
  { icon: User, label: "Disertante", value: "Daniel Cuart" },
];

function scrollToRegistro() {
  document.getElementById("registro")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandPrimaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-[#c27b3d] px-8 py-3.5 text-base font-semibold text-white shadow-[0_14px_40px_-14px_rgba(194,123,61,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#a86835] hover:shadow-[0_20px_50px_-14px_rgba(194,123,61,0.55)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
    >
      {children}
    </button>
  );
}

function LandSecondarySolid({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full border border-neutral-900/10 bg-white px-8 py-3.5 text-base font-semibold text-neutral-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-900/25 hover:bg-neutral-50 hover:shadow-md active:translate-y-0 active:scale-[0.99] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
        className
      )}
    >
      {children}
    </button>
  );
}

function LandPrimaryLink({ className, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      className={cn(
        "inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-[#c27b3d] px-8 py-3.5 text-base font-semibold text-white shadow-[0_14px_40px_-14px_rgba(194,123,61,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#a86835] hover:shadow-[0_20px_50px_-14px_rgba(194,123,61,0.55)] active:translate-y-0 active:scale-[0.99]",
        className
      )}
    >
      {children}
    </a>
  );
}

function LandOutlineLink({
  className,
  children,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      {...props}
      className={cn(
        "inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full border border-neutral-900/15 bg-white px-8 py-3.5 text-base font-semibold text-neutral-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-900/30 hover:bg-neutral-50 hover:shadow-md active:translate-y-0 active:scale-[0.99] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
        className
      )}
    >
      {children}
    </a>
  );
}

/** Contenedor estándar: max-w-7xl + paddings solicitados */
function SectionContain({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("w-full min-w-0 overflow-x-clip py-16 md:py-24 lg:py-28", className)}>
      <div className="mx-auto min-w-0 w-full max-w-7xl px-6 md:px-8 lg:px-12">{children}</div>
    </section>
  );
}

export default function CharlasFprClient() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    whatsapp: "",
    email: "",
    photographyType: "",
  });
  const [errors, setErrors] = useState<{
    name?: string;
    whatsapp?: string;
    email?: string;
    photographyType?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isValidEmail = useMemo(() => formData.email.includes("@") && formData.email.includes("."), [formData.email]);

  function validate() {
    const next: typeof errors = {};
    if (formData.name.trim().length < 2) next.name = "Escribí tu nombre y apellido.";
    if (formData.whatsapp.trim().length < 6) next.whatsapp = "Sumá un WhatsApp válido.";
    if (!isValidEmail) next.email = "Revisá el email.";
    if (!formData.photographyType) next.photographyType = "Elegí una opción.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/charlasfpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, slug: CHARLAS_FPR_TALK_SLUG }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos registrar tus datos.");
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error enviando el formulario.";
      setErrors((prev) => ({ ...prev, form: msg }));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-2.5 block w-full min-w-0 rounded-xl border border-neutral-900/10 bg-white px-4 py-3.5 text-base text-neutral-900 shadow-inner shadow-neutral-950/5 placeholder:text-neutral-400 transition-[box-shadow,border-color] duration-150 focus:border-[#c27b3d]/50 focus:outline-none focus:ring-[3px] focus:ring-[#c27b3d]/20 dark:border-white/15 dark:bg-[#111318] dark:text-white dark:focus:border-[#c27b3d]/55";

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#f7f5f2] font-sans text-neutral-900 antialiased dark:bg-[#0c0d11] dark:text-neutral-100">
      <main className="w-full min-w-0">
        {/* Hero principal: arte de la charla */}
        <header className="w-full min-w-0 bg-[#08090d]">
          <h1 className="sr-only">
            Charla gratuita para fotógrafos en Rosario · Vendé más fotos sin vivir respondiendo mensajes · {CHARLA_FECHA_HORA}{" "}
            SFPR · ComprameLaFoto
          </h1>
          <div className="mx-auto max-w-[1920px]">
            <Image
              src={CHARLAS_HERO_ART}
              alt="Charla gratuita ComprameLaFoto en Rosario — banner promocional con Daniel Cuart."
              width={1024}
              height={561}
              className="h-auto w-full"
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        </header>

        {/* CTAs rápidos y datos del evento (poster arriba; acá continuamos en sitio) */}
        <SectionContain className="scroll-mt-8 border-b border-neutral-900/8 bg-[#f7f5f2] py-10 dark:border-white/10 dark:bg-[#0c0d11] md:py-14">
          <div className="flex w-full min-w-0 flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center">
            <LandPrimaryButton className="w-full sm:w-auto" onClick={scrollToRegistro}>
              {CTA_PRIMARY}
            </LandPrimaryButton>
            <LandOutlineLink
              href={MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              Ver ubicación
            </LandOutlineLink>
          </div>
          <div className="mt-10 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {META_ITEMS.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="min-w-0 rounded-2xl border border-neutral-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#151820]"
              >
                <div className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#c27b3d]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {label}
                    </p>
                    <p className="mt-1.5 text-sm font-medium leading-snug text-neutral-900 sm:text-[0.9375rem] dark:text-white">
                      {value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionContain>
        {/* Esta charla es para vos */}
        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <div className="w-full min-w-0">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Esta charla es para vos si…
            </h2>
          </div>
          <ul className="mt-10 grid w-full grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
            {FORYOU_CARDS.map((text) => (
              <li
                key={text}
                className="group flex min-h-full min-w-0 flex-col rounded-2xl border border-neutral-900/8 bg-white p-7 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c27b3d]/25 hover:shadow-[0_12px_40px_-12px_rgba(194,123,61,0.15)] dark:border-white/10 dark:bg-[#14161d]"
              >
                <div className="flex min-w-0 flex-1 gap-4">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#c27b3d]" aria-hidden />
                  <p className="min-w-0 flex-1 text-base leading-relaxed text-neutral-800 md:text-lg dark:text-neutral-200">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-12">
            <LandPrimaryButton onClick={scrollToRegistro}>{CTA_PRIMARY}</LandPrimaryButton>
          </div>
        </SectionContain>

        {/* Problema / venta */}
        <SectionContain className="bg-neutral-100/80 dark:bg-[#101218]">
          <div className="w-full max-w-7xl rounded-[1.75rem] border border-neutral-900/6 bg-white p-8 md:p-12 lg:p-14 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#151820]">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              El problema no es sacar fotos, es venderlas y entregarlas sin caos
            </h2>
            <p className="mt-6 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
              Muchos fotógrafos hacen buenas coberturas, pero pierden horas después del evento respondiendo mensajes,
              buscando fotos, anotando pedidos, controlando pagos y armando entregas. En esta charla vamos a ver cómo
              ordenar ese proceso para que la venta sea más simple, más clara y más rentable.
            </p>
          </div>
        </SectionContain>

        {/* Qué problema resolvemos */}
        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <div className="w-full min-w-0">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Qué problema vamos a resolver
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
              Si te resuena alguna de estas situaciones, en la charla vas a ver un camino concreto.
            </p>
          </div>
          <ul className="mt-12 grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
            {PROBLEM_LIST.map((p) => (
              <li
                key={p}
                className="flex min-w-0 gap-4 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/70 p-6 md:p-7 dark:border-amber-800/40 dark:from-amber-950/30 dark:via-transparent dark:to-orange-950/10"
              >
                <Zap className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <p className="min-w-0 flex-1 text-base font-medium leading-relaxed text-amber-950 md:text-lg dark:text-amber-100">
                  {p}
                </p>
              </li>
            ))}
          </ul>
        </SectionContain>

        {/* Qué vas a aprender */}
        <SectionContain className="bg-neutral-100/80 dark:bg-[#101218]">
          <div className="w-full min-w-0">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Qué vas a aprender
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
              Contenido directo, aplicable a tu operación diaria.
            </p>
          </div>
          <ul className="mt-12 grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {LEARN_ITEMS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex min-h-full min-w-0 flex-col rounded-2xl border border-neutral-900/8 bg-white p-7 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c27b3d]/22 hover:shadow-lg dark:border-white/10 dark:bg-[#151820]"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#c27b3d]/12 text-[#c27b3d]">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <p className="min-w-0 flex-1 text-base leading-relaxed text-neutral-800 md:text-lg dark:text-neutral-200">{text}</p>
              </li>
            ))}
          </ul>
        </SectionContain>

        {/* ComprameLaFoto */}
        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <div className="w-full min-w-0">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Una herramienta para que tus fotos se vendan mejor
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
              ComprameLaFoto permite crear galerías online, organizar pedidos, automatizar ventas, cobrar de forma más
              simple y entregar fotos con menos errores. Está pensada para fotógrafos que quieren dejar de administrar
              todo a mano y empezar a trabajar con un flujo más profesional.
            </p>
          </div>
          <div className="mt-12 grid w-full grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <ul className="min-w-0 space-y-4">
              {CLF_BULLETS.map((line) => (
                <li key={line} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#c27b3d]" aria-hidden />
                  <span className="min-w-0 flex-1 text-base leading-relaxed text-neutral-800 md:text-lg dark:text-neutral-200">{line}</span>
                </li>
              ))}
            </ul>
            <div className="grid min-w-0 gap-5">
              <div className="overflow-hidden rounded-2xl border border-neutral-900/8 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.2)] dark:border-white/10">
                <Image
                  src="/images/landescolar/sobres-etiquetados-compramelafoto.png"
                  alt="Pedidos más ordenados"
                  width={640}
                  height={400}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-neutral-900/8 shadow-md dark:border-white/10">
                <Image
                  src="/images/landescolar/escuela-principal-2026.png"
                  alt="Flujo escolar"
                  width={640}
                  height={340}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap gap-4">
            <LandPrimaryButton onClick={scrollToRegistro}>{CTA_PRIMARY}</LandPrimaryButton>
            <LandSecondarySolid
              type="button"
              className="w-full sm:w-auto"
              onClick={() => router.push("/registro")}
            >
              Crear cuenta en ComprameLaFoto
            </LandSecondarySolid>
          </div>
        </SectionContain>

        {/* Comparación antes / después */}
        <SectionContain className="bg-neutral-100/80 dark:bg-[#101218]">
          <div className="w-full min-w-0">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Flujo antes y después
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
              Comparación típica de equipos que pasan del caos administrativo a un circuito ordenado.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-neutral-900/8 bg-neutral-900/5 shadow-[0_28px_100px_-50px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid grid-cols-1 divide-y divide-neutral-900/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-white/10">
              <div className="min-w-0 bg-gradient-to-b from-rose-50/90 to-white p-8 md:p-10 lg:p-12 dark:from-rose-950/25 dark:to-[#13151c]">
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300">
                    <XCircle className="h-6 w-6" aria-hidden />
                  </div>
                  <span className="text-lg font-bold text-rose-950 dark:text-rose-100">Antes</span>
                </div>
                <ul className="space-y-4">
                  {BEFORE_ITEMS.map((item) => (
                    <li key={item} className="flex gap-3 text-base leading-relaxed text-rose-900/90 md:text-lg dark:text-rose-100/90">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
                      <span className="min-w-0 flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 bg-gradient-to-b from-emerald-50/90 to-white p-8 md:p-10 lg:p-12 dark:from-emerald-950/20 dark:to-[#13151c]">
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-6 w-6" aria-hidden />
                  </div>
                  <span className="text-lg font-bold text-emerald-950 dark:text-emerald-100">Después con ComprameLaFoto</span>
                </div>
                <ul className="space-y-4">
                  {AFTER_ITEMS.map((item) => (
                    <li key={item} className="flex gap-3 text-base leading-relaxed text-emerald-900/90 md:text-lg dark:text-emerald-100/90">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                      <span className="min-w-0 flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </SectionContain>

        {/* Daniel */}
        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <div className="overflow-hidden rounded-[1.75rem] border border-neutral-900/8 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-[#151820] md:p-12">
            <div className="flex min-w-0 flex-col gap-10 md:flex-row md:gap-14">
              <div className="flex shrink-0 justify-center md:justify-start">
                {/* Miniatura: retrato dedicado (no el recorte del banner) */}
                <div className="relative isolate h-40 w-40 shrink-0 overflow-hidden rounded-3xl shadow-[0_20px_48px_-18px_rgba(194,123,61,0.45)] ring-2 ring-[#c27b3d]/20 ring-offset-2 ring-offset-white dark:ring-offset-[#151820] sm:h-48 sm:w-48">
                  <Image
                    src={CHARLAS_DISERTANTE_THUMB}
                    alt="Daniel Cuart — disertante de la charla"
                    fill
                    className="object-cover object-[50%_42%] contrast-[1.03] saturate-[0.97]"
                    sizes="(max-width: 768px) 160px, 192px"
                    loading="lazy"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-transparent via-transparent to-[#c27b3d]/[0.22] dark:to-[#c27b3d]/[0.18]"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#c27b3d]/[0.06] via-transparent to-transparent"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-6 md:pt-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c27b3d]">Disertante</p>
                <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
                  Daniel Cuart
                </h2>
                <p className="w-full min-w-0 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
                  Daniel Cuart es fotógrafo profesional de eventos sociales y fundador de ComprameLaFoto.
                  También desarrolla herramientas orientadas a modernizar y profesionalizar el trabajo de fotógrafos en toda Latinoamérica.
                </p>
                <div className="flex flex-wrap gap-2">
                  {DANIEL_TAGS.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-neutral-900/10 bg-neutral-50 px-4 py-2 text-sm font-medium dark:border-white/12 dark:bg-white/8"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <LandPrimaryButton onClick={scrollToRegistro}>{CTA_PRIMARY}</LandPrimaryButton>
              </div>
            </div>
          </div>
        </SectionContain>

        {/* Ubicación */}
        <SectionContain className="bg-neutral-100/80 dark:bg-[#101218]">
          <div className="w-full min-w-0">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Ubicación
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-700 md:text-lg dark:text-neutral-300">
              <strong className="font-semibold text-neutral-900 dark:text-white">
                Sociedad de Fotógrafos Profesionales de Rosario
              </strong>
              <br />
              Ricchieri 426, Rosario, Santa Fe
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-neutral-900/10 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#151820] md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c27b3d]/12 text-[#c27b3d]">
                  <MapPin className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Te esperamos acá</p>
                  <p className="mt-1 text-base font-semibold leading-snug text-neutral-900 dark:text-white md:text-lg">
                    Ricchieri 426 · Rosario, Santa Fe
                  </p>
                </div>
              </div>
              <LandPrimaryLink
                href={MAPS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full shrink-0 md:w-auto"
              >
                Abrir en Google Maps
              </LandPrimaryLink>
            </div>

            <div className="relative mt-8 overflow-hidden rounded-2xl border border-neutral-900/10 bg-neutral-100/50 dark:border-white/10 dark:bg-neutral-900/30">
              <div className="relative aspect-[16/10] min-h-[260px] w-full sm:aspect-[2/1] sm:min-h-[300px]">
                <iframe
                  title="Mapa Ricchieri 426 Rosario"
                  src={MAPS_EMBED_GOOGLE}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <p className="border-t border-neutral-900/10 px-4 py-3 text-center text-sm text-neutral-600 dark:border-white/10 dark:text-neutral-400">
                ¿No ves el mapa?{" "}
                <a
                  href={MAPS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#c27b3d] underline underline-offset-2 hover:text-[#a86835]"
                >
                  Abrí Google Maps
                </a>
              </p>
            </div>
          </div>
        </SectionContain>

        {/* Formulario */}
        <SectionContain id="registro" className="scroll-mt-28 bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <div className="mx-auto w-full max-w-5xl min-w-0">
            <div className="rounded-[1.75rem] border border-neutral-900/10 bg-white p-8 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#151820] md:p-12">
              {!submitted ? (
                <>
                  <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-white">
                    Reservá tu lugar
                  </h2>
                  <p className="mt-4 w-full min-w-0 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
                    Completá el formulario para la charla del{" "}
                    <strong className="text-neutral-900 dark:text-white">{CHARLA_FECHA_HORA}</strong> en la SFPR.
                  </p>
                  <form onSubmit={handleSubmit} className="mt-10 flex w-full min-w-0 flex-col gap-7">
                    <div className="w-full min-w-0">
                      <label htmlFor="clf-name" className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                        Nombre y apellido
                      </label>
                      <input
                        id="clf-name"
                        type="text"
                        autoComplete="name"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        className={inputClass}
                        placeholder="Tu nombre y apellido"
                      />
                      {errors.name ? <p className="mt-2 text-sm text-red-600">{errors.name}</p> : null}
                    </div>
                    <div className="w-full min-w-0">
                      <label htmlFor="clf-wa" className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                        WhatsApp
                      </label>
                      <input
                        id="clf-wa"
                        type="tel"
                        autoComplete="tel"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
                        className={inputClass}
                        placeholder="Ej.: 341 234 5678"
                      />
                      {errors.whatsapp ? <p className="mt-2 text-sm text-red-600">{errors.whatsapp}</p> : null}
                    </div>
                    <div className="w-full min-w-0">
                      <label htmlFor="clf-email" className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                        Email
                      </label>
                      <input
                        id="clf-email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        className={inputClass}
                        placeholder="tu@email.com"
                      />
                      {errors.email ? <p className="mt-2 text-sm text-red-600">{errors.email}</p> : null}
                    </div>
                    <div className="w-full min-w-0">
                      <label htmlFor="clf-type" className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                        Tipo de fotografía que realiza
                      </label>
                      <select
                        id="clf-type"
                        value={formData.photographyType}
                        onChange={(e) => setFormData((p) => ({ ...p, photographyType: e.target.value }))}
                        className={inputClass}
                      >
                        {PHOTO_TYPES.map((o) => (
                          <option key={o.value || "x"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {errors.photographyType ? (
                        <p className="mt-2 text-sm text-red-600">{errors.photographyType}</p>
                      ) : null}
                    </div>
                    {errors.form ? <p className="text-sm font-medium text-red-600">{errors.form}</p> : null}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex min-h-[56px] w-full cursor-pointer items-center justify-center rounded-full bg-[#c27b3d] px-8 py-4 text-lg font-semibold text-white shadow-[0_14px_40px_-14px_rgba(194,123,61,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#a86835] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                          Enviando…
                        </span>
                      ) : (
                        CTA_PRIMARY
                      )}
                    </button>
                    <p className="text-center text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                      La charla es gratuita. Te vamos a contactar por WhatsApp o email para confirmar tu lugar.
                    </p>
                  </form>
                </>
              ) : (
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#c27b3d]/15 text-[#c27b3d]">
                    <CheckCircle2 className="h-9 w-9" aria-hidden />
                  </div>
                  <h2 className="text-3xl font-semibold text-neutral-900 dark:text-white">¡Listo, recibimos tu reserva!</h2>
                  <p className="mx-auto w-full min-w-0 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
                    Te vamos a contactar por WhatsApp o email para confirmar tu lugar el {CHARLA_FECHA_HORA} en la SFPR.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <LandPrimaryLink href={MAPS_LINK} target="_blank" rel="noopener noreferrer">
                      Ver ubicación
                    </LandPrimaryLink>
                    <LandSecondarySolid onClick={() => (window.location.href = "/")} className="w-full sm:w-auto">
                      Ir al inicio
                    </LandSecondarySolid>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionContain>

        {/* CTA final */}
        <SectionContain className="border-t border-neutral-900/10 bg-neutral-100/90 dark:border-white/10 dark:bg-[#101218]">
          <div className="flex w-full min-w-0 flex-col items-center gap-8 text-center">
            <h2 className="w-full min-w-0 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-5xl dark:text-white">
              Sumate gratis y profesionalizá tu próxima temporada
            </h2>
            <p className="w-full min-w-0 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-400">
              Cupos limitados. Reservá tu lugar y coordinamos la confirmación por WhatsApp o email.
            </p>
            <LandPrimaryButton className="px-10 py-4 text-lg" onClick={scrollToRegistro}>
              {CTA_PRIMARY}
              <ArrowRight className="ml-2 inline h-5 w-5" aria-hidden />
            </LandPrimaryButton>
          </div>
        </SectionContain>
      </main>
    </div>
  );
}