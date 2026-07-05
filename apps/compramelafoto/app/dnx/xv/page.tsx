import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DnxImageSlot from "@/components/dnx/DnxImageSlot";

const PRESENCIAL_CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2z_EHMUyZyJoj5R3lNntYdsB8k3vwT60KrdZPSRWzeFR3Pob1o1a1nr90eZXpIs4qxm15ydvF4";

const ONLINE_CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1PLPHPaQEQhSqelvI-O7rq1RXy-N-micuNdyEygkTDr4trwCX88fxjNQOID2uVF9GY5JKwkIHd";

const WHATSAPP_URL =
  "https://web.whatsapp.com/send?phone=5493413748324&text=Hola%20DNX%2C%20quiero%20consultar%20por%20fotograf%C3%ADa%20para%20XV";

const GOOGLE_REVIEWS_URL = "https://share.google/e5qJvomFH1DV2mf4a";

const INSTAGRAM_URL = "https://www.instagram.com/dnxfotografia/";

const DNX_WEB_URL = "https://www.dnxfotografia.com.ar";

const DNX_VIDEOS_URL = "https://www.dnxfotografia.com.ar/gallery/21382-videos";

const PORTFOLIO_SECTION_ID = "portfolio";
const PRICING_SECTION_ID = "precios";

const portfolioImages = [
  {
    src: "/dnx/xv/portfolio-01.jpg",
    alt: "Fotografía de quinceañera realizada por DNX Estudio",
    label: "Portfolio principal",
  },
  {
    src: "/dnx/xv/portfolio-02.jpg",
    alt: "Sesión PRE XV en Rosario por DNX Estudio",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/pre-xv-13.jpg",
    alt: "Grupo de amigos disfrutando la previa de la fiesta",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/pre-xv-14.jpg",
    alt: "Escenografía y ambientación de fiesta de quinceañera",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/pre-xv-15.jpg",
    alt: "Celebración y baile de amigas en pista de XV",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/pre-xv-16.jpg",
    alt: "Cobertura social de fiesta con amigos y familiares",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/portfolio-03.jpg",
    alt: "Retrato de quinceañera en exteriores",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/portfolio-04.jpg",
    alt: "Producción fotográfica para XV años",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/portfolio-05.jpg",
    alt: "Fotografía artística de quinceañera",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/portfolio-06.jpg",
    alt: "Portfolio de fotografía de XV en Funes y Rosario",
    label: "Portfolio secundario",
  },
  {
    src: "/dnx/xv/portfolio-08.jpg",
    alt: "Sesión de quinceañera con vestido de noche",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-09.jpg",
    alt: "Retrato artístico de quinceañera en exteriores",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-10.jpg",
    alt: "Producción fotográfica de XV con estilo urbano",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-12.jpg",
    alt: "Retrato de quinceañera en interiores con luces de color",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-13.jpg",
    alt: "Sesión de quinceañera en arquitectura clásica",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-14.jpg",
    alt: "Quinceañera en auto clásico durante producción fotográfica",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-15.jpg",
    alt: "Retrato de quinceañera con vestido elegante en calle urbana",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-20.jpg",
    alt: "Producción de quinceañera en locación nocturna",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-21.jpg",
    alt: "Retrato de quinceañera con vestido de gala y luces urbanas",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-22.jpg",
    alt: "Quinceañera en fiesta con ambientación temática",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-23.jpg",
    alt: "Momentos espontáneos en pista de baile de XV",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-24.jpg",
    alt: "Invitados disfrutando la fiesta de quinceañera",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-25.jpg",
    alt: "Cobertura documental de baile y celebración en XV",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-26.jpg",
    alt: "Fotografía social en pista de baile con amigos",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-27.jpg",
    alt: "Retrato grupal de fiesta de quinceañera",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-28.jpg",
    alt: "Cobertura de grupo de amigos en fiesta de XV",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-29.jpg",
    alt: "Retrato familiar durante celebración de quince años",
    label: "Portfolio extendido",
  },
  {
    src: "/dnx/xv/portfolio-30.jpg",
    alt: "Momento emotivo de la quinceañera con su familia",
    label: "Portfolio extendido",
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

const planComparisonRows = [
  { feature: "Sesión previa de fotos con maquillaje", basico: true, intermedio: true, premium: true },
  { feature: "Cambios de vestuario ilimitados", basico: true, intermedio: true, premium: true },
  { feature: "Fotolibro sesión previa", basico: false, intermedio: true, premium: true },
  { feature: "Video backstage", basico: false, intermedio: false, premium: true },
  { feature: "Cobertura fotográfica de la fiesta", basico: true, intermedio: true, premium: true },
  { feature: "Fotolibro de la fiesta", basico: false, intermedio: true, premium: true },
  { feature: "Slide de fotos durante la fiesta", basico: false, intermedio: true, premium: true },
  { feature: "Video completo de la fiesta", basico: false, intermedio: false, premium: true },
  { feature: "Pintada / Embarrada / Despertar", basico: false, intermedio: false, premium: true },
  { feature: "60 fotos Polaroids", basico: false, intermedio: false, premium: true },
  { feature: "Pendrive + Caja + 50 fotos 13x18 cm", basico: false, intermedio: false, premium: true },
  { feature: "QR photos", basico: false, intermedio: true, premium: true },
];

const planPrices = {
  basico: "$ 1.052.000",
  intermedio: "$ 1.608.000",
  premium: "$ 2.688.000",
};

const testimonios = [
  {
    nombre: "Sergio Sotello",
    texto:
      "Excelente trabajo, muy buena la calidad de las fotos, la presentación buenísima, muy buena onda el fotógrafo. Nos encantó todo, así que ya lo contratamos para el otro cumple de quince de mi otra bebé. Muy recomendable.",
  },
  {
    nombre: "Jimena Brunazzo",
    texto:
      "Un genio Dani. Toda la buena onda en cada sesión. Hacés lo posible para que cada momento sea más llevadero y sobre todo divertido. Gran fotógrafo.",
  },
  {
    nombre: "Susan Di Giovanni",
    texto:
      "No tengo más que agradecimiento. Excelente trabajo, predisposición y por sobre todo buena onda. Mi hija feliz y nosotros felices con tu trabajo. Te recomendaría una y otra vez porque ofrecés un producto y servicio completo.",
  },
  {
    nombre: "Romina Toledo",
    texto:
      "Cuando mis nenas vieron su publicación dije: voy a averiguar por otros, pero quedé con su servicio porque vi en su trabajo mucha dedicación, creación, arte y amor. Excelente es poco. Lo recomiendo 100%.",
  },
];

export const metadata: Metadata = {
  title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
  description:
    "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
  openGraph: {
    title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
    description:
      "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
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
    title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
    description:
      "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
    images: ["/dnx/logo-dnx.png"],
  },
};

function ExternalButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    secondary: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
    ghost: "text-zinc-700 hover:text-zinc-900 underline underline-offset-4",
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

export default function DnxXvLandingPage() {
  return (
    <main className="overflow-x-hidden bg-[#f4f2ee] pb-28 text-zinc-900 md:pb-10 [&_h1]:w-full [&_h1]:max-w-none [&_h1]:tracking-[-0.03em] [&_h2]:w-full [&_h2]:max-w-none [&_h2]:tracking-[-0.025em] [&_h2]:leading-[1.05] [&_h3]:w-full [&_h3]:max-w-none [&_h3]:tracking-[-0.015em] [&_p]:w-full [&_p]:max-w-none [&_p]:leading-relaxed [&_article]:border-zinc-300/80 [&_article]:shadow-none">
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pt-12">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="order-2 space-y-6 md:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">DNX Estudio · XV</p>
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
            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
              Fotografía de XV para que tu hija tenga un recuerdo completo de una etapa que no se repite
            </h1>
            <p className="text-base leading-relaxed text-zinc-700 md:text-lg">
              En DNX Estudio acompañamos a cada familia antes, durante y después de la fiesta: sesión PRE XV,
              cobertura del evento, dirección de poses, productos impresos y una forma de trabajo pensada para que
              todos disfruten con tranquilidad.
            </p>
            <p className="text-sm font-medium text-zinc-500">Funes, Rosario y alrededores · Entrevistas presenciales u online</p>
            <div className="flex flex-wrap gap-3">
              <ExternalButton href={PRESENCIAL_CALENDAR_URL}>Entrevista presencial</ExternalButton>
              <ExternalButton href={ONLINE_CALENDAR_URL} variant="secondary">
                Entrevista online
              </ExternalButton>
              <Link
                href={`#${PORTFOLIO_SECTION_ID}`}
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Ver portfolio
              </Link>
              <Link
                href={`#${PRICING_SECTION_ID}`}
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Ver precios
              </Link>
            </div>
            <ExternalButton href={WHATSAPP_URL} variant="ghost">
              Consultar disponibilidad por WhatsApp
            </ExternalButton>
          </div>
          <DnxImageSlot
            src="/dnx/xv/hero-xv.jpg"
            alt="Fotografía profesional de quinceañera por DNX"
            label="Imagen hero XV"
            className="order-1 min-h-[360px] sm:min-h-[440px] md:order-2 md:min-h-[760px]"
            fit="contain"
            priority
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">Qué hacemos por ustedes</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Una cobertura de XV no debería depender de la improvisación. Por eso trabajamos con un proceso pensado
            para que la quinceañera se sienta cómoda y la familia tenga la tranquilidad de que los momentos
            importantes van a quedar registrados.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[
            {
              title: "Planificamos antes de la fiesta",
              body: "Conversamos con la familia para conocer la fecha, el estilo del evento y los momentos que no pueden faltar.",
            },
            {
              title: "Dirigimos sin incomodar",
              body: "Acompañamos a la quinceañera con poses naturales, respetuosas y pensadas para que se sienta segura.",
            },
            {
              title: "Cubrimos los momentos importantes",
              body: "Trabajamos atentos a la entrada, familia, amigos, baile, detalles y situaciones espontáneas.",
            },
            {
              title: "Ordenamos la entrega",
              body: "Las fotos y productos se gestionan de forma clara para que la familia pueda elegir, conservar y compartir.",
            },
            {
              title: "Creamos recuerdos reales",
              body: "No todo queda en una pantalla: también ofrecemos fotolibros, impresiones, cuadros y presentaciones personalizadas.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-700">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id={PORTFOLIO_SECTION_ID} className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto mb-8 w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Antes de elegir un pack, mirá el tipo de recuerdo que podemos crear
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Cada foto que ves en esta página forma parte de historias reales de quinceañeras que confiaron en DNX.
            Hay sesiones previas, fiesta, familia, amigos, detalles y momentos espontáneos.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["Sesión PRE XV", "Fiesta", "Familia y amigos", "Detalles", "Momentos espontáneos", "Productos"].map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {portfolioImages.map((image, index) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label={image.label}
              className="mb-4 break-inside-avoid rounded-[28px]"
              priority={index === 0}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/xv/emocional-xv.jpg"
          alt="Retrato emocional de quinceañera y su familia"
          label="Bloque emocional XV"
          className="w-full max-w-full min-h-[280px] rounded-[28px] sm:min-h-[340px] md:min-h-[500px]"
        />
        <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">
            No se trata solo de sacar fotos. Se trata de contar una etapa irrepetible.
          </h2>
          <p className="mt-4 whitespace-pre-line text-zinc-700">
            {`Los XV son mucho más que una fiesta. Son una etapa de cambios, de sueños, de familia y de emociones que pasan una sola vez.

Por eso nuestro trabajo no empieza el día del evento. Te acompañamos desde la planificación, la sesión previa, la elección de productos y cada detalle visual para que el recuerdo tenga coherencia, estética y valor emocional.`}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Una experiencia pensada para la familia y para la quinceañera
          </h2>
        </div>
        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Para la familia: tranquilidad</h3>
            <p className="mt-3 text-zinc-700">
              Saber que hay planificación, experiencia y una forma de trabajo clara permite disfrutar la fiesta sin
              estar pendientes de si se está registrando cada momento importante.
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Para la quinceañera: confianza</h3>
            <p className="mt-3 text-zinc-700">
              La sesión y la cobertura están pensadas para que ella se sienta cómoda, segura y protagonista, con
              fotos que reflejen su personalidad y no poses forzadas.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-semibold uppercase md:text-4xl">
          Sabemos lo que más preocupa a una familia al contratar fotografía
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Que se pierdan momentos importantes",
              body: "Por eso hacemos una entrevista previa, conocemos la dinámica de la fiesta y trabajamos atentos a las situaciones que después se transforman en recuerdos.",
            },
            {
              title: "Que la quinceañera se sienta incómoda",
              body: "La dirección de poses está pensada para acompañarla con respeto, confianza y naturalidad, incluso si es tímida o no está acostumbrada a posar.",
            },
            {
              title: "Que todo quede improvisado",
              body: "Trabajamos con un proceso claro: entrevista, propuesta, sesión previa, cobertura, selección, entrega y productos finales.",
            },
            {
              title: "Que las fotos queden perdidas en una pantalla",
              body: "Además de la entrega digital, ofrecemos productos impresos para conservar y revivir este recuerdo de una forma real.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-zinc-700">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-14">
        <DnxImageSlot
          src="/dnx/xv/separador-xv-02.png"
          alt="Separador visual artístico de quinceañera"
          label="Separador visual XV"
          className="min-h-[260px] sm:min-h-[320px] md:min-h-[380px]"
        />
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center md:px-10">
          <p className="w-full max-w-5xl rounded-2xl bg-black/45 px-4 py-3 text-base font-medium text-white backdrop-blur-sm sm:px-5 sm:py-4 sm:text-lg md:text-3xl">
            No hacemos fotos iguales para todas. Cada quinceañera tiene una historia distinta.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/xv/dnx-estudio-xv.jpg"
          alt="Estudio fotográfico DNX Estudio en Funes"
          label="Presentación estudio DNX"
          className="w-full min-h-[280px] sm:min-h-[340px] md:min-h-[500px]"
        />
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold uppercase md:text-4xl">Somos DNX Estudio</h2>
          <p className="text-zinc-700">
            Somos un estudio especializado en fotografía de quinceañeras. Acompañamos a familias de Funes, Rosario y
            alrededores en una etapa muy especial: los XV de sus hijas.
          </p>
          <p className="text-zinc-700">
            Nuestro trabajo combina fotografía profesional, dirección cuidada, planificación previa, productos
            impresos y una experiencia cercana para que el resultado final no sea solo una galería de fotos, sino un
            recuerdo completo de esta historia.
          </p>
          <ul className="space-y-2 text-zinc-700">
            <li>- Especialistas en fotografía de quinceañeras.</li>
            <li>- Estudio físico en San José 1672 - Local 5 - Funes.</li>
            <li>- Cobertura en Funes, Rosario y alrededores.</li>
            <li>- Experiencia en sesiones PRE XV y eventos sociales.</li>
            <li>- Entrega de productos digitales e impresos.</li>
            <li>- Acompañamiento personalizado desde la entrevista inicial.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Sesión PRE XV: una experiencia pensada para que ella sea protagonista
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            La sesión previa es uno de los momentos más importantes del proceso. Es el espacio donde la quinceañera
            puede verse, reconocerse y disfrutar de una producción pensada para ella, con dirección de poses,
            elección de locación y una estética acorde a su personalidad.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Dirección de poses",
              body: "La guiamos para que se sienta cómoda y segura, sin forzar gestos ni poses que no tengan que ver con ella.",
            },
            {
              title: "Locación con sentido",
              body: "Buscamos espacios que acompañen su estilo, su historia y la estética que quiere para sus XV.",
            },
            {
              title: "Producción cuidada",
              body: "Trabajamos la luz, los encuadres, los cambios de vestuario y los detalles para crear una experiencia completa.",
            },
            {
              title: "Fotos con utilidad real",
              body: "Las imágenes pueden usarse para invitaciones, cuadros, redes, fotolibros y productos impresos.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-700 shadow-sm">
              <h3 className="font-semibold text-zinc-900">{item.title}</h3>
              <p className="mt-2 text-sm">{item.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-4">
          {preXvImages.map((image) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Galería PRE XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">El día de la fiesta, cada momento importa</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Durante el evento no solo buscamos las fotos posadas. También estamos atentos a lo que pasa alrededor: la
            entrada, los abrazos, la familia, los amigos, el baile, los detalles y esos momentos espontáneos que
            después se vuelven los más valiosos.
          </p>
        </div>
        <div className="mt-8 columns-1 gap-4 md:columns-3">
          {eventoImages.map((image) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Cobertura evento XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-semibold uppercase md:text-4xl">Cómo es trabajar con nosotros</h2>
        <p className="mx-auto mt-4 w-full max-w-5xl text-center text-base leading-relaxed text-zinc-700">
          Para que todo salga bien, seguimos un proceso claro desde el primer contacto hasta la entrega final.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "1. Entrevista inicial",
              body: "Nos reunimos con la familia para conocer la fecha, el estilo de la fiesta, las ideas de la quinceañera y qué tipo de recuerdo quieren conservar.",
            },
            {
              title: "2. Elección de propuesta",
              body: "Te mostramos las opciones disponibles y definimos qué cobertura se adapta mejor a la fiesta, al presupuesto y a la importancia que quieran darle al recuerdo.",
            },
            {
              title: "3. Sesión PRE XV",
              body: "Realizamos una sesión previa con dirección, estética y producción para que la quinceañera viva una experiencia propia antes del evento.",
            },
            {
              title: "4. Cobertura del evento",
              body: "El día de la fiesta cubrimos los momentos más importantes con una mirada documental, estética y emocional.",
            },
            {
              title: "5. Selección y entrega",
              body: "Después del evento, la familia accede a sus fotos de forma organizada para elegir, conservar y compartir.",
            },
            {
              title: "6. Productos finales",
              body: "Entregamos fotografías digitales, impresiones, fotolibros, cuadros o productos personalizados según la propuesta contratada.",
            },
          ].map((step) => (
            <article key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-2 text-zinc-700">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/xv/productos-xv-01.jpg"
          alt="Productos impresos para fotografía de XV"
          label="Productos impresos XV"
          className="w-full max-w-full min-h-[280px] sm:min-h-[340px] md:min-h-[470px]"
        />
        <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-3xl font-semibold">Tus fotos no deberían quedar solamente en el celular</h2>
          <p className="text-zinc-700">
            Las fotos digitales son importantes, pero los recuerdos más valiosos también merecen estar impresos. Por
            eso ofrecemos fotolibros, ampliaciones, cuadros y presentaciones personalizadas para que esta etapa pueda
            conservarse y volver a vivirse con el paso del tiempo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Fotolibros", "Ampliaciones", "Cuadros", "Presentaciones personalizadas"].map((item) => (
              <div key={item} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                {item}
              </div>
            ))}
          </div>
          <p className="text-sm font-medium text-zinc-600">
            Porque un recuerdo importante no debería perderse entre miles de archivos.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Elegí la propuesta según cómo querés recordar tus XV
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Algunas familias buscan una cobertura clara y profesional. Otras quieren sumar sesión previa, fotolibros,
            video, backstage, impresiones y una experiencia más completa.
          </p>
          <p className="mt-3 text-base leading-relaxed text-zinc-700">
            Por eso trabajamos con propuestas diferentes, para que puedan elegir según la importancia que quieran
            darle al recuerdo.
          </p>
        </div>
        <div id={PRICING_SECTION_ID} className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="hidden lg:grid lg:grid-cols-[2.5fr_1fr_1fr_1fr]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 text-base font-semibold uppercase tracking-wide text-zinc-600">
              Incluye
            </div>
            <div className="border-b border-l border-zinc-200 bg-zinc-50 p-4 text-center">
              <p className="text-base font-semibold uppercase tracking-wide text-zinc-700">Básico</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{planPrices.basico}</p>
            </div>
            <div className="border-b border-l border-zinc-200 bg-zinc-900 p-4 text-center text-white">
              <span className="inline-flex rounded-full bg-amber-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-900">
                Más elegido
              </span>
              <p className="mt-2 text-base font-semibold uppercase tracking-wide text-amber-300">Intermedio</p>
              <p className="mt-1 text-2xl font-bold text-white">{planPrices.intermedio}</p>
            </div>
            <div className="border-b border-l border-zinc-200 bg-zinc-50 p-4 text-center">
              <p className="text-base font-semibold uppercase tracking-wide text-zinc-700">Premium</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{planPrices.premium}</p>
            </div>
            {planComparisonRows.map((row, index) => (
              <div key={row.feature} className="contents">
                <div
                  className={`p-4 text-base text-zinc-700 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/70"} border-b border-zinc-200`}
                >
                  {row.feature}
                </div>
                <div
                  className={`flex items-center justify-center border-b border-l border-zinc-200 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/70"}`}
                >
                  <span className={`text-2xl font-bold ${row.basico ? "text-emerald-600" : "text-red-500"}`}>{row.basico ? "✓" : "✕"}</span>
                </div>
                <div
                  className={`flex items-center justify-center border-b border-l border-zinc-200 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/70"}`}
                >
                  <span className={`text-2xl font-bold ${row.intermedio ? "text-emerald-600" : "text-red-500"}`}>
                    {row.intermedio ? "✓" : "✕"}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-center border-b border-l border-zinc-200 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/70"}`}
                >
                  <span className={`text-2xl font-bold ${row.premium ? "text-emerald-600" : "text-red-500"}`}>{row.premium ? "✓" : "✕"}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 p-4 lg:hidden">
            {[
              { id: "basico", title: "Básico", price: planPrices.basico },
              { id: "intermedio", title: "Intermedio · Más elegido", price: planPrices.intermedio },
              { id: "premium", title: "Premium", price: planPrices.premium },
            ].map((plan) => (
              <article
                key={plan.id}
                className={`rounded-2xl border p-4 ${
                  plan.id === "intermedio" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"
                }`}
              >
                <h3 className={`text-lg font-semibold ${plan.id === "intermedio" ? "text-amber-300" : "text-zinc-900"}`}>{plan.title}</h3>
                <p className={`mt-1 text-base font-bold ${plan.id === "intermedio" ? "text-white" : "text-zinc-900"}`}>{plan.price}</p>
                <ul className="mt-3 space-y-2">
                  {planComparisonRows.map((row) => {
                    const included = row[plan.id as keyof typeof row] as boolean;
                    return (
                      <li key={`${plan.id}-${row.feature}`} className="flex items-start gap-2 text-sm">
                        <span className={`mt-[1px] text-base font-bold ${included ? "text-emerald-500" : "text-red-500"}`}>
                          {included ? "✓" : "✕"}
                        </span>
                        <span className={plan.id === "intermedio" ? "text-zinc-100" : "text-zinc-700"}>{row.feature}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600">
          No hace falta que decidas todo ahora. En la entrevista revisamos tu fecha, el estilo de fiesta, qué le
          gustaría a la quinceañera, qué productos les interesan y cuál de las propuestas tiene más sentido para
          ustedes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ExternalButton href={PRESENCIAL_CALENDAR_URL}>Entrevista presencial</ExternalButton>
          <ExternalButton href={ONLINE_CALENDAR_URL} variant="secondary">
            Entrevista online
          </ExternalButton>
          <ExternalButton href={WHATSAPP_URL} variant="ghost">
            Consultar disponibilidad por WhatsApp
          </ExternalButton>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Lo que dicen las familias que ya vivieron la experiencia DNX
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            La tranquilidad de las familias es una de las partes más importantes de nuestro trabajo.
          </p>
          <p className="mt-3 text-base leading-relaxed text-zinc-700">
            Las familias no solo valoran las fotos. También valoran la tranquilidad, el acompañamiento y la forma en
            la que vivimos el proceso junto a ellas.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {testimonios.map((item) => (
            <article key={item.nombre} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-zinc-700">“{item.texto}”</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">{item.nombre}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 text-center">
          <ExternalButton href={GOOGLE_REVIEWS_URL}>Ver más reseñas</ExternalButton>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Beneficios DNX para organizar mejor la inversión
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Sabemos que organizar una fiesta de XV implica muchas decisiones. Por eso sumamos beneficios para facilitar
            la contratación y agregar valor a la experiencia.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            "Financiación sin recargo hasta el día de la fiesta o un máximo de 6 pagos.",
            "20% de descuento en un pago en packs intermedio y premium.",
            "30% de descuento en diseño de invitación virtual web.",
            "Beneficios especiales con marcas aliadas para experiencias de quinceañeras.",
          ].map((benefit) => (
            <article key={benefit} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-zinc-700">{benefit}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600">
          Los beneficios pueden variar según fecha, disponibilidad y propuesta contratada. Los vemos juntos en la
          entrevista.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 text-center md:px-6 md:py-20">
        <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
          También podemos contar parte de la historia en video
        </h2>
        <p className="mx-auto mt-4 w-full max-w-5xl text-base leading-relaxed text-zinc-700">
          Algunas propuestas permiten sumar video, backstage o resúmenes para conservar no solo cómo se veía la
          fiesta, sino también cómo se vivió.
        </p>
        <div className="mt-6">
          <ExternalButton href={DNX_VIDEOS_URL}>Ver videos de DNX</ExternalButton>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-semibold uppercase md:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              q: "¿La entrevista tiene costo?",
              a: "No. La entrevista inicial es sin costo y sirve para conocernos, resolver dudas y ver qué propuesta se adapta mejor a la fiesta.",
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
              a: "Lo ideal es consultar apenas tengan fecha definida, especialmente en temporada alta.",
            },
            {
              q: "¿La sesión PRE XV está incluida?",
              a: "Depende de la propuesta elegida. En la entrevista te mostramos las opciones disponibles.",
            },
            {
              q: "¿Qué pasa si mi hija es tímida o no sabe posar?",
              a: "No hay problema. La sesión está guiada de principio a fin. La ayudamos con poses, gestos y movimientos para que se sienta cómoda, sin forzar una actitud que no tenga que ver con ella.",
            },
            {
              q: "¿Entregan fotos impresas?",
              a: "Sí. Trabajamos con productos impresos, fotolibros y diferentes formatos según el pack contratado.",
            },
            {
              q: "¿Cómo reservamos la fecha?",
              a: "Primero coordinamos una entrevista para revisar disponibilidad, propuesta y condiciones. Si la fecha está disponible, te indicamos cómo avanzar con la reserva.",
            },
            {
              q: "¿Los valores se pueden financiar?",
              a: "Sí. Contamos con opciones de financiación sin recargo hasta el día de la fiesta o hasta un máximo de 6 pagos, según la propuesta elegida.",
            },
            {
              q: "¿Podemos personalizar el pack?",
              a: "Sí. Los packs sirven como base, pero en la entrevista podemos revisar adicionales, productos impresos, video, backstage u otras necesidades específicas.",
            },
            {
              q: "¿Cuánto tarda la entrega?",
              a: "Los tiempos de entrega se informan en la entrevista según la propuesta contratada y el tipo de productos incluidos.",
            },
            {
              q: "¿Qué pasa si todavía no tenemos todo definido?",
              a: "Podés agendar igual. La entrevista también sirve para ordenar ideas, resolver dudas y entender qué tipo de cobertura tiene más sentido para la fiesta.",
            },
            {
              q: "¿Cubren ceremonia?",
              a: "Las propuestas principales están enfocadas en sesión PRE XV y fiesta. Si la familia necesita cubrir una ceremonia u otro momento especial, lo evaluamos en la entrevista.",
            },
          ].map((item) => (
            <article key={item.q} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-zinc-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="grid gap-8 rounded-3xl bg-zinc-900 p-6 text-white md:grid-cols-2 md:items-center md:p-10 md:[&>*]:min-w-0">
          <DnxImageSlot
            src="/dnx/xv/cierre-xv.jpg"
            alt="Cierre de experiencia fotográfica para XV"
            label="Cierre CTA XV"
            className="min-h-[240px] bg-zinc-700 sm:min-h-[280px] md:min-h-[360px]"
          />
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">
              El primer paso es revisar tu fecha y resolver tus dudas
            </h2>
            <p className="text-zinc-200">
              Agendá una entrevista presencial u online. Te mostramos las propuestas completas, vemos disponibilidad
              para tu fecha y te ayudamos a elegir la opción más conveniente para tus XV.
            </p>
            <p className="text-zinc-300">
              La entrevista es sin costo y no te compromete a contratar.
            </p>
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

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-zinc-600 md:px-6">
          <p className="font-semibold text-zinc-900">DNX Estudio</p>
          <p className="mt-2">San José 1672 - Local 5 - Funes</p>
          <p>Funes, Rosario y alrededores</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <a href={DNX_WEB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Web
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Instagram
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              WhatsApp
            </a>
            <a href={DNX_VIDEOS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Videos
            </a>
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Reseñas
            </a>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <a
            href={PRESENCIAL_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Presencial
          </a>
          <a
            href={ONLINE_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-900"
          >
            Online
          </a>
        </div>
      </div>
    </main>
  );
}
