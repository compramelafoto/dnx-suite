"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Textarea from "@/components/ui/Textarea";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Clock3,
  CalendarCheck2,
  Smartphone,
  ClipboardList,
  BadgeCheck,
  Eye,
  Download,
  Database,
  ClipboardCheck,
  Settings2,
  ShieldCheck,
  Handshake,
  FileText,
  ChartColumn,
  Upload,
  Images,
  ShoppingCart,
} from "lucide-react";

const WHATSAPP_PHONE = "5493413748324";

type FormState = {
  schoolName: string;
  city: string;
  contactName: string;
  contactRole: string;
  email: string;
  whatsapp: string;
  approxStudents: string;
  message: string;
};

const initialForm: FormState = {
  schoolName: "",
  city: "",
  contactName: "",
  contactRole: "",
  email: "",
  whatsapp: "",
  approxStudents: "",
  message: "",
};

type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const benefits: FeatureItem[] = [
  {
    title: "Organización total de la fotografía escolar",
    description: "Toda la gestión queda ordenada y centralizada para la institución.",
    icon: LayoutGrid,
  },
  {
    title: "Reducción del trabajo administrativo",
    description: "Se reducen tareas manuales y tiempos operativos del equipo escolar.",
    icon: Clock3,
  },
  {
    title: "Preventa de fotos",
    description: "Las familias pueden comprar antes del día de la toma con un proceso claro.",
    icon: CalendarCheck2,
  },
  {
    title: "Acceso simple para las familias",
    description: "Cada familia accede mediante links directos desde celular o computadora.",
    icon: Smartphone,
  },
  {
    title: "Seguimiento de pedidos",
    description: "Cada pedido queda registrado para consultar estado y avance en todo momento.",
    icon: ClipboardList,
  },
  {
    title: "Experiencia profesional",
    description: "La institución ofrece una operatoria moderna, prolija y confiable.",
    icon: BadgeCheck,
  },
  {
    title: "Transparencia en las cuentas",
    description:
      "Escuela y fotógrafo trabajan con claridad en acuerdos y seguimiento de ventas.",
    icon: Eye,
  },
  {
    title: "Descarga gratuita de fotos para el colegio",
    description:
      "La institución puede acceder y descargar fotos sin costo para comunicación interna y difusión escolar.",
    icon: Download,
  },
];

const automationItems: FeatureItem[] = [
  {
    title: "Listados de alumnos organizados",
    description:
      "La información de los alumnos se carga una sola vez y se mantiene ordenada durante todo el proceso.",
    icon: Database,
  },
  {
    title: "Pedidos claros y sin errores",
    description:
      "Cada pedido queda registrado automáticamente, evitando errores, pérdidas de información y desorganización.",
    icon: ClipboardCheck,
  },
  {
    title: "Gestión simple para el fotógrafo",
    description:
      "El fotógrafo recibe los pedidos de forma estructurada, optimizando tiempos de trabajo y entrega.",
    icon: Settings2,
  },
];

const steps: Array<{ title: string; description: string; icon: LucideIcon }> = [
  {
    title: "Carga de alumnos",
    description: "Se carga el listado de alumnos para organizar la base inicial.",
    icon: Upload,
  },
  {
    title: "Publicación del álbum o preventa",
    description: "Se publica el álbum o preventa para que las familias accedan fácilmente.",
    icon: Images,
  },
  {
    title: "Compra de las familias",
    description: "Las familias acceden al link y realizan sus compras online de forma simple.",
    icon: ShoppingCart,
  },
];

function FeatureCard({ item }: { item: FeatureItem }) {
  const Icon = item.icon;
  return (
    <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#c27b3d]/15 text-[#9a5c2a]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-[#111827]">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">{item.description}</p>
    </article>
  );
}

function normalizeStudents(value: string): number | null {
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  const intParsed = Math.floor(parsed);
  return intParsed >= 0 ? intParsed : null;
}

function buildWhatsappUrl(form: FormState): string {
  const students = normalizeStudents(form.approxStudents);
  const text = `Hola Daniel, soy ${form.contactName.trim() || "contacto"} de ${
    form.schoolName.trim() || "una escuela"
  }. Completé la solicitud para conocer ComprameLaFoto para escuelas. Somos aproximadamente ${
    students != null ? students : "N/D"
  } alumnos en ${form.city.trim() || "N/D"}.`;
  return `https://web.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}`;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[#1f2937]">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#111827]/15 bg-white px-4 py-3 text-base text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/35"
      />
    </label>
  );
}

