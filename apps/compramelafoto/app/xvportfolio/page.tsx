import type { Metadata } from "next";
import Image from "next/image";
import DnxImageSlot from "@/components/dnx/DnxImageSlot";

const INSTAGRAM_URL = "https://www.instagram.com/dnxfotografia/";

const portfolioImages = [
  {
    src: "/dnx/xv/portfolio-01.jpg",
    alt: "Fotografía de quinceañera realizada por DNX Estudio",
  },
  {
    src: "/dnx/xv/portfolio-02.jpg",
    alt: "Sesión PRE XV en Rosario por DNX Estudio",
  },
  {
    src: "/dnx/xv/pre-xv-13.jpg",
    alt: "Grupo de amigos disfrutando la previa de la fiesta",
  },
  {
    src: "/dnx/xv/pre-xv-14.jpg",
    alt: "Escenografía y ambientación de fiesta de quinceañera",
  },
  {
    src: "/dnx/xv/pre-xv-15.jpg",
    alt: "Celebración y baile de amigas en pista de XV",
  },
  {
    src: "/dnx/xv/pre-xv-16.jpg",
    alt: "Cobertura social de fiesta con amigos y familiares",
  },
  {
    src: "/dnx/xv/portfolio-03.jpg",
    alt: "Retrato de quinceañera en exteriores",
  },
  {
    src: "/dnx/xv/portfolio-04.jpg",
    alt: "Producción fotográfica para XV años",
  },
  {
    src: "/dnx/xv/portfolio-05.jpg",
    alt: "Fotografía artística de quinceañera",
  },
  {
    src: "/dnx/xv/portfolio-06.jpg",
    alt: "Portfolio de fotografía de XV en Funes y Rosario",
  },
  {
    src: "/dnx/xv/portfolio-08.jpg",
    alt: "Sesión de quinceañera con vestido de noche",
  },
  {
    src: "/dnx/xv/portfolio-09.jpg",
    alt: "Retrato artístico de quinceañera en exteriores",
  },
  {
    src: "/dnx/xv/portfolio-10.jpg",
    alt: "Producción fotográfica de XV con estilo urbano",
  },
  {
    src: "/dnx/xv/portfolio-12.jpg",
    alt: "Retrato de quinceañera en interiores con luces de color",
  },
  {
    src: "/dnx/xv/portfolio-13.jpg",
    alt: "Sesión de quinceañera en arquitectura clásica",
  },
  {
    src: "/dnx/xv/portfolio-14.jpg",
    alt: "Quinceañera en auto clásico durante producción fotográfica",
  },
  {
    src: "/dnx/xv/portfolio-15.jpg",
    alt: "Retrato de quinceañera con vestido elegante en calle urbana",
  },
  {
    src: "/dnx/xv/portfolio-20.jpg",
    alt: "Producción de quinceañera en locación nocturna",
  },
  {
    src: "/dnx/xv/portfolio-21.jpg",
    alt: "Retrato de quinceañera con vestido de gala y luces urbanas",
  },
  {
    src: "/dnx/xv/portfolio-22.jpg",
    alt: "Quinceañera en fiesta con ambientación temática",
  },
  {
    src: "/dnx/xv/portfolio-23.jpg",
    alt: "Momentos espontáneos en pista de baile de XV",
  },
  {
    src: "/dnx/xv/portfolio-24.jpg",
    alt: "Invitados disfrutando la fiesta de quinceañera",
  },
  {
    src: "/dnx/xv/portfolio-25.jpg",
    alt: "Cobertura documental de baile y celebración en XV",
  },
  {
    src: "/dnx/xv/portfolio-26.jpg",
    alt: "Fotografía social en pista de baile con amigos",
  },
  {
    src: "/dnx/xv/portfolio-27.jpg",
    alt: "Retrato grupal de fiesta de quinceañera",
  },
  {
    src: "/dnx/xv/portfolio-28.jpg",
    alt: "Cobertura de grupo de amigos en fiesta de XV",
  },
  {
    src: "/dnx/xv/portfolio-29.jpg",
    alt: "Retrato familiar durante celebración de quince años",
  },
  {
    src: "/dnx/xv/portfolio-30.jpg",
    alt: "Momento emotivo de la quinceañera con su familia",
  },
];

const preXvImages = [
  { src: "/dnx/xv/pre-xv-05.jpg", alt: "Fotografía artística de PRE XV en locación urbana" },
  { src: "/dnx/xv/pre-xv-06.jpg", alt: "Retrato creativo de quinceañera en exteriores" },
  { src: "/dnx/xv/pre-xv-07.jpg", alt: "Sesión PRE XV en blanco y negro con estilo editorial" },
  { src: "/dnx/xv/pre-xv-09.jpg", alt: "Producción PRE XV en arquitectura histórica" },
  { src: "/dnx/xv/pre-xv-10.jpg", alt: "Sesión de quinceañera junto a auto clásico" },
  { src: "/dnx/xv/pre-xv-11.jpg", alt: "Retrato PRE XV en auto clásico descapotable" },
  { src: "/dnx/xv/pre-xv-12.jpg", alt: "Producción PRE XV en vestuario elegante de noche" },
  { src: "/dnx/xv/portfolio-16.jpg", alt: "Producción PRE XV con vestuario oscuro y estilo moda" },
  { src: "/dnx/xv/portfolio-17.jpg", alt: "Sesión de quinceañera en temática western" },
  { src: "/dnx/xv/portfolio-18.jpg", alt: "Retrato de quinceañera al atardecer con luz natural" },
  { src: "/dnx/xv/portfolio-19.jpg", alt: "Fotografía artística de quinceañera en biblioteca" },
];

