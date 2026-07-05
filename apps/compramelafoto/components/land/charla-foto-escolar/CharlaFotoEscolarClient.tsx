"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";

type TalkData = {
  id: number;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  eventDate: string | null;
  eventTime: string | null;
  timezone: string;
  modality: string;
  calendarUrl: string | null;
  whatsappGroupUrl: string | null;
  heroImageUrl: string | null;
  primaryCtaText: string | null;
  secondaryCtaText: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  problemPointsJson: string[] | null;
  solutionPointsJson: string[] | null;
  agendaPointsJson: string[] | null;
  stepsJson: string[] | null;
  faqJson: Array<{ title: string; description: string }> | null;
  enableCalendarStep: boolean;
  enableWhatsappStep: boolean;
};

type CharlaFotoEscolarClientProps = {
  talkSlug: string;
  fallbackLinks: { calendarUrl: string; whatsappUrl: string };
};

function formatTalkDate(eventDate: string) {
  return new Date(eventDate).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const PROBLEM_POINTS = [
  "Listados desordenados que te hacen perder tiempo.",
  "Pedidos que se mezclan entre cursos y familias.",
  "Diseñar producto por producto sin automatización.",
  "Pagos y cobros manuales que se vuelven un lío.",
  "Entregas sin un flujo claro y profesional.",
];

const SOLUTION_POINTS = [
  "Ordenar todo el circuito escolar en una sola plataforma.",
  "Vender digitales e impresas sin perseguir pagos.",
  "Automatizar el armado de pedidos con menos esfuerzo.",
  "Tener información centralizada por alumno y familia.",
];

const CHARLA_POINTS = [
  "Cómo olvidarte de los listados manuales",
  "Cómo automatizar el armado de pedidos",
  "Cómo evitar diseñar producto por producto",
  "Cómo centralizar la información de cada alumno y familia",
  "Cómo vender fotos digitales e impresas sin manejar pagos manuales",
  "Cómo entregar las fotos de forma más ordenada",
  "Cómo profesionalizar el flujo de trabajo escolar",
];

const FAQS = [
  {
    title: "¿La charla es gratuita?",
    description: "Sí, es 100% gratuita. Solo necesitás registrarte para recibir el acceso.",
  },
  {
    title: "¿Es solo para fotógrafos escolares?",
    description: "Está pensada para quienes trabajan con escuelas, pero si hacés eventos similares también te va a servir.",
  },
  {
    title: "¿Necesito tener cuenta en ComprameLaFoto?",
    description: "No. Podés sumarte igual y después decidir si querés probar la plataforma.",
  },
  {
    title: "¿Cómo recibo el acceso?",
    description: "Después de registrarte te pedimos que agendes la charla y te sumes al grupo de WhatsApp.",
  },
  {
    title: "¿Qué pasa si no puedo estar justo a esa hora?",
    description: "Sumate igual: en el grupo compartimos recordatorios y cualquier info importante.",
  },
];

export default function CharlaFotoEscolarClient({
  talkSlug,
  fallbackLinks,
}: CharlaFotoEscolarClientProps) {
  const [formData, setFormData] = useState({ name: "", whatsapp: "", email: "" });
  const [errors, setErrors] = useState<{ name?: string; whatsapp?: string; email?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tracking, setTracking] = useState({ calendar: false, whatsapp: false });
  const [talk, setTalk] = useState<TalkData | null>(null);

  const isValidEmail = useMemo(() => {
    return formData.email.includes("@") && formData.email.includes(".");
  }, [formData.email]);

  useEffect(() => {
    fetch(`/api/public/talks/${talkSlug}`)
      .then((res) => res.json())
      .then((data) => setTalk(data?.talk || null))
      .catch(() => setTalk(null));
  }, [talkSlug]);

  function validate() {
    const next: typeof errors = {};
    if (formData.name.trim().length < 2) next.name = "Escribí tu nombre completo.";
    if (formData.whatsapp.trim().length < 6) next.whatsapp = "Sumá un WhatsApp válido.";
    if (!isValidEmail) next.email = "Revisá el email.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/charlafotoescolar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, slug: talkSlug, source: talkSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No pudimos registrar tus datos.");
      }
      setLeadId(Number(data?.id) || null);
      setSubmitted(true);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, form: err?.message || "Error enviando el formulario." }));
    } finally {
      setSubmitting(false);
    }
  }

  async function trackClick(action: "calendar" | "whatsapp") {
    if (!leadId) return;
    try {
      await fetch("/api/charlafotoescolar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, action }),
      });
    } catch {
      // noop
    }
  }

  function handleCalendarClick() {
    setTracking((prev) => ({ ...prev, calendar: true }));
    void trackClick("calendar");
    const url = talk?.calendarUrl || fallbackLinks.calendarUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleWhatsappClick() {
    setTracking((prev) => ({ ...prev, whatsapp: true }));
    void trackClick("whatsapp");
    const url = talk?.whatsappGroupUrl || fallbackLinks.whatsappUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#111827] dark:bg-[#0f1115] dark:text-[#f9fafb]">
      <main className="w-full">
        <section className="relative overflow-hidden bg-[#f7f5f2] dark:bg-[#12141a]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.22),transparent_55%)]" />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16 lg:py-20">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#fde8d1] px-4 py-2 text-xs font-semibold text-[#9a551d]">
                  {talk?.badgeText || "Charla gratuita"}
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                  {talk?.title || "Automatizá tu negocio de fotografía escolar"}
                </h1>
                <p className="text-base sm:text-lg text-[#4b5563] dark:text-[#d1d5db] leading-relaxed">
                  {talk?.subtitle ||
                    "Organizá pedidos, olvidate de los listados manuales y vendé de forma mucho más simple."}
                </p>
                <div className="flex flex-wrap gap-3 text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white border border-black/10 px-4 py-2 shadow-sm dark:bg-white/10 dark:border-white/10">
                    📅 {talk?.eventDate ? formatTalkDate(talk.eventDate) : "Domingo 19 de abril"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white border border-black/10 px-4 py-2 shadow-sm dark:bg-white/10 dark:border-white/10">
                    ⏰ {talk?.eventTime || "18 hs"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white border border-black/10 px-4 py-2 shadow-sm dark:bg-white/10 dark:border-white/10">
                    💻 {talk?.modality === "MEET" ? "Por Google Meet" : "Online"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a href="#registro" className="w-full sm:w-auto">
                    <Button variant="primary" className="w-full sm:w-auto text-base px-6 py-4 min-h-[52px]">
                      {talk?.primaryCtaText || "Reservar mi lugar"}
                    </Button>
                  </a>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto text-base px-6 py-4 min-h-[52px]"
                    onClick={handleWhatsappClick}
                  >
                    {talk?.secondaryCtaText || "Sumarme al grupo"}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -top-6 -right-6 h-16 w-16 rounded-2xl bg-[#c27b3d] opacity-20" />
                <div className="relative rounded-3xl border border-black/5 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.35)] overflow-hidden bg-white">
                  <Image
                    src={talk?.heroImageUrl || "/charla-foto-escolar-flyer.png"}
                    alt="Flyer de la charla sobre fotografía escolar"
                    width={920}
                    height={520}
                    className="w-full h-auto object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f7f5f2] py-12 sm:py-16 dark:bg-[#0f1115]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold mb-3">
                  Si ya trabajás con escuelas, sabés lo que implica.
                </h2>
                <p className="text-[#4b5563] text-base sm:text-lg dark:text-[#d1d5db]">
                  {talk?.shortDescription ||
                    "Listados, pedidos, diseños, entregas… Todo mezclado. Te muestro cómo resolverlo de una forma mucho más simple."}
                </p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-[#f8f6f2] p-5 text-sm sm:text-base text-[#1a1a1a] leading-relaxed">
                Seguramente te pasa esto: trabajás con varios cursos, necesitás ordenar la venta rápido y cada paso te come horas.
                Con ComprameLaFoto podés resolverlo en un flujo mucho más claro y profesional.
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(talk?.problemPointsJson || PROBLEM_POINTS).map((point) => (
                <div key={point} className="rounded-2xl border border-black/5 bg-[#f8f6f2] p-5 shadow-sm">
                  <p className="text-sm sm:text-base text-[#1a1a1a]">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-[#eef1f5] dark:bg-[#11141b]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-semibold">
                En la charla te muestro cómo ordenar todo con ComprameLaFoto.
              </h2>
              <p className="text-[#4b5563] text-base sm:text-lg dark:text-[#d1d5db]">
                {talk?.longDescription ||
                  "Un flujo más simple, ordenado y profesional para vender fotografía escolar sin caos."}
              </p>
            </div>
            <div className="grid gap-3">
              {(talk?.solutionPointsJson || SOLUTION_POINTS).map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm border border-black/5">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#c27b3d]/15 text-[#c27b3d] text-sm">
                    ✓
                  </span>
                  <p className="text-sm sm:text-base text-[#1a1a1a]">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-[#f7f5f2] dark:bg-[#0f1115]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-8">
              Qué vas a ver en la charla
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(talk?.agendaPointsJson || CHARLA_POINTS).map((point) => (
                <div key={point} className="rounded-2xl border border-black/5 bg-[#f8f6f2] p-5 shadow-sm">
                  <div className="text-[#c27b3d] text-lg mb-2">●</div>
                  <p className="text-sm sm:text-base text-[#1a1a1a]">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-[#eef1f5] dark:bg-[#11141b]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-8">Cómo participar</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {(talk?.stepsJson || [
                "Dejá tus datos",
                "Agendá la charla",
                "Sumate al grupo de WhatsApp",
              ]).map((title, index) => (
                <div key={title} className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-[#c27b3d] font-semibold">{`Paso ${index + 1}`}</p>
                  <p className="mt-2 text-sm sm:text-base font-medium text-[#1a1a1a]">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="registro" className="py-12 sm:py-16 bg-[#f7f5f2] dark:bg-[#0f1115]">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <div className="rounded-3xl border border-black/5 bg-[#f8f6f2] p-6 sm:p-10 shadow-sm">
              {!submitted ? (
                <>
                  <h2 className="text-2xl sm:text-3xl font-semibold mb-2">Reservá tu lugar</h2>
                  <p className="text-sm sm:text-base text-[#6b7280] mb-6">
                    Completá tus datos y te llevamos a agendar la charla.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-[#1a1a1a]">Nombre</label>
                        <input
                          type="text"
                          autoComplete="name"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30"
                          placeholder="Tu nombre y apellido"
                        />
                        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-[#1a1a1a]">WhatsApp</label>
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30"
                          placeholder="Ej: 11 2345 6789"
                        />
                        {errors.whatsapp && <p className="mt-1 text-xs text-red-600">{errors.whatsapp}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#1a1a1a]">Email</label>
                      <input
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30"
                        placeholder="tuemail@gmail.com"
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                    </div>
                    {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
                    <Button variant="primary" className="w-full py-4 text-base" disabled={submitting}>
                      {submitting ? "Enviando..." : "Continuar y agendar"}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-2xl sm:text-3xl font-semibold">Perfecto, ya reservaste tu lugar.</h2>
                  <p className="text-sm sm:text-base text-[#6b7280]">
                    Ahora agendá la charla y después sumate al grupo para recibir recordatorios.
                  </p>
                  {talk?.enableCalendarStep && (
                    <Button variant="primary" className="w-full py-4 text-base" onClick={handleCalendarClick}>
                      {tracking.calendar ? "Agendando..." : "Agendar en Google Calendar"}
                    </Button>
                  )}
                  {talk?.enableWhatsappStep && (
                    <Button variant="secondary" className="w-full py-4 text-base" onClick={handleWhatsappClick}>
                      {tracking.whatsapp ? "Abriendo..." : "Sumarme al grupo de WhatsApp"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-[#eef1f5] dark:bg-[#11141b]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-8">Preguntas frecuentes</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {(talk?.faqJson || FAQS).map((faq) => (
                <div key={faq.title} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-[#1a1a1a]">{faq.title}</h3>
                  <p className="mt-2 text-sm text-[#6b7280]">{faq.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-[#f7f5f2] dark:bg-[#0f1115]">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center space-y-4">
            <h3 className="text-2xl font-semibold">¿Ya querés probar la plataforma?</h3>
            <p className="text-sm text-[#4b5563] dark:text-[#d1d5db]">
              Creá tu cuenta y empezá a organizar tus ventas escolares con ComprameLaFoto.
            </p>
            <Link href="/registro">
              <Button variant="secondary" className="px-6 py-3">Creá tu cuenta</Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
