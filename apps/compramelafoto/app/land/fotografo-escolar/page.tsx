import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const TALK_URL = "https://youtu.be/HR9pcjM0Cek?si=hrLh0Vtz5QzVWvsx";
const WHATSAPP_URL =
  "https://wa.me/5493413748324?text=Hola%20Daniel%2C%20soy%20fot%C3%B3grafo%20y%20quiero%20coordinar%20una%20videollamada%20para%20implementar%20ComprameLaFoto%20en%20fotograf%C3%ADa%20escolar.";
const AGENDA_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1PLPHPaQEQhSqelvI-O7rq1RXy-N-micuNdyEygkTDr4trwCX88fxjNQOID2uVF9GY5JKwkIHd";
const CREATE_USER_ROUTE = "/fotografo/registro";
const LANDING_THUMBNAIL_URL =
  "https://www.compramelafoto.com/images/landescolar/escuela-principal-2026.png";

const photographerBenefits = [
  "Preventas antes del día de la toma",
  "Venta online de packs escolares",
  "Pedidos registrados automáticamente",
  "Menos mensajes y desorden por WhatsApp",
  "Menos errores en cobros y entregas",
  "Posibilidad de vender durante todo el año",
  "Presentación profesional frente a escuelas",
];

const shotDayBenefits = [
  "Flujo ordenado de alumnos",
  "Menos tiempos muertos",
  "Identificación clara de cada estudiante",
  "Reducción de errores desde el inicio",
];

const deliveryBenefits = [
  "Cada sobre corresponde a un alumno/pedido",
  "Escaneo del QR para ver estado del pedido",
  "Control total en la entrega",
  "Reducción de errores en distribución",
  "Mayor profesionalismo frente a la institución",
];

export const metadata: Metadata = {
  title: "Fotografía escolar para fotógrafos | ComprameLaFoto",
  description:
    "Aprendé a organizar, vender y entregar fotografía escolar con un sistema claro para trabajar mejor con instituciones.",
  openGraph: {
    title: "Fotografía escolar más organizada, rentable y profesional",
    description:
      "Conocé cómo funciona ComprameLaFoto para preventa, pedidos, entrega y gestión profesional de fotografía escolar.",
    images: [
      {
        url: LANDING_THUMBNAIL_URL,
        width: 1200,
        height: 630,
        alt: "Fotógrafo trabajando en fotografía escolar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fotografía escolar para fotógrafos | ComprameLaFoto",
    description:
      "Ordená tu flujo escolar, vendé mejor y entregá con control usando ComprameLaFoto.",
    images: [LANDING_THUMBNAIL_URL],
  },
};

function Section({
  id,
  title,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`py-12 sm:py-16 ${className}`}>
      <div className="clf-container">
        <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">{title}</h2>
        <div className="mt-4 text-base leading-relaxed text-[#4b5563]">{children}</div>
      </div>
    </section>
  );
}

function PrimaryButton({
  href,
  label,
  className = "",
  fullWidth = true,
}: {
  href: string;
  label: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const widthClass = fullWidth ? "clf-btn--block" : "";
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className={`clf-btn clf-btn--primary ${widthClass} ${className}`}
    >
      {label}
    </a>
  );
}

function SecondaryButton({
  href,
  label,
  className = "",
  fullWidth = true,
}: {
  href: string;
  label: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const widthClass = fullWidth ? "clf-btn--block" : "";
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className={`clf-btn clf-btn--outline ${widthClass} ${className}`}
    >
      {label}
    </a>
  );
}

function WhatsappButton({
  href,
  label,
  className = "",
  fullWidth = true,
}: {
  href: string;
  label: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const widthClass = fullWidth ? "clf-btn--block" : "";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`clf-btn clf-btn--whatsapp ${widthClass} ${className}`}
    >
      {label}
    </a>
  );
}