const eventoImages = [
  { src: "/dnx/xv/evento-xv-01.jpg", alt: "Cobertura fotográfica del ingreso a la fiesta de XV" },
  { src: "/dnx/xv/evento-xv-02.jpg", alt: "Momentos familiares en evento de quinceañera" },
  { src: "/dnx/xv/evento-xv-03.jpg", alt: "Fotografía social y emocional en fiesta de XV" },
];

const allGalleryImages = [...portfolioImages, ...preXvImages, ...eventoImages];

const sectionShell = "mx-auto max-w-7xl px-4 md:px-6";
const sectionY = "py-12 md:py-20";
const introCopy = "mx-auto mb-10 w-full max-w-5xl text-center md:mb-12";

export const metadata: Metadata = {
  title: "Portfolio XV | DNX Estudio",
  description:
    "Portfolio de fotografía de quinceañeras: sesiones PRE XV, cobertura de fiesta y momentos de familia en Funes, Rosario y alrededores.",
  openGraph: {
    title: "Portfolio XV | DNX Estudio",
    description:
      "Portfolio de fotografía de quinceañeras: sesiones PRE XV, cobertura de fiesta y momentos de familia en Funes, Rosario y alrededores.",
    images: [
      {
        url: "/dnx/logo-dnx.png",
        width: 512,
        height: 512,
        alt: "Logo DNX Estudio",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Portfolio XV | DNX Estudio",
    description:
      "Portfolio de fotografía de quinceañeras: sesiones PRE XV, cobertura de fiesta y momentos de familia en Funes, Rosario y alrededores.",
    images: ["/dnx/logo-dnx.png"],
  },
};

export default function XvPortfolioPage() {
  return (
    <main className="overflow-x-hidden bg-[#f4f2ee] text-zinc-900 [&_h1]:w-full [&_h1]:max-w-none [&_h1]:tracking-[-0.03em] [&_h2]:w-full [&_h2]:max-w-none [&_h2]:tracking-[-0.025em] [&_h2]:leading-[1.05] [&_p]:w-full [&_p]:max-w-none [&_p]:leading-relaxed">
      <section className={`${sectionShell} pb-12 pt-8 md:pb-16 md:pt-12`}>
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
          <div className="order-2 space-y-6 md:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              DNX Estudio · Portfolio XV
            </p>
            <div className="flex justify-center md:justify-start">
              <Image
                src="/dnx/logo-dnx.png"
                alt="Logo DNX Estudio"
                width={64}
                height={64}
                className="h-14 w-14 rounded-full object-cover md:h-16 md:w-16"
                priority
              />
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-balance md:text-5xl">
              Fotografía de XV para una etapa que no se repite
            </h1>
            <p className="text-base text-zinc-700 md:text-lg">
              En DNX Estudio acompañamos a cada familia antes, durante y después de la fiesta. Sesión PRE XV,
              cobertura del evento y dirección de poses: un trabajo pensado para que el recuerdo tenga estética,
              coherencia y valor emocional.
            </p>
            <p className="text-sm font-medium text-zinc-500">
              Funes, Rosario y alrededores
            </p>
          </div>
          <DnxImageSlot
            src="/dnx/xv/hero-xv.jpg"
            alt="Fotografía profesional de quinceañera por DNX"
            label="Imagen hero XV"
            className="order-1 min-h-[360px] sm:min-h-[440px] md:order-2 md:min-h-[640px]"
            fit="cover"
            priority
            gallery={allGalleryImages}
          />
        </div>
      </section>

      <section className={`${sectionShell} ${sectionY}`}>
        <div className={introCopy}>
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            El tipo de recuerdo que sabemos crear
          </h2>
          <p className="mt-4 text-base text-zinc-700 md:text-lg">
            Cada foto de esta página pertenece a historias reales de quinceañeras que confiaron en DNX: sesión
            previa, fiesta, familia, amigos, detalles y momentos espontáneos.
          </p>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {portfolioImages.map((image, index) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Portfolio XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
              priority={index === 0}
              gallery={allGalleryImages}
              currentIndex={index}
            />
          ))}
        </div>
      </section>

      <section
        className={`${sectionShell} ${sectionY} grid gap-10 overflow-hidden md:grid-cols-2 md:items-center md:gap-12 md:[&>*]:min-w-0`}
      >
        <DnxImageSlot
          src="/dnx/xv/emocional-xv.jpg"
          alt="Retrato emocional de quinceañera y su familia"
          label="Bloque emocional XV"
          className="min-h-[280px] w-full max-w-full rounded-[28px] sm:min-h-[340px] md:min-h-[500px]"
          fit="cover"
          gallery={allGalleryImages}
        />
        <div className="min-w-0 space-y-5">
          <h2 className="text-2xl font-semibold text-balance md:text-3xl">
            No se trata solo de sacar fotos. Se trata de contar una etapa irrepetible.
          </h2>
          <p className="text-base text-zinc-700 md:text-lg">
            Los XV son mucho más que una fiesta. Son una etapa de cambios, de sueños, de familia y de emociones que
            pasan una sola vez.
          </p>
          <p className="text-base text-zinc-700 md:text-lg">
            Por eso el trabajo no empieza el día del evento: acompañamos desde la planificación y la sesión previa
            para que cada imagen tenga sentido dentro de una misma historia.
          </p>
        </div>
      </section>

      <section className={`${sectionShell} ${sectionY}`}>
        <div className={introCopy}>
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Sesión PRE XV
          </h2>
          <p className="mt-4 text-base text-zinc-700 md:text-lg">
            Un espacio para que ella sea protagonista: dirección de poses, locación y estética acordes a su
            personalidad, sin forzar gestos ni un estilo ajeno a ella.
          </p>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {preXvImages.map((image, index) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Galería PRE XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
              gallery={allGalleryImages}
              currentIndex={portfolioImages.length + index}
            />
          ))}
        </div>
      </section>

      <section className={`${sectionShell} ${sectionY}`}>
        <div className={introCopy}>
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            El día de la fiesta
          </h2>
          <p className="mt-4 text-base text-zinc-700 md:text-lg">
            Además de las fotos posadas, registramos lo que sucede alrededor: la entrada, los abrazos, la familia,
            los amigos, el baile y esos momentos espontáneos que después se vuelven los más valiosos.
          </p>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 md:columns-3">
          {eventoImages.map((image, index) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Cobertura evento XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
              gallery={allGalleryImages}
              currentIndex={portfolioImages.length + preXvImages.length + index}
            />
          ))}
        </div>
      </section>

      <section className={`${sectionShell} py-8 md:py-14`}>
        <div className="relative overflow-hidden rounded-[28px]">
          <DnxImageSlot
            src="/dnx/xv/separador-xv-02.png"
            alt="Separador visual artístico de quinceañera"
            label="Separador visual XV"
            className="min-h-[260px] sm:min-h-[320px] md:min-h-[380px]"
            fit="cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center md:px-10">
            <p className="w-full max-w-4xl rounded-2xl bg-black/45 px-5 py-4 text-base font-medium text-white backdrop-blur-sm sm:text-lg md:px-8 md:py-5 md:text-3xl">
              No hacemos fotos iguales para todas. Cada quinceañera tiene una historia distinta.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`${sectionShell} ${sectionY} grid gap-10 md:grid-cols-2 md:items-center md:gap-12 md:[&>*]:min-w-0`}
      >
        <DnxImageSlot
          src="/dnx/xv/dnx-estudio-xv.jpg"
          alt="Estudio fotográfico DNX Estudio en Funes"
          label="Presentación estudio DNX"
          className="min-h-[280px] w-full rounded-[28px] sm:min-h-[340px] md:min-h-[480px]"
          fit="cover"
        />
        <div className="min-w-0 space-y-5">
          <h2 className="text-3xl font-semibold uppercase md:text-4xl">Somos DNX Estudio</h2>
          <p className="text-base text-zinc-700 md:text-lg">
            Estudio especializado en fotografía de quinceañeras. Acompañamos a familias de Funes, Rosario y
            alrededores con una mirada cercana, planificación previa y una estética cuidada.
          </p>
          <p className="text-base text-zinc-700 md:text-lg">
            El resultado no es solo una galería: es un recuerdo completo de esta historia.
          </p>
          <ul className="space-y-2 text-base text-zinc-700">
            <li>Especialistas en fotografía de quinceañeras.</li>
            <li>Estudio en San José 1672 · Local 5 · Funes.</li>
            <li>Cobertura en Funes, Rosario y alrededores.</li>
            <li>Experiencia en sesiones PRE XV y eventos sociales.</li>
          </ul>
        </div>
      </section>

      <footer className={`${sectionShell} border-t border-zinc-300/70 py-12 text-center md:py-16`}>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">DNX Estudio</p>
        <p className="mt-3 text-base text-zinc-700">Fotografía de XV · Funes, Rosario y alrededores</p>
        <p className="mt-2 text-sm text-zinc-600">San José 1672 · Local 5 · Funes</p>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex text-sm font-semibold text-zinc-800 underline underline-offset-4 transition hover:text-zinc-600"
        >
          @dnxfotografia
        </a>
      </footer>
    </main>
  );
}
