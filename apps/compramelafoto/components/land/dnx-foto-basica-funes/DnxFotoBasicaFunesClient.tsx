"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/lab/helpers";
import {
  DNX_FOTO_BASICA_FUNES_SLUG,
  DNX_FOTO_BASICA_FUNES_PRICE_ARS,
  DNX_FOTO_BASICA_FUNES_MAX_SEATS,
  getDnxFotoBasicaFunesWhatsAppUrl,
} from "@/lib/dnx-foto-basica-funes";

const CURSO_TITULO = "Curso Presencial de Fotografía Básica en Funes";
const CURSO_SUBTITULO =
  "Aprendé a usar tu cámara en modo manual, entender la luz y hacer mejores fotos desde la primera clase.";

/** Fecha visible acordada con el organizador */
const CURSO_INICIO_VISIBLE = "sábado 6 de junio";

const LUGAR_LINEA = "DNX Estudio, San José 1672 Local 5, Funes";
const LUGAR_COMPLETO = `${LUGAR_LINEA}, Santa Fe`;

const MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=San+Jos%C3%A9+1672+Funes+Santa+Fe+Argentina";

const HERO_FLYER = "/images/cursos/fotografia-basica-funes-flyer.jpg";
/** Dimensiones reales del arte (orientación vertical) */
const HERO_FLYER_WIDTH = 682;
const HERO_FLYER_HEIGHT = 1024;

const META_ITEMS = [
  { icon: Calendar, label: "Inicio", value: CURSO_INICIO_VISIBLE },
  { icon: Camera, label: "Horario", value: "Sábados de 15 a 17 hs" },
  { icon: BadgeCheck, label: "Duración", value: "12 clases presenciales" },
  { icon: Users, label: "Cupo", value: `Máximo ${DNX_FOTO_BASICA_FUNES_MAX_SEATS} alumnos` },
  { icon: MapPin, label: "Lugar", value: LUGAR_LINEA },
  {
    icon: ShieldCheck,
    label: "Valor total",
    value: formatARS(DNX_FOTO_BASICA_FUNES_PRICE_ARS),
  },
];

const FOR_WHO = [
  "Personas que recién empiezan en fotografía.",
  "Quienes tienen cámara réflex o mirrorless y quieren dejar de usarla en automático.",
  "Emprendedores que necesitan mejorar sus fotos.",
  "Personas que quieren aprender fotografía como hobby.",
  "Futuros fotógrafos que quieren una base sólida.",
];

const APRENDER_ITEMS = [
  "Manejo de cámara en modo manual.",
  "ISO, diafragma y tiempo de exposición.",
  "Enfoque, profundidad de campo y movimiento.",
  "Composición fotográfica.",
  "Uso de la luz natural.",
  "Retratos y fotografía urbana.",
  "Organización básica del flujo de trabajo.",
  "Criterios para seleccionar mejores fotos.",
  "Prácticas guiadas y salidas fotográficas por Funes.",
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Necesito tener cámara?",
    a: "No: no es indispensable tener una cámara profesional o semiprofesional. Podés arrancar el curso con un celular; después, si más adelante querés pasarte a una réflex o mirrorless, lo vemos juntos.",
  },
  {
    q: "¿El curso es desde cero?",
    a: "Sí. Está pensado para personas que quieren aprender fotografía básica desde una base clara y práctica.",
  },
  {
    q: "¿Qué pasa si ya sé algo de fotografía?",
    a: "También te va a servir para ordenar conceptos, mejorar la técnica y ganar seguridad al momento de fotografiar.",
  },
  {
    q: "¿Las clases son grabadas?",
    a: "No. Es un curso presencial, con trabajo práctico y acompañamiento en clase.",
  },
  {
    q: "¿Dónde se dicta?",
    a: `En ${LUGAR_COMPLETO}.`,
  },
  {
    q: "¿Cuántas clases son?",
    a: "Son 12 clases presenciales, los sábados de 15 a 17 hs.",
  },
  {
    q: "¿Hay salidas fotográficas?",
    a: "Sí. El curso incluye salidas prácticas por la ciudad de Funes para aplicar lo aprendido en situaciones reales.",
  },
  {
    q: "¿Cuántos alumnos hay por grupo?",
    a: `El cupo máximo es de ${DNX_FOTO_BASICA_FUNES_MAX_SEATS} alumnos.`,
  },
  {
    q: "¿Cómo reservo mi lugar?",
    a: "La reserva se realiza pagando el curso desde el botón de inscripción de esta página.",
  },
  {
    q: "¿El pago confirma mi inscripción?",
    a: "Sí. Una vez realizado el pago, el alumno queda inscripto automáticamente.",
  },
];

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
    <section id={id} className={cn("w-full min-w-0 overflow-x-clip py-12 sm:py-14 md:py-20 lg:py-24", className)}>
      <div className="mx-auto min-w-0 w-full max-w-6xl px-4 sm:px-6 md:px-8 lg:px-12">{children}</div>
    </section>
  );
}