export default function FotografoEscolarLandingPage() {
  return (
    <main className="fotografoescolar-page clf-landing bg-white pb-24 text-[#111827]">
      <section className="relative overflow-hidden bg-[#f7f5f2] py-12 sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.18),transparent_60%)]" />
        <div className="clf-container relative grid w-full gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
              Módulo fotografía escolar
            </p>
            <h1 className="clf-hero-title mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Fotografía escolar más organizada, rentable y profesional
            </h1>
            <p className="clf-hero-text mt-4 text-base leading-relaxed text-[#4b5563] sm:text-lg">
              Aprendé a usar ComprameLaFoto para vender packs escolares, organizar pedidos y
              trabajar con instituciones de forma clara y sin errores.
            </p>
            <div className="clf-btn-stack mt-8 w-full">
              <PrimaryButton href={TALK_URL} label="Ver la charla" />
              <PrimaryButton href={CREATE_USER_ROUTE} label="Crear mi usuario" />
              <WhatsappButton href={WHATSAPP_URL} label="Consultar por WhatsApp" />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_50px_-20px_rgba(17,24,39,0.35)]">
            <Image
              src="/images/landescolar/escuela-principal-2026.png"
              alt="Fotógrafo trabajando en fotografía escolar"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <Section id="video" title="Mirá cómo funciona el sistema en fotografía escolar">
        <div className="mt-6 mx-auto w-full sm:w-4/5 lg:w-1/2">
          <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-black shadow-sm">
            <div className="aspect-video">
              <iframe
                src="https://www.youtube.com/embed/HR9pcjM0Cek?si=hrLh0Vtz5QzVWvsx"
                title="Charla de fotografía escolar en ComprameLaFoto"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Beneficios para el fotógrafo" className="bg-[#f9fafb]">
        <ul className="mt-5 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
          {photographerBenefits.map((benefit) => (
            <li key={benefit} className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
              {benefit}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Orden total el día de la toma de fotografías">
        <p>
          ComprameLaFoto permite organizar el trabajo desde antes del día de la sesión, definiendo
          alumnos, cursos y estructura de trabajo.
        </p>
        <ul className="mt-5 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
          {shotDayBenefits.map((benefit) => (
            <li key={benefit} className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              {benefit}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Entregas organizadas con sobres y seguimiento por QR" className="bg-[#f9fafb]">
        <p>
          El sistema permite generar sobres de entrega personalizados con códigos QR que identifican
          cada pedido.
        </p>
        <ul className="mt-5 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
          {deliveryBenefits.map((benefit) => (
            <li key={benefit} className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
              {benefit}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Configuración de comisiones con las instituciones">
        <p>
          La plataforma permite trabajar con acuerdos claros entre fotógrafo y escuela, incluyendo
          la posibilidad de definir comisiones según lo acordado previamente.
        </p>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ComprameLaFoto no impone condiciones comerciales, sino que permite organizar y registrar
          lo acordado entre las partes.
        </div>
      </Section>

      <section className="py-12 sm:py-16">
        <div className="clf-container">
          <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dbeafe] text-[#1d4ed8]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">
                  Resguardo de datos y respaldo institucional (AAIP)
                </h2>
                <p className="mt-3 w-full max-w-4xl text-base leading-relaxed text-[#4b5563]">
                  ComprameLaFoto está registrada ante la AAIP (Agencia de Acceso a la Información
                  Pública), el organismo nacional que regula la protección de datos personales en
                  Argentina.
                </p>
                <ul className="mt-4 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
                  <li className="rounded-lg border border-[#dbeafe] bg-white px-4 py-3">
                    Refuerza la confianza de las instituciones al presentar el servicio.
                  </li>
                  <li className="rounded-lg border border-[#dbeafe] bg-white px-4 py-3">
                    Aporta un marco formal para el manejo responsable de datos escolares.
                  </li>
                  <li className="rounded-lg border border-[#dbeafe] bg-white px-4 py-3 sm:col-span-2">
                    Te ayuda a diferenciarte con una propuesta profesional y respaldada.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f9fafb] py-12 sm:py-16">
        <div className="clf-container">
          <div className="clf-promo-block">
            <h2 className="clf-promo-block__title">Mostrale esto a una escuela</h2>
            <p className="clf-promo-block__text">
              Si trabajás con una institución, podés compartirle una página pensada específicamente
              para directivos.
            </p>
            <div className="clf-promo-block__actions">
              <Link href="/escuelas" className="clf-btn clf-btn--outline">
                Ver página para escuelas
              </Link>
            </div>
            <p className="mt-4 text-sm text-[#6b7280]">
              Este link es informativo y no genera comisión por referido. Es una herramienta
              comercial para explicar el sistema.
            </p>
          </div>
        </div>
      </section>

      <section className="clf-section clf-section--dark">
        <div className="clf-container">
          <div className="clf-section-header clf-section-header--center">
            <h2 className="clf-section-title">¿Querés implementarlo en fotografía escolar?</h2>
            <p className="clf-section-description">
              Coordiná una llamada, mirá la charla y activá tu cuenta para empezar.
            </p>
          </div>
          <div className="clf-btn-stack mx-auto mt-8 w-full max-w-xl items-stretch sm:grid sm:grid-cols-2">
            <WhatsappButton
              href={WHATSAPP_URL}
              label="Consultar por WhatsApp"
            />
            <SecondaryButton
              href={AGENDA_URL}
              label="Agendar reunión"
              className="clf-btn--outline-inverse"
            />
            <PrimaryButton
              href={CREATE_USER_ROUTE}
              label="Crear mi usuario"
              className="sm:col-span-2 sm:mx-auto"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] bg-white py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 text-center sm:px-6">
          <Image
            src="/images/landescolar/compramelafoto-logo.png"
            alt="Logo de ComprameLaFoto"
            width={192}
            height={192}
            className="h-16 w-auto"
          />
          <a
            href="https://www.compramelafoto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-sm text-[#6b7280] underline-offset-4 hover:text-[#111827] hover:underline"
          >
            www.compramelafoto.com
          </a>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white/95 p-3 backdrop-blur sm:hidden">
        <WhatsappButton
          href={WHATSAPP_URL}
          label="Consultar por WhatsApp"
        />
      </div>

      <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
        <WhatsappButton href={WHATSAPP_URL} label="WhatsApp" fullWidth={false} />
      </div>
    </main>
  );
}