export default function SchoolLeadsLandingClient() {
  const searchParams = useSearchParams();
  const referralCode = useMemo(() => searchParams.get("ref")?.trim() || "", [searchParams]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/school-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: form.schoolName,
          city: form.city,
          contactName: form.contactName,
          contactRole: form.contactRole,
          email: form.email,
          whatsapp: form.whatsapp,
          approxStudents: normalizeStudents(form.approxStudents),
          message: form.message,
          referralCode: referralCode || null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; leadId?: number };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo enviar la solicitud.");
      }

      setSuccessMessage("Solicitud enviada. Te abrimos WhatsApp para continuar la conversación.");
      const whatsappUrl = buildWhatsappUrl(form);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="escuelas-leads-page clf-landing bg-white pb-24 text-[#111827]">
      <section className="relative overflow-hidden bg-[#f7f5f2] py-12 sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.18),transparent_60%)]" />
        <div className="clf-container relative grid w-full gap-8 lg:grid-cols-2 lg:items-center">
          <div className="w-full">
            <p className="inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
              ComprameLaFoto para escuelas
            </p>
            <h1 className="clf-hero-title mt-4 w-full text-3xl font-bold leading-tight sm:text-4xl">
              Organizá la fotografía escolar de forma profesional, simple y sin complicaciones.
            </h1>
            <p className="clf-hero-text mt-4 text-base text-[#4b5563] sm:text-lg">
              ComprameLaFoto permite a las instituciones educativas gestionar la fotografía escolar,
              centralizar pedidos y ofrecer a las familias una experiencia ordenada, clara y
              segura.
            </p>
            <p className="clf-text-tight mt-4 text-sm text-[#6b7280] sm:text-base">
              Diseñado para directivos que buscan mejorar la organización, reducir el trabajo
              administrativo y brindar un mejor servicio a las familias.
            </p>
            <a
              href="#formulario-solicitud"
              className="clf-btn clf-btn--whatsapp clf-btn--block mt-7"
            >
              Solicitar información
            </a>
            {referralCode ? (
              <p className="mt-4 rounded-lg border border-[#c27b3d]/25 bg-[#fffaf5] px-4 py-3 text-sm text-[#6b7280]">
                Llegaste con un link recomendado por fotógrafo ({referralCode}). Tu solicitud se
                registrará con ese dato.
              </p>
            ) : null}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_50px_-20px_rgba(17,24,39,0.35)]">
            <Image
              src="/images/landescolar/escuela-principal-2026.png"
              alt="Fotografía escolar en institución"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="clf-container">
          <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">
            Beneficios para directivos y equipos escolares
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((item) => (
              <FeatureCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f9fafb] py-14 sm:py-16">
        <div className="clf-container">
          <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">
            Un sistema pensado para automatizar y ordenar todo el proceso
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {automationItems.map((item) => (
              <FeatureCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="clf-container">
          <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">
            Cómo funciona
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <article key={step.title} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#c27b3d] px-2 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#c27b3d]/15 text-[#9a5c2a]">
                      <StepIcon className="h-5 w-5" />
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[#1f2937]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">{step.description}</p>
                </article>
              );
            })}
          </div>
          <p className="mt-5 w-full max-w-4xl text-base leading-relaxed text-[#4b5563]">
            La plataforma centraliza todo el proceso, evitando errores, pérdidas de información y
            desorganización.
          </p>
        </div>
      </section>

      <section className="bg-[#f9fafb] py-14 sm:py-16">
        <div className="clf-container">
          <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">
            Confianza para toda la institución
          </h2>
          <p className="mt-4 w-full max-w-4xl text-base leading-relaxed text-[#4b5563]">
            ComprameLaFoto es una plataforma pensada para trabajar en conjunto con fotógrafos
            profesionales, garantizando un proceso ordenado y transparente para todas las partes.
          </p>
          <ul className="mt-6 grid gap-2 text-sm font-medium text-[#1f2937] sm:grid-cols-2 sm:text-base">
            <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">Sistema probado</li>
            <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">Control de pedidos</li>
            <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">Trazabilidad de ventas</li>
            <li className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              Acompañamiento en la implementación
            </li>
          </ul>
          <p className="mt-5 w-full max-w-4xl rounded-xl border border-[#57b851]/20 bg-[#f0fdf4] px-4 py-3 text-sm leading-relaxed text-[#166534] sm:text-base">
            Cada paso del proceso queda registrado, permitiendo a la institución tener visibilidad
            y control sobre la operatoria.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-16">
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
                    Protección de datos personales de familias y alumnos.
                  </li>
                  <li className="rounded-lg border border-[#dbeafe] bg-white px-4 py-3">
                    Cumplimiento normativo y procesos alineados a buenas prácticas.
                  </li>
                  <li className="rounded-lg border border-[#dbeafe] bg-white px-4 py-3 sm:col-span-2">
                    Mayor confianza institucional al operar con trazabilidad y resguardo formal.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="clf-container">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#c27b3d]/15 text-[#9a5c2a]">
                <Handshake className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold leading-tight text-[#111827] sm:text-3xl">
                  Un modelo de trabajo transparente y colaborativo
                </h2>
                <p className="mt-3 w-full max-w-4xl text-base leading-relaxed text-[#4b5563]">
                  La plataforma permite que la institución y el fotógrafo trabajen de forma
                  coordinada, con procesos claros y ordenados.
                </p>
                <p className="mt-3 w-full max-w-4xl text-base leading-relaxed text-[#4b5563]">
                  En caso de acordarlo, la escuela puede participar de una comisión sobre las
                  ventas generadas, siempre definida entre la institución y el fotógrafo, y con
                  total claridad en el seguimiento de los resultados.
                </p>
                <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm text-[#6b7280]">
                  ComprameLaFoto no interviene en estos acuerdos, permitiendo que cada institución
                  y fotógrafo definan la modalidad que mejor se adapte a su forma de trabajo.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-3 py-1 text-xs text-[#4b5563]">
                    <FileText className="h-3.5 w-3.5" />
                    Acuerdos claros
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-3 py-1 text-xs text-[#4b5563]">
                    <ChartColumn className="h-3.5 w-3.5" />
                    Seguimiento de resultados
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="clf-section clf-section--dark">
        <div className="clf-container">
          <div className="clf-section-header clf-section-header--center">
            <h2 className="clf-section-title">Solicitá información para tu institución</h2>
            <p className="clf-section-description">
              Completá el formulario y te vamos a guiar paso a paso para implementar el sistema en
              tu escuela.
            </p>
          </div>
        </div>
      </section>

      <section id="formulario-solicitud" className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold text-[#111827] sm:text-3xl">
              Solicitar información para escuelas
            </h2>
            <p className="mt-3 w-full text-sm leading-relaxed text-[#6b7280] sm:text-base">
              Completá tus datos y te contactamos para mostrarte cómo implementar ComprameLaFoto en
              tu institución.
            </p>
            <p className="mt-2 w-full rounded-lg border border-[#57b851]/25 bg-[#f0fdf4] px-4 py-3 text-sm leading-relaxed text-[#166534]">
              Al completar este formulario, también se abrirá una conversación por WhatsApp para
              que podamos asesorarte de forma directa.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Nombre de la escuela"
                  value={form.schoolName}
                  onChange={(value) => setForm((prev) => ({ ...prev, schoolName: value }))}
                  placeholder="Ej: Colegio San Martín"
                  required
                />
                <InputField
                  label="Ciudad / Localidad"
                  value={form.city}
                  onChange={(value) => setForm((prev) => ({ ...prev, city: value }))}
                  placeholder="Ej: Rosario"
                  required
                />
                <InputField
                  label="Nombre del contacto"
                  value={form.contactName}
                  onChange={(value) => setForm((prev) => ({ ...prev, contactName: value }))}
                  placeholder="Ej: María Pérez"
                  required
                />
                <InputField
                  label="Cargo"
                  value={form.contactRole}
                  onChange={(value) => setForm((prev) => ({ ...prev, contactRole: value }))}
                  placeholder="Ej: Directora"
                />
                <InputField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                  placeholder="contacto@escuela.edu.ar"
                />
                <InputField
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(value) => setForm((prev) => ({ ...prev, whatsapp: value }))}
                  placeholder="Ej: 3411234567"
                  required
                />
              </div>

              <InputField
                label="Cantidad aproximada de alumnos"
                value={form.approxStudents}
                onChange={(value) => setForm((prev) => ({ ...prev, approxStudents: value }))}
                placeholder="Ej: 480"
                type="number"
              />

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[#1f2937]">Mensaje / Consulta</span>
                <Textarea
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  placeholder="Contanos brevemente qué necesitan."
                  rows={4}
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              {successMessage ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="clf-btn clf-btn--whatsapp clf-btn--block disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Enviando..." : "Enviar solicitud y hablar por WhatsApp"}
              </button>
            </form>
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
    </main>
  );
}
