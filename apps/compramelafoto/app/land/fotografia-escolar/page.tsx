import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const WHATSAPP_URL =
  "https://wa.me/5493413748324?text=Hola%20Daniel%2C%20quiero%20crear%20mi%20usuario%20de%20Administrador%20Escolar%20en%20ComprameLaFoto.%20Me%20interesa%20implementarlo%20en%20mi%20instituci%C3%B3n.";
const AGENDA_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1PLPHPaQEQhSqelvI-O7rq1RXy-N-micuNdyEygkTDr4trwCX88fxjNQOID2uVF9GY5JKwkIHd";
const CREATE_ADMIN_ROUTE = "/registro";
const LANDING_THUMBNAIL_URL =
  "https://www.compramelafoto.com/images/landescolar/fotografo-curso-bandera-argentina.jpg";

const benefits = [
  {
    title: "Ahorro de tiempo",
    description: "Reducís tareas administrativas repetitivas",
  },
  {
    title: "Menos errores",
    description: "Cada pedido queda identificado y controlado",
  },
  {
    title: "Transparencia",
    description: "Cuentas claras entre escuela, fotógrafo y familias",
  },
  {
    title: "Mejor experiencia para familias",
    description: "Compran y hacen seguimiento sin depender de la escuela",
  },
  {
    title: "Ingresos durante el año",
    description: "No queda limitado a un único momento escolar",
  },
  {
    title: "Menos carga operativa",
    description: "La institución deja de resolver tareas de gestión",
  },
];

export const metadata: Metadata = {
  title: "Fotografía escolar organizada para escuelas | ComprameLaFoto",
  description:
    "Simplificá cobros, pedidos y entregas de fotografía escolar con un proceso claro, seguro y sin carga administrativa para la escuela.",
  openGraph: {
    title: "Fotografía escolar organizada, segura y sin carga administrativa",
    description:
      "ComprameLaFoto digitaliza cobros, pedidos y entregas para que la institución trabaje con orden, control y respaldo.",
    images: [
      {
        url: LANDING_THUMBNAIL_URL,
        width: 1200,
        height: 630,
        alt: "Fotografía escolar en una institución de Argentina",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fotografía escolar organizada para escuelas",
    description:
      "Ordená la gestión escolar de fotos con compras online, entregas claras y respaldo institucional.",
    images: [LANDING_THUMBNAIL_URL],
  },
};

function WhatsappButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`clf-btn clf-btn--whatsapp ${className}`}
    >
      {label}
    </a>
  );
}

function AgendaButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <a
      href={AGENDA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`clf-btn clf-btn--secondary ${className}`}
    >
      {label}
    </a>
  );
}

function CreateAdminButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <Link
      href={CREATE_ADMIN_ROUTE}
      className={`clf-btn clf-btn--outline ${className}`}
    >
      {label}
    </Link>
  );
}

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