/** Prosa: en móvil usa todo el ancho útil; desde md limita la medida de lectura */
function ProseMax({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-full md:max-w-3xl lg:max-w-[44rem]", className)}>
      {children}
    </div>
  );
}

function scrollToInscripcion() {
  document.getElementById("inscripcion")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DnxFotoBasicaFunesClient() {
  const whatsappUrl = getDnxFotoBasicaFunesWhatsAppUrl();
  const [cupoFull, setCupoFull] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/public/dnx-course/${DNX_FOTO_BASICA_FUNES_SLUG}/status`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.full === "boolean") {
        setCupoFull(data.full);
      }
    } catch {
      // noop: no bloquear landing
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (cupoFull) {
      setFormError("Cupo completo.");
      return;
    }
    setCheckingOut(true);
    try {
      const res = await fetch(`/api/public/dnx-course/${DNX_FOTO_BASICA_FUNES_SLUG}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && typeof data.error === "string" && data.error.toLowerCase().includes("cupo")) {
          setCupoFull(true);
        }
        const msg =
          typeof data.error === "string" ? data.error : "No se pudo iniciar el pago.";
        const devHint = typeof data.details === "string" && data.details ? ` (${data.details})` : "";
        throw new Error(msg + devHint);
      }
      const url = typeof data.initPoint === "string" ? data.initPoint : "";
      if (!url) throw new Error("Mercado Pago no devolvió el enlace de pago.");
      window.location.href = url;
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error al iniciar pago.");
    } finally {
      setCheckingOut(false);
    }
  }

  const inputClass =
    "mt-2 box-border block w-full min-w-0 max-w-full rounded-xl border border-neutral-900/10 bg-white px-4 py-3.5 text-base text-neutral-900 shadow-inner shadow-neutral-950/5 placeholder:text-neutral-400 focus:border-[#c27b3d]/50 focus:outline-none focus:ring-[3px] focus:ring-[#c27b3d]/20 dark:border-white/15 dark:bg-[#111318] dark:text-white";

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#f7f5f2] font-sans text-neutral-900 antialiased dark:bg-[#0c0d11] dark:text-neutral-100">
      <main className="w-full min-w-0">
        <header className="relative w-full min-w-0 overflow-hidden bg-black">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 items-center gap-8 px-4 pb-10 pt-8 sm:gap-10 sm:px-6 sm:pb-12 sm:pt-10 md:px-8 md:py-14 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:py-16">
            <div className="order-2 flex min-w-0 flex-col justify-center lg:order-1 lg:pr-4">
              <h1 className="text-balance text-[1.65rem] font-bold leading-[1.12] tracking-tight text-white sm:text-3xl md:text-4xl lg:text-[2.65rem] xl:text-5xl">
                {CURSO_TITULO}
              </h1>
              <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[#e4b04a] sm:text-xs sm:tracking-[0.2em]">
                ComprameLaFoto · DNX Suite
              </p>
              <p className="ds-readable-text ds-readable-text--fluid mt-4 text-[0.9375rem] leading-relaxed text-white/90 sm:text-base md:text-lg">
                Reservá tu lugar con pago seguro online. Inicio{" "}
                <span className="sm:whitespace-nowrap">{CURSO_INICIO_VISIBLE}</span>, cupo{" "}
                {DNX_FOTO_BASICA_FUNES_MAX_SEATS} alumnos, {formatARS(DNX_FOTO_BASICA_FUNES_PRICE_ARS)}.
              </p>
              <p className="ds-readable-text ds-readable-text--muted ds-readable-text--fluid mt-3 text-sm leading-relaxed text-white/75 sm:text-base">
                {CURSO_SUBTITULO}
              </p>
              <div className="mt-8 flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={scrollToInscripcion}
                  disabled={cupoFull || statusLoading}
                  className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-[#e4b04a] px-8 py-3.5 text-base font-semibold text-black shadow-[0_14px_40px_-14px_rgba(228,176,74,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f0c159] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Reservar mi lugar
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:w-auto"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                  Consultar por WhatsApp
                </a>
              </div>
              {cupoFull ? (
                <p className="ds-readable-text ds-readable-text--fluid mt-6 max-w-xl rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-100">
                  Cupo completo. Si querés entrar en lista de espera o consultar próximas fechas,{" "}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 hover:text-white"
                  >
                    escribinos por WhatsApp
                  </a>
                  .
                </p>
              ) : null}
            </div>
            <div className="order-1 flex min-w-0 justify-center sm:px-2 lg:order-2 lg:justify-end lg:px-0">
              <Image
                src={HERO_FLYER}
                alt="Flyer: Curso presencial Fotografía Básica en Funes — Daniel Cuart, DNX Estudio. Sábado 6 de junio, 12 clases, cupo 12 alumnos."
                width={HERO_FLYER_WIDTH}
                height={HERO_FLYER_HEIGHT}
                className="h-auto w-full max-w-[min(100%,calc(100vw-2rem))] object-contain object-top sm:max-w-[min(100%,420px)] lg:max-w-[min(100%,480px)] xl:max-w-[520px]"
                sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) min(100vw - 3rem, 420px), min(50vw - 3rem, 520px)"
                priority
                quality={92}
              />
            </div>
          </div>
        </header>

        <SectionContain className="border-b border-neutral-900/8 bg-[#f7f5f2] py-12 dark:border-white/10 dark:bg-[#0c0d11] md:py-16">
          <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    <p className="mt-1.5 text-sm font-medium leading-snug text-neutral-900 [overflow-wrap:anywhere] sm:text-[0.9375rem] dark:text-white">
                      {value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-semibold text-[#c27b3d] underline-offset-4 hover:underline"
            >
              Ver ubicación en Google Maps
            </a>
          </div>
        </SectionContain>

        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <ProseMax>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
              Si tenés una cámara y querés sacarle provecho
            </h2>
            <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted mt-6 text-[0.9375rem] leading-relaxed text-neutral-600 sm:text-base md:text-lg dark:text-neutral-300">
              Si tenés una cámara y sentís que no la estás aprovechando, este curso es para vos. Vamos a trabajar desde
              cero, pero con una mirada práctica: entender la cámara, controlar la luz, componer mejor y salir a fotografiar
              con más seguridad.
            </p>
          </ProseMax>
        </SectionContain>

        <SectionContain className="bg-white dark:bg-[#12141a]">
          <ProseMax>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
              ¿Para quién es?
            </h2>
          </ProseMax>
          <ul className="mt-8 grid w-full grid-cols-1 gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2">
            {FOR_WHO.map((text) => (
              <li
                key={text}
                className="flex min-w-0 gap-3 rounded-2xl border border-neutral-900/8 bg-[#fafafa] p-4 shadow-sm dark:border-white/10 dark:bg-[#151820] sm:gap-4 sm:p-6"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#c27b3d] sm:h-6 sm:w-6" aria-hidden />
                <p className="ds-readable-text ds-readable-text--fluid min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-neutral-800 sm:text-base dark:text-neutral-200">
                  {text}
                </p>
              </li>
            ))}
          </ul>
        </SectionContain>

        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <ProseMax>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
              Qué vas a aprender
            </h2>
          </ProseMax>
          <ul className="mt-6 grid w-full gap-2.5 sm:mt-8 sm:gap-3 md:grid-cols-2">
            {APRENDER_ITEMS.map((item) => (
              <li
                key={item}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-neutral-900/8 bg-[#fafafa] px-3 py-2.5 dark:border-white/10 dark:bg-[#1a1d24] sm:px-4 sm:py-3"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                <span className="ds-readable-text ds-readable-text--fluid min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-neutral-800 sm:text-sm md:text-base dark:text-neutral-200">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </SectionContain>

        <SectionContain className="bg-white dark:bg-[#12141a]">
          <div className="grid w-full min-w-0 gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0 space-y-5 sm:space-y-6">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
                Modalidad
              </h2>
              <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted text-[0.9375rem] leading-relaxed text-neutral-600 sm:text-base md:text-lg dark:text-neutral-300">
                El curso tiene una duración de 12 clases presenciales de 2 horas. Cada encuentro combina explicación
                técnica, ejercicios prácticos y consignas para seguir practicando durante la semana.
              </p>
              <h3 className="text-lg font-semibold text-neutral-900 sm:text-xl dark:text-white">Prácticas y salidas</h3>
              <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted text-[0.9375rem] leading-relaxed text-neutral-600 sm:text-base md:text-lg dark:text-neutral-300">
                Además de las clases en DNX Estudio, vamos a realizar salidas fotográficas por la ciudad de Funes para
                aplicar lo aprendido en situaciones reales: luz natural, retratos, detalles urbanos, composición y toma de
                decisiones en el momento.
              </p>
            </div>
            <div className="min-w-0 space-y-5 border-t border-neutral-900/10 pt-8 sm:space-y-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0 dark:border-white/10">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
                Dictado por Daniel Cuart
              </h2>
              <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted text-[0.9375rem] leading-relaxed text-neutral-600 sm:text-base md:text-lg dark:text-neutral-300">
                Soy Daniel Cuart, fotógrafo profesional y docente. Desde 2012 me muevo sobre todo en fotografía social y
                retratos, y también me gusta acompañar a quienes están empezando o quieren ordenar lo que ya saben. En este
                curso quiero que nos crucemos en el lugar de la práctica: charla clara, ejemplos reales y tiempo para dudas,
                para que salgas con más tranquilidad cada vez que agarrás la cámara.
              </p>
            </div>
          </div>
        </SectionContain>

        <SectionContain className="border-y border-neutral-900/8 bg-[#101218] py-12 text-white sm:py-16 dark:border-white/10">
          <ProseMax>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Cupos limitados</h2>
            <p className="ds-readable-text ds-readable-text--fluid mt-5 text-[0.9375rem] leading-relaxed text-white/80 sm:mt-6 sm:text-base md:text-lg">
              El curso tiene un cupo máximo de {DNX_FOTO_BASICA_FUNES_MAX_SEATS} alumnos para poder trabajar de forma
              personalizada, responder dudas y acompañar el proceso de cada participante.
            </p>
            <button
              type="button"
              onClick={scrollToInscripcion}
              disabled={cupoFull || statusLoading}
              className="mt-8 inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-[#c27b3d] px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-[#a86835] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-10 sm:w-auto"
            >
              Quiero reservar mi lugar
            </button>
          </ProseMax>
        </SectionContain>

        <SectionContain
          id="inscripcion"
          className="scroll-mt-[max(1rem,env(safe-area-inset-top))] overflow-x-visible bg-[#f7f5f2] dark:bg-[#0c0d11] sm:scroll-mt-10"
        >
          <div className="grid w-full min-w-0 grid-cols-1 gap-8 sm:gap-10 md:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(17.5rem,min(24rem,100%))] xl:items-start xl:gap-12">
            <div className="min-w-0 w-full">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
                Precio e inscripción
              </h2>
              <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted mt-3 text-sm leading-relaxed text-neutral-600 sm:mt-4 dark:text-neutral-400">
                Pagás el total del curso de forma segura con Mercado Pago. El monto se acredita íntegramente al
                organizador del curso; no se suman cargos de comisión de plataforma al precio publicado.
              </p>

              {cupoFull ? (
                <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-700/50 dark:bg-amber-950/30">
                  <p className="font-semibold text-amber-950 dark:text-amber-100">Cupo completo</p>
                  <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
                    Ya no quedan lugares para esta edición. Escribinos por WhatsApp para consultar próximas fechas.
                  </p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex rounded-full bg-[#c27b3d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#a86835]"
                  >
                    Consultar por WhatsApp
                  </a>
                </div>
              ) : (
                <form onSubmit={handlePagar} className="mt-8 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Nombre</span>
                      <input
                        className={inputClass}
                        required
                        value={form.firstName}
                        onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                        autoComplete="given-name"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Apellido</span>
                      <input
                        className={inputClass}
                        required
                        value={form.lastName}
                        onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                        autoComplete="family-name"
                      />
                    </label>
                  </div>
                  <label className="block min-w-0">
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Email</span>
                    <input
                      className={inputClass}
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      autoComplete="email"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Teléfono / WhatsApp</span>
                    <input
                      className={inputClass}
                      required
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      autoComplete="tel"
                    />
                  </label>
                  {formError ? (
                    <p
                      className="break-words text-pretty text-sm font-medium leading-relaxed text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {formError}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={checkingOut || cupoFull}
                    className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-[#c27b3d] px-8 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#a86835] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {checkingOut ? "Abriendo checkout…" : "Pagar e inscribirme"}
                  </button>
                </form>
              )}
            </div>

            <aside className="w-full min-w-0 xl:sticky xl:top-24">
              <div className="w-full rounded-2xl border-2 border-[#c27b3d]/35 bg-white p-5 shadow-[0_20px_50px_-24px_rgba(194,123,61,0.35)] dark:bg-[#151820] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">Curso presencial</p>
                <h3 className="mt-2 text-xl font-bold text-neutral-900 dark:text-white">
                  Curso Presencial de Fotografía Básica
                </h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  <li>12 clases presenciales</li>
                  <li>Sábados de 15 a 17 hs</li>
                  <li>Inicio: {CURSO_INICIO_VISIBLE}</li>
                  <li className="pt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                    Valor total: {formatARS(DNX_FOTO_BASICA_FUNES_PRICE_ARS)}
                  </li>
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Incluye tareas prácticas, salidas por Funes y clases aplicadas.
                </p>
              </div>
            </aside>
          </div>
        </SectionContain>

        <SectionContain className="bg-white dark:bg-[#12141a]">
          <ProseMax>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl dark:text-white">
              Preguntas frecuentes
            </h2>
          </ProseMax>
          <div className="mx-auto mt-6 flex w-full min-w-0 max-w-full flex-col gap-3 sm:mt-8 md:max-w-4xl lg:max-w-[48rem]">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details
                key={q}
                className="group min-w-0 rounded-2xl border border-neutral-900/10 bg-[#fafafa] px-4 py-1 dark:border-white/10 dark:bg-[#1a1d24] sm:px-5 sm:py-2"
              >
                <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-3 py-3 pr-1 text-[0.9375rem] font-medium leading-snug text-neutral-900 sm:py-4 sm:text-base dark:text-white">
                  <span className="min-w-0 flex-1 text-pretty pr-2">{q}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#c27b3d] transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="ds-readable-text border-t border-neutral-900/8 pb-3 pt-2 text-sm leading-relaxed text-neutral-600 dark:border-white/10 dark:text-neutral-300 sm:pb-4">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </SectionContain>

        <SectionContain className="bg-[#f7f5f2] dark:bg-[#0c0d11]">
          <div className="mx-auto w-full max-w-full rounded-2xl border border-neutral-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#151820] sm:max-w-3xl sm:p-8 md:p-10 lg:max-w-[44rem]">
            <h2 className="text-balance text-xl font-semibold text-neutral-900 sm:text-2xl md:text-3xl dark:text-white">
              Empezá con acompañamiento real
            </h2>
            <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--muted mt-3 text-[0.9375rem] leading-relaxed text-neutral-600 sm:mt-4 sm:text-base md:text-lg dark:text-neutral-300">
              Si hace tiempo querés aprender fotografía de verdad, este curso es una buena forma de empezar con
              acompañamiento, práctica y un grupo reducido.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={scrollToInscripcion}
                disabled={cupoFull || statusLoading}
                className="inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-[#c27b3d] px-8 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#a86835] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pagar e inscribirme
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-neutral-900/15 px-8 py-3.5 text-base font-semibold text-neutral-900 hover:bg-neutral-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Consultar por WhatsApp
              </a>
            </div>
          </div>
        </SectionContain>
      </main>
    </div>
  );
}
