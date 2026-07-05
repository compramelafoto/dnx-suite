import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import DnxImageSlot from "@/components/dnx/DnxImageSlot";

const PRESENCIAL_CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2z_EHMUyZyJoj5R3lNntYdsB8k3vwT60KrdZPSRWzeFR3Pob1o1a1nr90eZXpIs4qxm15ydvF4";

const ONLINE_CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1PLPHPaQEQhSqelvI-O7rq1RXy-N-micuNdyEygkTDr4trwCX88fxjNQOID2uVF9GY5JKwkIHd";

const WHATSAPP_URL =
  "https://web.whatsapp.com/send?phone=5493413748324&text=Hola%20DNX%2C%20quiero%20consultar%20por%20fotograf%C3%ADa%20para%20mi%20boda";

const GOOGLE_REVIEWS_URL = "https://share.google/e5qJvomFH1DV2mf4a";

const INSTAGRAM_URL = "https://www.instagram.com/dnxfotografia/";

const DNX_WEB_URL = "https://www.dnxfotografia.com.ar";

const PORTFOLIO_SECTION_ID = "portfolio";
const PRICING_SECTION_ID = "precios";

const portfolioImages = [
  {
    src: "/dnx/bodas/portfolio-01.png",
    alt: "Portfolio de boda DNX 01",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-02.png",
    alt: "Portfolio de boda DNX 02",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-03.png",
    alt: "Portfolio de boda DNX 03",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-04.png",
    alt: "Portfolio de boda DNX 04",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-05.png",
    alt: "Portfolio de boda DNX 05",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-06.png",
    alt: "Portfolio de boda DNX 06",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-07.png",
    alt: "Portfolio de boda DNX 07",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-08.png",
    alt: "Portfolio de boda DNX 08",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-09.png",
    alt: "Portfolio de boda DNX 09",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-10.png",
    alt: "Portfolio de boda DNX 10",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-11.png",
    alt: "Portfolio de boda DNX 11",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-12.png",
    alt: "Portfolio de boda DNX 12",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-14.png",
    alt: "Portfolio de boda DNX 14",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-15.png",
    alt: "Portfolio de boda DNX 15",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-16.png",
    alt: "Portfolio de boda DNX 16",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-19.png",
    alt: "Portfolio de boda DNX 19",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-20.png",
    alt: "Portfolio de boda DNX 20",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-21.png",
    alt: "Portfolio de boda DNX 21",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-22.png",
    alt: "Portfolio de boda DNX 22",
    label: "Portfolio boda",
  },
  {
    src: "/dnx/bodas/portfolio-26.png",
    alt: "Portfolio de boda DNX 26",
    label: "Portfolio boda",
  },
];

const preparativosImages = [
  {
    src: "/dnx/bodas/preparativos-01.png",
    alt: "Preparativos de boda DNX 01",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-02.png",
    alt: "Preparativos de boda DNX 02",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-03.png",
    alt: "Preparativos de boda DNX 03",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-04.png",
    alt: "Preparativos de boda DNX 04",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-05.png",
    alt: "Preparativos de boda DNX 05",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-06.png",
    alt: "Preparativos de boda DNX 06",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-07.png",
    alt: "Preparativos de boda DNX 07",
    label: "Preparativos",
  },
  {
    src: "/dnx/bodas/preparativos-08.png",
    alt: "Preparativos de boda DNX 08",
    label: "Preparativos",
  },
];

const ceremoniaImages = [
  {
    src: "/dnx/bodas/ceremonia-01.png",
    alt: "Ceremonia de boda en Funes o Rosario",
    label: "Ceremonia",
  },
  {
    src: "/dnx/bodas/ceremonia-02.png",
    alt: "Momentos emotivos durante la ceremonia",
    label: "Ceremonia",
  },
];

const fiestaImages = [
  {
    src: "/dnx/bodas/fiesta-01.png",
    alt: "Fiesta de casamiento: celebración y baile",
    label: "Fiesta",
  },
  {
    src: "/dnx/bodas/fiesta-02.png",
    alt: "Invitados y pareja en la fiesta de boda",
    label: "Fiesta",
  },
];

type BodasPlanComparisonRow = {
  feature: string;
  basico: string;
  intermedio: string;
  premium: string;
};

