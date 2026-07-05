import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Role } from "@/lib/prisma";
import {
  CheckCircle2,
  CreditCard,
  Globe2,
  Images,
  LayoutGrid,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAuthUser } from "@/lib/auth";

import { ORGANIZER_CONSULT_WHATSAPP_URL } from "@/lib/organizer-consult-whatsapp";

const REGISTRO_ORGANIZADOR = "/registro/organizador";

/** Vista ilustrativa del panel y la galería (OG / thumbnail). */
const ORGANIZADOR_HERO_ILLUSTRATION = "/images/organizador/hero-marketing.jpg";

const heroIllustrationAlt =
  "Vista del panel para organizadores y la galería pública del evento en ComprameLaFoto: convocatoria de fotógrafos, carpetas, ventas y comisiones.";

export const metadata: Metadata = {
  title: "Organizadores de eventos | ComprameLaFoto",
  description:
    "Creá eventos, convocá fotógrafos, organizá galerías y generá comisiones por la venta de fotos con ComprameLaFoto.",
  openGraph: {
    title: "Organizadores de eventos | ComprameLaFoto",
    description:
      "Creá eventos, convocá fotógrafos, organizá galerías y generá comisiones por la venta de fotos con ComprameLaFoto.",
    images: [
      {
        url: ORGANIZADOR_HERO_ILLUSTRATION,
        width: 1024,
        height: 682,
        alt: heroIllustrationAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Organizadores de eventos | ComprameLaFoto",
    description:
      "Creá eventos, convocá fotógrafos, organizá galerías y generá comisiones por la venta de fotos con ComprameLaFoto.",
    images: [ORGANIZADOR_HERO_ILLUSTRATION],
  },
};

function Section({
  id,
  title,
  children,
  className = "",
  eyebrow,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <section id={id} className={`py-12 sm:py-16 ${className}`}>
      <div className="clf-container min-w-0">
        <header className="min-w-0 max-w-[900px]">
          {eyebrow ? (
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">{eyebrow}</p>
          ) : null}
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">{title}</h2>
        </header>
        <div className="mt-6 min-w-0 w-full max-w-none">{children}</div>
      </div>
    </section>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3f4f6] text-[#9a5c2a]">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

const benefitCards = [
  {
    icon: Wallet,
    title: "Monetizá tu evento sin vender fotos a mano",
    text: "La venta queda en la plataforma: menos idas y vueltas y más tiempo para el evento.",
  },
  {
    icon: Megaphone,
    title: "Incentivá una mejor cobertura",
    text: "Varios fotógrafos pueden sumarse y cada uno muestra su trabajo en un mismo lugar.",
  },
  {
    icon: LayoutGrid,
    title: "Galería ordenada y fácil de compartir",
    text: "Un link para el evento; los clientes encuentran lo que buscan más rápido.",
  },
  {
    icon: Users,
    title: "Mejor experiencia para participantes y familias",
    text: "Compran cuando quieren, desde el celular, sin depender de mensajes sueltos.",
  },
  {
    icon: Images,
    title: "Centralizá fotógrafos, álbumes y carpetas",
    text: "Una estructura clara para vos y para quien compra.",
  },
  {
    icon: CreditCard,
    title: "Pagos con tarjeta, también desde el exterior",
    text: "Quienes están en otro país pueden pagar con tarjeta internacional.",
  },
] as const;

const idealFor = [
  "Torneos deportivos",
  "Carreras y maratones",
  "Escuelas deportivas y academias",
  "Festivales",
  "Competencias",
  "Graduaciones y actos",
  "Eventos culturales",
  "Clubes e instituciones",
] as const;

const faqItems = [
  {
    q: "¿Tengo que contratar fotógrafos yo?",
    a: "No es obligatorio hacerlo por fuera. Creás el evento en ComprameLaFoto y convocás fotógrafos desde la plataforma. Si ya tenés fotógrafos de confianza, pueden sumarse según la configuración del evento.",
  },
  {
    q: "¿Puedo aprobar quién participa?",
    a: "Sí. Podés definir si el evento es abierto, si los fotógrafos piden ingreso con tu aprobación o si es por invitación. Vos decidís quién participa.",
  },
  {
    q: "¿Puedo ganar comisión por las ventas?",
    a: "Sí. Podés definir una comisión del organizador sobre las ventas. Se gestiona desde tu panel y respeta las reglas de la plataforma, incluido el período de seguridad antes de liquidar.",
  },
  {
    q: "¿Los fotógrafos pueden poner sus precios?",
    a: "En el modo recomendado, cada fotógrafo define sus precios digitales. También existe la opción de precios digitales oficiales unificados del evento, cuando necesitás esa experiencia.",
  },
  {
    q: "¿Puedo organizar las fotos por categorías?",
    a: "Sí. Usás carpetas oficiales del evento como etiquetas visuales: categorías, canchas, horarios, finales, premiación, sectores, etc.",
  },
  {
    q: "¿La plataforma cobra los pagos?",
    a: "Sí. Los clientes pagan la compra a través de ComprameLaFoto; el dinero se distribuye según las reglas vigentes (plataforma, fotógrafos, comisiones, laboratorio cuando corresponda).",
  },
  {
    q: "¿Pueden comprar desde otros países?",
    a: "Sí. Pueden pagar con tarjeta internacional, como en cualquier compra online, aunque estén fuera del país.",
  },
  {
    q: "¿Qué pasa si quiero un evento privado?",
    a: "Podés configurarlo por invitación o con aprobación previa, así solo participa quien vos autorizás.",
  },
] as const;

export default async function OrganizadorLandingPage() {
  const user = await getAuthUser();
  const isOrganizerUser = user?.role === Role.ORGANIZER || user?.role === Role.SCHOOL_ORGANIZER;
  const primaryHref = isOrganizerUser ? "/organizador/events/new" : REGISTRO_ORGANIZADOR;
  const finalHref = isOrganizerUser ? "/organizador/events/new" : REGISTRO_ORGANIZADOR;
  const finalCtaLabel = isOrganizerUser ? "Crear un evento" : "Registrarme como organizador";

  return (
    <main className="clf-landing min-w-0 bg-white pb-24 text-[#111827]">
      {/* Hero: texto + ilustración lateral derecha (chica en desktop) */}
      <section className="relative overflow-hidden border-b border-[#e5e7eb] bg-[#f7f5f2] py-10 sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.16),transparent_55%)]" />
        <div className="clf-container relative min-w-0">
          <div className="grid min-w-0 gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
            <div className="min-w-0 lg:order-1 lg:col-span-7">
              <p className="m-0 inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
                Para organizadores
              </p>
              <h1 className="clf-hero-title mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.5rem]">
                Organizá la cobertura fotográfica de tu evento y generá ingresos con cada venta
              </h1>
              <p className="clf-hero-text mt-4 text-base leading-relaxed text-[#4b5563] sm:text-lg">
                Creá tu evento en ComprameLaFoto, convocá fotógrafos cercanos, ordená las galerías por carpetas y recibí
                comisiones por las fotos vendidas.
              </p>
              <div className="mt-8 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
                <div className="flex w-full min-w-0 flex-row flex-nowrap items-stretch gap-4 sm:gap-5 sm:flex-1">
                  <Link
                    href={primaryHref}
                    className="clf-btn clf-btn--primary !flex !min-w-0 min-h-[3rem] flex-1 basis-0 justify-center px-3 py-3 text-center !whitespace-normal text-sm leading-snug sm:px-4 sm:text-base"
                  >
                    Crear mi evento
                  </Link>
                  <a
                    href="#como-funciona"
                    className="clf-btn clf-btn--outline !flex !min-w-0 min-h-[3rem] flex-1 basis-0 justify-center px-3 py-3 text-center !whitespace-normal text-sm leading-snug sm:px-4 sm:text-base"
                  >
                    Conocer cómo funciona
                  </a>
                </div>
                <a
                  href={ORGANIZER_CONSULT_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clf-btn !flex min-h-[3rem] w-full items-center justify-center gap-2 border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-center text-sm font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20 sm:w-auto sm:text-base"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                  Consultar por WhatsApp
                </a>
              </div>
            </div>

            <div className="min-w-0 lg:order-2 lg:col-span-5 lg:self-start lg:sticky lg:top-24">
              <figure className="m-0 mx-auto w-full max-w-[min(100%,320px)] sm:max-w-[360px] lg:mx-0 lg:ml-auto lg:max-w-[380px] xl:max-w-[420px]">
                <Link
                  href={primaryHref}
                  aria-label="Crear mi evento"
                  className="group block min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_40px_-20px_rgba(17,24,39,0.35)] outline-none transition hover:shadow-[0_20px_44px_-18px_rgba(17,24,39,0.42)] focus-visible:ring-2 focus-visible:ring-[#c27b3d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f5f2]"
                >
                  <div className="relative w-full aspect-[1024/682] bg-white transition group-hover:brightness-[1.02]">
                    <Image
                      src={ORGANIZADOR_HERO_ILLUSTRATION}
                      alt=""
                      fill
                      className="object-contain object-center"
                      sizes="(max-width: 1023px) min(320px, 90vw), 420px"
                      priority
                    />
                  </div>
                </Link>
                <figcaption className="ds-readable-text ds-readable-text--fluid mt-2.5 m-0 text-center text-xs leading-snug text-[#6b7280] sm:text-sm lg:text-right">
                  Ejemplo visual: panel, galería pública y convocatoria. Tocá la imagen para ir a crear tu evento.
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      <Section id="como-funciona" title="Cómo funciona" className="bg-white" eyebrow="Recorrido">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              n: 1,
              title: "Creás el evento",
              body: "Datos del evento, fechas y ubicación. Desde ahí armás la convocatoria y la estructura de carpetas.",
            },
            {
              n: 2,
              title: "Convocás fotógrafos",
              body: "El sistema puede invitar automáticamente a fotógrafos cercanos según el radio que cada uno tenga configurado. Vos definís si el ingreso es abierto, con aprobación o por invitación.",
            },
            {
              n: 3,
              title: "Organizás la cobertura",
              body: "Carpetas por cancha, categoría, horario, momento de la jornada, final, premiación o lo que necesites para que sea fácil de navegar.",
            },
            {
              n: 4,
              title: "Compartís la galería",
              body: "Publicás el link de la galería del evento. Los clientes eligen y compran sus fotos cuando quieran.",
            },
            {
              n: 5,
              title: "Recibís comisión",
              body: "Si lo activás, configurás un porcentaje de comisión del organizador sobre las ventas elegibles, según las reglas de la plataforma.",
            },
          ].map((step) => (
            <article
              key={step.n}
              className="flex min-w-0 flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm"
            >
              <span className="text-sm font-semibold text-[#9a5c2a]">Paso {step.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-[#111827]">{step.title}</h3>
              <p className="ds-readable-text ds-readable-text--fluid mt-2 m-0 max-w-none text-sm leading-relaxed text-[#4b5563]">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Por qué le sirve al organizador" className="bg-[#f9fafb]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefitCards.map((b) => (
            <article key={b.title} className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <IconBadge icon={b.icon} />
              <h3 className="mt-4 text-base font-semibold text-[#111827] sm:text-lg">{b.title}</h3>
              <p className="ds-readable-text ds-readable-text--fluid mt-2 m-0 max-w-none text-sm text-[#4b5563]">
                {b.text}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Comisiones para organizadores" className="bg-white">
        <div className="clf-text-wide rounded-2xl border border-[#c27b3d]/25 bg-[#fdf8f3] p-6 sm:p-8">
          <p className="ds-readable-text ds-readable-text--fluid m-0 max-w-none text-base leading-relaxed text-[#1f2937]">
            El organizador puede definir una comisión sobre las ventas de fotos de su evento. Eso alinea intereses:
            mientras más se difunde la galería, más posibilidades de venta hay para fotógrafos y para el evento.
          </p>
          <p className="ds-readable-text ds-readable-text--fluid mt-4 m-0 max-w-none text-sm leading-relaxed text-[#4b5563]">
            Las comisiones se gestionan desde tu panel y se habilitan después del{" "}
            <strong className="font-semibold text-[#374151]">período de seguridad</strong> que define la plataforma
            antes de liquidar fondos.
          </p>
        </div>
      </Section>

      <Section title="Convocatoria de fotógrafos" className="bg-[#f9fafb]" eyebrow="Control y alcance">
        <ul className="m-0 grid max-w-none list-none gap-3 p-0 sm:grid-cols-2">
          {[
            { icon: Globe2, text: "Eventos abiertos: pueden postularse fotógrafos según las reglas que definas." },
            { icon: UserCheck, text: "Eventos con aprobación: vos revisás quién entra antes de que publiquen." },
            { icon: Lock, text: "Eventos privados por invitación: solo quien recibe invitación puede participar." },
            { icon: MapPin, text: "Invitación a fotógrafos cercanos: avisos por email respetando la distancia de cobertura de cada fotógrafo." },
            { icon: CheckCircle2, text: "El organizador mantiene el control de quién cubre el evento en la plataforma." },
          ].map((item) => (
            <li
              key={item.text}
              className="flex min-w-0 gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#1f2937]"
            >
              <IconBadge icon={item.icon} />
              <span className="min-w-0 self-center leading-relaxed">{item.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Carpetas y organización" className="bg-white">
        <p className="clf-text-wide ds-readable-text ds-readable-text--fluid m-0 max-w-none text-base text-[#4b5563]">
          Las carpetas no son “almacenamiento técnico”: son{" "}
          <strong className="font-semibold text-[#111827]">etiquetas visuales</strong> para que los clientes encuentren
          más rápido sus fotos. Pensalas por cancha, categoría, horario, final, premiación, sectores o lo que tenga
          sentido para tu evento.
        </p>
        <div className="mt-6 flex min-w-0 flex-wrap gap-2">
          {["Explorador de carpetas", "Categorías", "Canchas", "Horarios", "Final", "Premiación", "Sectores"].map(
            (tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1.5 text-sm font-medium text-[#374151]"
              >
                {tag}
              </span>
            )
          )}
        </div>
      </Section>

      <Section title="Precios digitales" className="bg-[#f9fafb]">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-semibold text-[#111827]">A. Cada fotógrafo define sus precios</h3>
            <p className="ds-readable-text ds-readable-text--fluid mt-3 m-0 max-w-none text-sm leading-relaxed text-[#4b5563]">
              Es el modo que suele funcionar mejor para convocar: cada colega ajusta su venta digital y vos mantenés la
              libertad de la cobertura.
            </p>
            <p className="mt-2 mb-0 inline-flex rounded-full bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#047857]">
              Recomendado para convocatoria amplia
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-semibold text-[#111827]">B. Precios digitales oficiales del evento</h3>
            <p className="ds-readable-text ds-readable-text--fluid mt-3 m-0 max-w-none text-sm leading-relaxed text-[#4b5563]">
              Una experiencia comercial unificada: el evento define la lógica de venta digital oficial. Es una opción
              más avanzada cuando ya tenés acuerdo con los fotógrafos.
            </p>
          </article>
        </div>
        <p className="clf-text-wide ds-readable-text ds-readable-text--fluid mt-6 m-0 max-w-none text-sm text-[#4b5563]">
          En ambos casos, los fotógrafos pueden seguir ofreciendo impresiones y productos físicos según su listado de
          precios, salvo acuerdos particulares fuera de la plataforma.
        </p>
      </Section>

      <Section title="Pagos internacionales" className="bg-white">
        <div className="clf-text-wide flex min-w-0 gap-4 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-6 sm:items-start">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#c27b3d] shadow-sm">
            <Globe2 className="h-6 w-6" aria-hidden />
          </span>
          <p className="ds-readable-text ds-readable-text--fluid m-0 min-w-0 flex-1 max-w-none text-base leading-relaxed text-[#1f2937]">
            Participantes o familiares en el exterior pueden comprar fotos con{" "}
            <strong className="font-semibold text-[#111827]">tarjeta internacional</strong>, sin complicaciones extra
            para quien compra.
          </p>
        </div>
      </Section>

      <Section title="Ideal para" className="bg-[#f9fafb]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {idealFor.map((label) => (
            <div
              key={label}
              className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-center text-sm font-medium text-[#1f2937] sm:text-base"
            >
              {label}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Preguntas frecuentes" className="bg-white">
        <div className="w-full min-w-0 max-w-[900px] space-y-3">
          {faqItems.map((item) => (
            <details
              key={item.q}
              className="w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm"
            >
              <summary className="block w-full min-w-0 cursor-pointer list-none text-left text-base font-semibold text-[#111827] [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="ds-readable-text ds-readable-text--fluid mt-3 m-0 max-w-none text-sm leading-relaxed text-[#4b5563] sm:text-base">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <section className="clf-section clf-section--dark clf-section--viewport-centered">
        <div className="clf-container">
          <div className="clf-section-header clf-section-header--center w-full">
            <h2 className="clf-section-title">Creá tu primer evento en ComprameLaFoto</h2>
            <p className="clf-section-description">
              Configurá el evento, convocá fotógrafos y empezá a vender fotos de manera organizada.
            </p>
          </div>
          <div className="mt-8 flex w-full max-w-xl flex-col items-center justify-center gap-3 sm:mx-auto sm:flex-row">
            <Link
              href={finalHref}
              className="clf-btn clf-btn--primary clf-btn--block w-full max-w-md whitespace-nowrap text-center sm:w-auto sm:min-w-[16rem]"
            >
              {finalCtaLabel}
            </Link>
            <a
              href={ORGANIZER_CONSULT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="clf-btn clf-btn--block flex w-full max-w-md items-center justify-center gap-2 border border-white/30 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/20 sm:w-auto sm:min-w-[16rem] sm:text-base"
            >
              <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
              Consultar por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] bg-white py-10">
        <div className="clf-container text-center text-sm text-[#6b7280]">
          <p className="m-0">ComprameLaFoto</p>
          <p className="mt-2 m-0">www.compramelafoto.com</p>
        </div>
      </footer>

      <a
        href={ORGANIZER_CONSULT_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-[4.75rem] right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:bg-[#20bd5a] sm:bottom-6 sm:h-[3.25rem] sm:w-auto sm:gap-2 sm:rounded-full sm:px-5"
        aria-label="Consultar por WhatsApp"
      >
        <MessageCircle className="h-6 w-6 shrink-0 sm:h-5 sm:w-5" aria-hidden />
        <span className="hidden font-semibold sm:inline">WhatsApp</span>
      </a>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white/95 p-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <Link
            href={primaryHref}
            className="clf-btn clf-btn--primary min-h-[2.75rem] flex-1 whitespace-nowrap text-center text-sm"
          >
            Crear mi evento
          </Link>
          <a
            href={ORGANIZER_CONSULT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="clf-btn flex min-h-[2.75rem] shrink-0 items-center justify-center border border-[#25D366]/40 bg-[#25D366]/10 px-3 text-[#128C7E]"
            aria-label="WhatsApp"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
          </a>
        </div>
      </div>
    </main>
  );
}