export default function FotografiaEscolarLandingPage() {
  return (
    <main className="clf-landing bg-white pb-24 text-[#111827]">
      <section className="relative overflow-hidden bg-[#f7f5f2] py-12 sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.18),transparent_60%)]" />
        <div className="clf-container relative grid w-full gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
              Módulo fotografía escolar
            </p>
            <Image
              src="/images/landescolar/compramelafoto-logo.png"
              alt="Logo de ComprameLaFoto"
              width={192}
              height={192}
              className="mt-5 h-14 w-auto sm:h-16"
            />
            <h1 className="clf-hero-title mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Fotografía escolar organizada, segura y sin carga administrativa
            </h1>
            <p className="clf-hero-text mt-4 text-base leading-relaxed text-[#4b5563] sm:text-lg">
              Simplificá cobros, pedidos y entregas, y ofrecé una experiencia clara y
              profesional a las familias.
            </p>
            <div className="clf-btn-stack mt-8 w-full sm:grid sm:grid-cols-2">
              <WhatsappButton label="Quiero implementarlo" className="clf-btn--block" />
              <AgendaButton label="Agendar reunión" className="clf-btn--block" />
              <WhatsappButton label="WhatsApp" className="clf-btn--block sm:col-span-2" />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_50px_-20px_rgba(17,24,39,0.35)]">
            <Image
              src="/images/landescolar/fotografo-curso-bandera-argentina.jpg"
              alt="Fotografía escolar en una institución de Argentina"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <Section title="¿Cuál es el problema hoy?">
        <p>
          Cuando el proceso es manual aparecen errores, demoras y falta de claridad para todas las
          partes.
        </p>
        <ul className="mt-5 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Cobros manuales
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Planillas y control disperso
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Errores en pedidos y entregas
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Falta de claridad con familias
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 sm:col-span-2">
            Desorden operativo y más reclamos
          </li>
        </ul>
      </Section>

      <Section title="La solución: proceso digital y ordenado" className="bg-[#f9fafb]">
        <p>ComprameLaFoto digitaliza todo el proceso de fotografía escolar.</p>
        <ul className="mt-5 space-y-2 text-sm font-medium text-[#1f2937] sm:text-base">
          <li>Compras online por parte de las familias</li>
          <li>Pedidos organizados y trazables</li>
          <li>Menos intervención operativa de la escuela</li>
        </ul>
      </Section>

      <Section title="Un día de fotos más ordenado">
        <p>
          La plataforma permite organizar previamente alumnos y cursos, logrando un flujo más ágil
          y controlado durante la jornada.
        </p>
        <ul className="mt-5 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-3 sm:text-base">
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Menos desorden
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Mejor uso del tiempo
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            Menos errores desde la toma
          </li>
        </ul>
      </Section>

      <Section title="Entregas claras y sin errores" className="bg-[#f9fafb]">
        <p>
          Cada pedido puede organizarse en sobres identificados con códigos QR para mejorar el
          control de entrega.
        </p>
        <ul className="mt-5 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
          <li className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
            Cada alumno recibe exactamente su pedido
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
            Seguimiento del estado
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
            Mayor control en la entrega
          </li>
          <li className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
            Reducción de reclamos
          </li>
        </ul>
      </Section>

      <Section id="beneficios" title="Beneficios para la institución">
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => (
            <article key={item.title} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-[#111827]">{item.title}</h3>
              <p className="mt-2 text-sm text-[#4b5563]">{item.description}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="seguridad" title="Seguridad de datos y respaldo institucional">
        <div className="rounded-2xl border border-[#57b851]/25 bg-[#f0fdf4] p-6">
          <p className="text-base font-semibold text-[#14532d] sm:text-lg">
            ComprameLaFoto está registrada ante la AAIP (Agencia de Acceso a la Información
            Pública).
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#166534] sm:text-base">
            Esto garantiza protección de datos personales, cumplimiento normativo en Argentina y
            mayor confianza institucional.
          </p>
          <p className="mt-3 text-sm font-semibold text-[#166534] sm:text-base">
            Datos cuidados, gestión ordenada y respaldo real.
          </p>
        </div>
      </Section>

      <Section title="Acuerdos claros con el fotógrafo" className="bg-[#f9fafb]">
        <p>
          La plataforma permite registrar y organizar acuerdos comerciales, incluyendo comisiones
          para la institución, siempre según lo acordado previamente entre las partes.
        </p>
      </Section>

      <Section title="Capacitación y acompañamiento">
        <p>La escuela no necesita conocimiento técnico.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm sm:text-base">
            El fotógrafo es capacitado por el equipo de ComprameLaFoto.
          </div>
          <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm sm:text-base">
            Se acompaña la implementación para que la operación sea ordenada desde el inicio.
          </div>
        </div>
      </Section>

      <section className="clf-section clf-section--dark">
        <div className="clf-container">
          <div className="clf-section-header clf-section-header--center">
            <h2 className="clf-section-title">¿Querés implementarlo en tu institución?</h2>
            <p className="clf-section-description">
              Coordiná una charla rápida para revisar cómo funciona en tu caso.
            </p>
          </div>
          <div className="clf-btn-stack mt-8 w-full sm:mx-auto sm:grid sm:max-w-xl sm:grid-cols-2">
            <WhatsappButton label="WhatsApp" className="clf-btn--block" />
            <AgendaButton label="Agendar reunión" className="clf-btn--block" />
            <CreateAdminButton
              label="Crear usuario administrador"
              className="clf-btn--block clf-btn--outline-inverse sm:col-span-2"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] bg-white py-10">
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
            className="mt-3 text-sm text-[#6b7280] underline-offset-4 hover:text-[#111827] hover:underline"
          >
            www.compramelafoto.com
          </a>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white/95 p-3 backdrop-blur sm:hidden">
        <WhatsappButton label="WhatsApp" className="clf-btn--block" />
      </div>

      <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
        <WhatsappButton label="WhatsApp" />
      </div>
    </main>
  );
}