const bodasPlanComparisonRows: BodasPlanComparisonRow[] = [
  {
    feature: "Ideal para",
    basico: "Momentos principales de la boda",
    intermedio: "Historia completa con impresos",
    premium: "Experiencia completa con video",
  },
  { feature: "Cobertura ceremonia", basico: "✓", intermedio: "✓", premium: "✓" },
  { feature: "Cobertura fiesta", basico: "✓", intermedio: "✓", premium: "✓" },
  { feature: "Fotografías editadas en alta calidad", basico: "✓", intermedio: "✓", premium: "✓" },
  { feature: "Galería/link privado", basico: "✓", intermedio: "✓", premium: "✓" },
  { feature: "Sesión pre boda", basico: "✕", intermedio: "✓", premium: "✓" },
  { feature: "Fotolibro de sesión pre boda", basico: "✕", intermedio: "✓", premium: "✓" },
  { feature: "Fotolibro de boda", basico: "✕", intermedio: "✓", premium: "✓" },
  { feature: "Fotos tipo polaroid para regalar a invitados", basico: "✕", intermedio: "✓", premium: "✓" },
  { feature: "50 fotos impresas", basico: "✕", intermedio: "✕", premium: "✓" },
  { feature: "Caja de madera con pendrive", basico: "✕", intermedio: "✕", premium: "✓" },
  { feature: "Video resumen / cobertura de video", basico: "✕", intermedio: "✕", premium: "✓" },
];

const bodasPlanCards = [
  { key: "basico" as const, title: "Básico", price: "$870.000", featured: false },
  {
    key: "intermedio" as const,
    title: "Intermedio",
    price: "$1.800.000",
    featured: true,
    badge: "Más elegido",
  },
  { key: "premium" as const, title: "Premium", price: "$2.650.000", featured: false },
];

function bodasPlanCellClass(value: string, onDark: boolean) {
  if (value.startsWith("✓")) return onDark ? "text-lg font-semibold text-emerald-300" : "text-lg font-semibold text-emerald-600";
  if (value.startsWith("✕")) return onDark ? "text-lg font-semibold text-red-300" : "text-lg font-semibold text-red-500";
  return onDark ? "text-sm font-medium leading-snug text-stone-100" : "text-sm font-medium leading-snug text-stone-800";
}

export const metadata: Metadata = {
  title: "Fotografía de bodas en Rosario y Funes | DNX Fotografía",
  description:
    "Fotografía de bodas en Funes, Rosario y alrededores. Cobertura profesional, preparativos, ceremonia, fiesta, productos impresos y entrevista personalizada.",
  openGraph: {
    title: "Fotografía de bodas en Rosario y Funes | DNX Fotografía",
    description:
      "Fotografía de bodas en Funes, Rosario y alrededores. Cobertura profesional, preparativos, ceremonia, fiesta, productos impresos y entrevista personalizada.",
  },
};

function ExternalButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variants = {
    primary: "bg-stone-900 text-white hover:bg-stone-800",
    secondary: "bg-white text-stone-900 border border-stone-200 hover:bg-stone-50",
    ghost: "text-stone-700 hover:text-stone-900 underline underline-offset-4",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${variants[variant]}`}
    >
      {children}
    </a>
  );
}

export default function DnxBodasLandingPage() {
  return (
    <main className="w-full min-w-0 overflow-x-hidden bg-[#faf7f4] pb-28 text-stone-900 antialiased md:pb-10">
      {/* Hero */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pt-12">
        <div className="grid w-full min-w-0 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="order-2 min-w-0 w-full space-y-6 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">DNX Fotografía · Bodas</p>
            <div className="flex justify-center lg:justify-start">
              <Image
                src="/dnx/logo-dnx.png"
                alt="Logo DNX Fotografía"
                width={64}
                height={64}
                className="h-14 w-14 rounded-full object-cover ring-1 ring-stone-200/80 lg:h-16 lg:w-16"
                priority
              />
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
              Fotografía de bodas para que el recuerdo de ese día sea eterno
            </h1>
            <p className="text-base leading-relaxed text-stone-700 md:text-lg">
              En DNX Fotografía contamos la historia de tu boda con una mirada cercana, profesional y emocional:
              preparativos, detalles, ceremonia, fiesta, familia, amigos y esos momentos espontáneos que merecen quedar
              para siempre.
            </p>
            <p className="text-sm font-medium text-stone-500">
              Funes, Rosario y alrededores · Entrevistas presenciales u online
            </p>
            <div className="flex flex-wrap gap-3">
              <ExternalButton href={PRESENCIAL_CALENDAR_URL}>Entrevista presencial</ExternalButton>
              <ExternalButton href={ONLINE_CALENDAR_URL} variant="secondary">
                Entrevista online
              </ExternalButton>
              <Link
                href={`#${PORTFOLIO_SECTION_ID}`}
                className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-white"
              >
                Ver portfolio
              </Link>
              <Link
                href={`#${PRICING_SECTION_ID}`}
                className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-white"
              >
                Ver precios
              </Link>
            </div>
            <ExternalButton href={WHATSAPP_URL} variant="ghost">
              Consultar disponibilidad por WhatsApp
            </ExternalButton>
          </div>
          <DnxImageSlot
            src="/dnx/bodas/hero-boda-vertical.png"
            alt="Fotografía de boda hero — DNX Fotografía"
            label="Hero boda"
            className="order-1 min-h-[420px] w-full min-w-0 lg:order-2 lg:min-h-[680px]"
            fit="cover"
            objectPosition="center top"
            priority
          />
        </div>
      </section>

      {/* Propuesta de valor */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide text-stone-900 md:text-3xl">
            Tu boda pasa una vez. El recuerdo queda para siempre.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-lg">
            No se trata solamente de tener fotos lindas. Se trata de poder volver a sentir lo que pasó ese día: los nervios
            antes de salir, los abrazos, las miradas, los detalles, la ceremonia, la fiesta y todo lo que quizás en el
            momento no llegaste a ver.
          </p>
        </div>
        <div className="mt-10 grid w-full min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5">
          {[
            {
              title: "Contamos la historia completa",
              body: "Registramos preparativos, ceremonia, fiesta, detalles, familia, amigos y momentos espontáneos.",
            },
            {
              title: "Trabajamos con respeto y buena energía",
              body: "La buena onda y el buen trato son parte central de nuestra forma de trabajar.",
            },
            {
              title: "Nos movemos sin invadir",
              body: "Buscamos estar presentes en los momentos importantes sin interrumpir lo que está pasando.",
            },
            {
              title: "Planificamos antes del evento",
              body: "La entrevista nos permite conocer sus gustos, dudas y expectativas para que el trabajo tenga sentido para ustedes.",
            },
            {
              title: "Entregamos recuerdos reales",
              body: "Además de las fotos digitales, ofrecemos impresiones, fotolibros y productos para conservar la historia en papel.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-stone-200/90 bg-white/90 p-5 shadow-sm ring-1 ring-stone-100"
            >
              <h3 className="text-base font-semibold text-stone-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Portfolio */}
      <section id={PORTFOLIO_SECTION_ID} className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto mb-10 w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide text-stone-900 md:text-3xl">
            Antes de hablar de packs, mirá cómo contamos una boda
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-700">
            Cada boda tiene su ritmo, su energía y su historia. Las fotos deben reflejar eso: no solo cómo se veía el
            evento, sino cómo se sintió vivirlo.
          </p>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {portfolioImages.map((img, index) => (
            <div key={img.src} className="mb-4 break-inside-avoid">
              <DnxImageSlot
                src={img.src}
                alt={img.alt}
                label={img.label}
                className="min-h-[220px] md:min-h-[260px]"
                fit="cover"
                priority={index < 3}
                gallery={portfolioImages.map((item) => ({ src: item.src, alt: item.alt }))}
                currentIndex={index}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Emocional */}
      <section className="mx-auto grid w-full min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/bodas/detalles-01.png"
          alt="Detalles de boda fotografiados por DNX"
          label="Detalles boda"
          className="w-full min-h-[280px] rounded-[28px] sm:min-h-[360px] md:min-h-[480px]"
          fit="cover"
        />
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-sm md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">No queremos que tus recuerdos vivan solo en tu memoria</h2>
          <p className="mt-4 text-stone-700">
            Queremos ser parte de esos recuerdos para que no se pierdan con el tiempo. Registrar con amor,
            profesionalismo y respeto cada momento, mientras ustedes disfrutan de su boda sin estar pendientes de la
            cámara.
          </p>
        </div>
      </section>

      {/* Novia / pareja */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <h2 className="text-center text-2xl font-semibold uppercase tracking-wide md:text-3xl">
          Una experiencia pensada para que ustedes disfruten
        </h2>
        <div className="mx-auto mt-8 grid w-full min-w-0 max-w-5xl gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Para la novia: tranquilidad</h3>
            <p className="mt-3 text-stone-700">
              El día de la boda pasan muchas cosas al mismo tiempo. Nuestro trabajo es acompañarte para que puedas
              disfrutar, sabiendo que los momentos importantes están siendo registrados.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Para la pareja: recuerdos auténticos</h3>
            <p className="mt-3 text-stone-700">
              No buscamos fotos rígidas o forzadas. Queremos que las imágenes reflejen cómo vivieron el día, la emoción,
              los abrazos, las miradas y la celebración con la gente que quieren.
            </p>
          </article>
        </div>
      </section>

      {/* Objeciones */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <h2 className="text-center text-2xl font-semibold uppercase tracking-wide md:text-3xl">
          Sabemos lo que más preocupa al elegir fotógrafo para una boda
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Que se pierdan momentos importantes",
              body: "Por eso planificamos antes, conversamos sobre la dinámica del evento y trabajamos atentos a los momentos que después se vuelven inolvidables.",
            },
            {
              title: "Sentirse incómodos frente a la cámara",
              body: "Los acompañamos con una dirección natural y respetuosa para que las fotos se sientan propias, sin poses forzadas.",
            },
            {
              title: "Que el fotógrafo interrumpa la boda",
              body: "Buscamos movernos con libertad, pero sin invadir. Queremos registrar lo que pasa, no modificar cada momento.",
            },
            {
              title: "Recibir solo archivos y nada más",
              body: "Además de la entrega digital, ofrecemos impresiones, fotolibros y productos para que el recuerdo también exista fuera de una pantalla.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-stone-700">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* DNX */}
      <section className="mx-auto grid w-full min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/bodas/entrevista-boda.png"
          alt="Entrevista y equipo DNX Fotografía"
          label="Entrevista boda"
          className="w-full min-h-[280px] rounded-[28px] md:min-h-[440px]"
          fit="cover"
        />
        <div className="min-w-0 w-full space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">Somos DNX Estudio</h2>
          <p className="text-stone-700">
            Somos un estudio fotográfico de Funes especializado en contar historias reales. En bodas, nuestro objetivo no
            es solo lograr calidad fotográfica: también queremos que la experiencia sea cercana, ordenada y humana desde
            el primer contacto hasta la entrega final.
          </p>
          <p className="text-stone-700">
            Trabajamos con fotógrafos, videógrafos, editores, maquilladoras, asesoras de imagen y laboratorios
            profesionales para ofrecer una experiencia completa y cuidada.
          </p>
          <ul className="space-y-2 text-stone-700">
            <li>· Estudio físico en San José 1672 - Local 5 - Funes.</li>
            <li>· Cobertura en Funes, Rosario y alrededores.</li>
            <li>· Experiencia en eventos sociales y bodas.</li>
            <li>· Equipo de fotografía, video, edición y laboratorios profesionales.</li>
            <li>· Trabajo ordenado con herramientas de gestión y seguimiento.</li>
            <li>· Acompañamiento personalizado desde la entrevista inicial.</li>
          </ul>
        </div>
      </section>

      {/* Preparativos */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Los preparativos también son parte de la historia</h2>
          <p className="mt-4 text-base text-stone-700">
            Antes de la ceremonia aparecen nervios, detalles, maquillaje, vestido, zapatos, familia, mensajes y momentos
            íntimos que después tienen un valor enorme. Por eso nos gusta registrar esa parte del día con una mirada
            sensible y cuidada.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {preparativosImages.map((img) => (
            <DnxImageSlot
              key={img.src}
              src={img.src}
              alt={img.alt}
              label={img.label}
              className="w-full"
              aspectRatio="4 / 3"
              fit="cover"
            />
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Vestido, zapatos y detalles", "Maquillaje y momentos previos", "Familia acompañando", "La calma antes de la celebración"].map(
            (t) => (
              <div key={t} className="rounded-xl border border-stone-200 bg-white/90 p-4 text-center text-sm font-medium text-stone-800 shadow-sm">
                {t}
              </div>
            )
          )}
        </div>
      </section>

      {/* Ceremonia */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">La ceremonia: el momento donde todo se vuelve real</h2>
          <p className="mt-4 text-base text-stone-700">
            Miradas, manos, anillos, emoción y promesas. Durante la ceremonia buscamos registrar lo esencial sin
            interrumpir, respetando el clima del momento y cuidando cada encuadre.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {ceremoniaImages.map((img) => (
            <DnxImageSlot key={img.src} src={img.src} alt={img.alt} label={img.label} className="min-h-[260px] md:min-h-[340px]" fit="cover" />
          ))}
        </div>
      </section>

      {/* Fiesta */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">La fiesta también se cuenta con emoción</h2>
          <p className="mt-4 text-base text-stone-700">
            Después de la ceremonia llega el momento de celebrar. Ahí buscamos fotos espontáneas, energía real, abrazos,
            baile, familia, amigos y situaciones que muestran cómo se vivió la noche.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {fiestaImages.map((img) => (
            <DnxImageSlot key={img.src} src={img.src} alt={img.alt} label={img.label} className="min-h-[260px] md:min-h-[340px]" fit="cover" />
          ))}
        </div>
      </section>

      {/* Proceso */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Cómo es trabajar con nosotros</h2>
          <p className="mt-4 text-base text-stone-700">
            Para que todo salga bien, seguimos un proceso claro desde el primer contacto hasta la entrega final.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "1. Entrevista inicial",
              body: "Nos reunimos para conocer la fecha, el lugar, el estilo de boda, sus gustos, dudas y expectativas.",
            },
            {
              title: "2. Elección de propuesta",
              body: "Les mostramos las opciones disponibles y definimos qué cobertura se adapta mejor a lo que están buscando.",
            },
            {
              title: "3. Planificación previa",
              body: "Conversamos sobre momentos importantes, horarios, preparativos, ceremonia, fiesta y cualquier detalle que quieran tener presente.",
            },
            {
              title: "4. Cobertura del evento",
              body: "El día de la boda registramos la historia completa con una mirada documental, estética y emocional.",
            },
            {
              title: "5. Selección y entrega",
              body: "Después del evento, organizamos la entrega para que puedan ver, elegir, compartir y conservar sus fotos.",
            },
            {
              title: "6. Productos finales",
              body: "Entregamos fotografías digitales, impresiones, fotolibros, cuadros o productos personalizados según la propuesta contratada.",
            },
          ].map((step) => (
            <article key={step.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-stone-900">{step.title}</h3>
              <p className="mt-2 text-sm text-stone-700">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Impresiones */}
      <section className="mx-auto grid w-full min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/bodas/portfolio-01.png"
          alt="Fotolibro premium de boda"
          label="Fotolibro premium boda"
          className="w-full min-h-[280px] rounded-[28px] md:min-h-[420px]"
          fit="cover"
        />
        <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-semibold md:text-3xl">Tus fotos no deberían quedar solamente en una pantalla</h2>
          <p className="text-stone-700">
            Hoy vemos casi todo desde el celular, pero hay recuerdos que merecen estar impresos. Por eso trabajamos con
            laboratorios profesionales para ofrecer fotolibros, ampliaciones, cuadros en canvas, cuadros en madera,
            gigantografías y otros formatos de alta calidad.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {["Fotolibros", "Ampliaciones", "Cuadros en canvas", "Cuadros en madera", "Gigantografías", "Presentaciones personalizadas"].map(
              (item) => (
                <div key={item} className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5 text-sm text-stone-800">
                  {item}
                </div>
              )
            )}
          </div>
          <p className="text-sm font-medium text-stone-600">
            Porque una historia importante también merece poder tocarse, guardarse y volver a verse con el paso del tiempo.
          </p>
        </div>
      </section>

      {/* Packs */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Propuestas para diferentes formas de recordar tu boda</h2>
          <p className="mt-4 text-base text-stone-700">
            Cada boda tiene una historia distinta. Algunas parejas buscan una cobertura clara de los momentos principales.
            Otras quieren sumar sesión pre boda, fotolibros, recuerdos impresos, fotos para regalar a invitados o video.
          </p>
          <p className="mt-3 text-base text-stone-700">
            Por eso trabajamos con propuestas diferentes, para que puedan elegir según la importancia que quieran darle al
            recuerdo de ese día.
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-stone-500">
          Los valores pueden variar según fecha, disponibilidad, ciudad, adicionales y condiciones de contratación. En la
          entrevista revisamos cada detalle y confirmamos la propuesta final.
        </p>

        <div id={PRICING_SECTION_ID} className="mt-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Compará las propuestas</p>

          {/* Móvil / tablet chico: una ficha por plan */}
          <div className="mt-4 space-y-4 lg:hidden">
            {bodasPlanCards.map((plan) => (
              <article
                key={plan.key}
                className={`rounded-2xl border p-5 shadow-sm ${
                  plan.featured
                    ? "border-stone-900 bg-stone-900 text-white ring-2 ring-stone-900 ring-offset-2 ring-offset-[#faf7f4]"
                    : "border-stone-200 bg-white"
                }`}
              >
                {plan.featured && plan.badge ? (
                  <span className="inline-flex rounded-full bg-amber-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-900">
                    {plan.badge}
                  </span>
                ) : null}
                <div className={plan.featured ? "mt-2" : ""}>
                  <h3
                    className={`text-lg font-semibold uppercase tracking-wide ${
                      plan.featured ? "text-amber-200" : "text-stone-800"
                    }`}
                  >
                    {plan.title}
                  </h3>
                  <p className={`mt-1 text-2xl font-bold ${plan.featured ? "text-white" : "text-stone-900"}`}>{plan.price}</p>
                </div>
                <ul
                  className={`mt-4 border-t pt-1 ${plan.featured ? "divide-stone-600 border-stone-600" : "divide-stone-200/80 border-stone-200/80"} divide-y`}
                >
                  {bodasPlanComparisonRows.map((row) => {
                    const value = row[plan.key];
                    const isIdeal = row.feature === "Ideal para";
                    return (
                      <li key={row.feature} className="py-3">
                        {isIdeal ? (
                          <>
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                plan.featured ? "text-stone-400" : "text-stone-500"
                              }`}
                            >
                              {row.feature}
                            </span>
                            <p className={`mt-1.5 ${bodasPlanCellClass(value, plan.featured)}`}>{value}</p>
                          </>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={`min-w-0 flex-1 text-sm font-medium leading-snug ${
                                plan.featured ? "text-stone-200" : "text-stone-700"
                              }`}
                            >
                              {row.feature}
                            </span>
                            <span className={`shrink-0 tabular-nums ${bodasPlanCellClass(value, plan.featured)}`}>{value}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>

          {/* Escritorio y tablet ancho: tabla comparativa */}
          <div className="mt-4 hidden overflow-x-auto rounded-3xl border border-stone-300 bg-white shadow-md lg:block">
            <table className="w-full min-w-[680px] border-collapse text-sm xl:min-w-0 xl:text-base">
              <thead>
                <tr className="bg-stone-50">
                  <th className="sticky left-0 z-10 border-b border-stone-200 bg-stone-50 p-4 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 lg:text-sm">
                    Incluye
                  </th>
                  <th className="border-b border-l border-stone-200 p-4 text-center">
                    <p className="text-sm font-semibold uppercase tracking-wide text-stone-700 lg:text-base">Básico</p>
                    <p className="mt-1 text-xl font-bold text-stone-900 lg:text-2xl">$870.000</p>
                  </th>
                  <th className="border-b border-l border-stone-200 bg-stone-900 p-4 text-center text-white">
                    <span className="inline-flex rounded-full bg-amber-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-900">
                      Más elegido
                    </span>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-200 lg:text-base">Intermedio</p>
                    <p className="mt-1 text-xl font-bold text-white lg:text-2xl">$1.800.000</p>
                  </th>
                  <th className="border-b border-l border-stone-200 p-4 text-center">
                    <p className="text-sm font-semibold uppercase tracking-wide text-stone-700 lg:text-base">Premium</p>
                    <p className="mt-1 text-xl font-bold text-stone-900 lg:text-2xl">$2.650.000</p>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bodasPlanComparisonRows.map((row, index) => (
                  <tr key={row.feature} className={index % 2 === 0 ? "bg-white" : "bg-stone-50/60"}>
                    <td className="sticky left-0 border-b border-stone-200 bg-inherit p-4 font-medium text-stone-700">{row.feature}</td>
                    <td className="border-b border-l border-stone-200 p-4 text-center">
                      <span className={bodasPlanCellClass(row.basico, false)}>{row.basico}</span>
                    </td>
                    <td className="border-b border-l border-stone-200 p-4 text-center">
                      <span className={bodasPlanCellClass(row.intermedio, false)}>{row.intermedio}</span>
                    </td>
                    <td className="border-b border-l border-stone-200 p-4 text-center">
                      <span className={bodasPlanCellClass(row.premium, false)}>{row.premium}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-stone-600">
          No hace falta que decidan todo ahora. En la entrevista revisamos la fecha, el estilo de boda, los momentos
          importantes, los productos que les interesan y cuál de las propuestas tiene más sentido para ustedes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ExternalButton href={PRESENCIAL_CALENDAR_URL}>Entrevista presencial</ExternalButton>
          <ExternalButton href={ONLINE_CALENDAR_URL} variant="secondary">
            Entrevista online
          </ExternalButton>
          <ExternalButton href={WHATSAPP_URL} variant="ghost">
            Consultar por WhatsApp
          </ExternalButton>
        </div>
      </section>

      {/* Pagos / beneficios */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Opciones para organizar mejor la inversión</h2>
          <p className="mt-4 text-base text-stone-700">
            Sabemos que una boda implica muchas decisiones. Por eso ofrecemos alternativas para que puedan planificar la
            contratación con mayor tranquilidad.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Financiación sin recargo",
              body: "Hasta el día de la fiesta o hasta un máximo de 12 pagos, según la propuesta acordada.",
            },
            {
              title: "Descuento por pago único",
              body: "10% de descuento abonando en un pago.",
            },
            {
              title: "Transferencia bancaria",
              body: "Opción disponible para señar o cancelar la propuesta.",
            },
            {
              title: "Otros medios",
              body: "También podemos conversar opciones como Prex o criptomonedas.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-stone-700">{item.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-stone-500">
          Las condiciones pueden variar según fecha, disponibilidad y propuesta contratada. Las vemos juntos en la
          entrevista.
        </p>
      </section>

      {/* Confianza */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Una experiencia cercana desde el primer contacto</h2>
          <p className="mt-4 text-base text-stone-700">
            En nuestras coberturas, las familias y parejas suelen destacar la predisposición, el buen trato, la
            tranquilidad durante el evento y la forma ordenada de trabajar. Para nosotros, la experiencia humana es tan
            importante como la calidad de las fotos.
          </p>
        </div>
        <div className="mt-8 text-center">
          <ExternalButton href={GOOGLE_REVIEWS_URL}>Ver reseñas de DNX</ExternalButton>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-2xl font-semibold uppercase tracking-wide md:text-3xl">Preguntas frecuentes</h2>
        <div className="mx-auto mt-8 grid w-full min-w-0 max-w-4xl gap-4 md:grid-cols-2 md:max-w-6xl">
          {[
            {
              q: "¿La entrevista tiene costo?",
              a: "No. La entrevista inicial es sin costo y sirve para conocernos, resolver dudas, revisar disponibilidad y ver qué propuesta se adapta mejor a la boda.",
            },
            {
              q: "¿Puede ser online?",
              a: "Sí. Podemos hacer la entrevista por videollamada o presencial en nuestro estudio.",
            },
            {
              q: "¿Dónde están ubicados?",
              a: "Estamos en San José 1672 - Local 5 - Funes, y trabajamos en Funes, Rosario y alrededores.",
            },
            {
              q: "¿Con cuánto tiempo conviene reservar?",
              a: "Lo ideal es consultar apenas tengan fecha definida, especialmente si la boda es en temporada alta.",
            },
            {
              q: "¿Cubren preparativos?",
              a: "Sí, según la propuesta elegida. Los preparativos suelen ser una parte muy valiosa de la historia porque muestran detalles, nervios, familia y momentos previos.",
            },
            {
              q: "¿Cubren ceremonia y fiesta?",
              a: "Sí. Podemos cubrir ceremonia, fiesta y otros momentos importantes según la propuesta contratada.",
            },
            {
              q: "¿Qué pasa si no nos gusta posar?",
              a: "No hay problema. La idea no es forzar poses rígidas, sino acompañarlos con una dirección natural para que las fotos se sientan auténticas.",
            },
            {
              q: "¿Entregan fotos impresas?",
              a: "Sí. Trabajamos con fotolibros, ampliaciones, cuadros y diferentes formatos impresos según la propuesta contratada.",
            },
            {
              q: "¿También ofrecen video?",
              a: "Podemos sumar video o trabajar con equipo de video según la propuesta y disponibilidad. Lo vemos en la entrevista.",
            },
            {
              q: "¿Cómo reservamos la fecha?",
              a: "Primero coordinamos una entrevista para revisar disponibilidad, propuesta y condiciones. Si la fecha está disponible, te indicamos cómo avanzar con la reserva.",
            },
            {
              q: "¿Podemos personalizar el pack?",
              a: "Sí. Las propuestas sirven como base, pero podemos revisar adicionales, productos impresos, video u otras necesidades específicas.",
            },
            {
              q: "¿Qué pasa si todavía no tenemos todo definido?",
              a: "Podés agendar igual. La entrevista también sirve para ordenar ideas, resolver dudas y entender qué tipo de cobertura tiene más sentido para la boda.",
            },
          ].map((item) => (
            <article key={item.q} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-stone-900">{item.q}</h3>
              <p className="mt-2 text-sm text-stone-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="grid w-full min-w-0 gap-8 overflow-hidden rounded-3xl border border-stone-200/80 bg-stone-900 p-6 text-white shadow-xl md:grid-cols-2 md:items-center md:p-10 md:[&>*]:min-w-0">
          <DnxImageSlot
            src="/dnx/bodas/preparativos-01.png"
            alt="Novia en preparativos antes de la boda"
            label="Cierre boda"
            className="min-h-[240px] bg-stone-800 sm:min-h-[300px] md:min-h-[360px]"
            fit="cover"
          />
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold md:text-3xl">El primer paso es revisar tu fecha y resolver tus dudas</h2>
            <p className="text-stone-200">
              Agendá una entrevista presencial u online. Te mostramos las propuestas completas, vemos disponibilidad para
              tu fecha y te ayudamos a elegir la opción más conveniente para conservar el recuerdo de tu boda.
            </p>
            <p className="text-stone-400">La entrevista es sin costo y no te compromete a contratar.</p>
            <div className="flex flex-wrap gap-3">
              <ExternalButton href={PRESENCIAL_CALENDAR_URL} variant="secondary">
                Entrevista presencial
              </ExternalButton>
              <ExternalButton href={ONLINE_CALENDAR_URL} variant="secondary">
                Entrevista online
              </ExternalButton>
              <ExternalButton href={WHATSAPP_URL} variant="ghost">
                Consultar disponibilidad por WhatsApp
              </ExternalButton>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 text-sm text-stone-600 md:px-6">
          <p className="font-semibold text-stone-900">DNX Fotografía</p>
          <p className="mt-1 text-stone-700">Daniel Cuart Fotografía</p>
          <p className="mt-2">San José 1672 - Local 5 - Funes</p>
          <p>Funes, Rosario y alrededores</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <a href={DNX_WEB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              Web
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              Instagram
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              WhatsApp
            </a>
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              Reseñas
            </a>
          </div>
        </div>
      </footer>

      {/* Sticky mobile */}
      <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-lg backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <a
            href={PRESENCIAL_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-stone-900 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Presencial
          </a>
          <a
            href={ONLINE_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-900"
          >
            Online
          </a>
        </div>
      </div>
    </main>
  );
}
