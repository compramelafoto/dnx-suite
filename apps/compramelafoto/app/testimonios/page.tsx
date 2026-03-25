"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

interface Testimonial {
  id: number;
  name: string;
  message: string;
  instagram: string | null;
  createdAt: string;
}

const STATIC_TESTIMONIALS: Omit<Testimonial, "id" | "createdAt">[] = [
  {
    name: "Fotógrafo de eventos sociales",
    message:
      "Dejé de perseguir pagos por WhatsApp. Mis clientes entran, eligen y pagan solos. Me ahorra horas cada semana.",
    instagram: null,
  },
  {
    name: "Fotógrafa escolar",
    message:
      "Antes tenía carpetas en Drive, transferencias a mano y pedidos desordenados. Ahora todo está en un solo lugar y cobro automático.",
    instagram: null,
  },
  {
    name: "Fotógrafo deportivo",
    message:
      "Mis clientes entienden al toque. Entran por el link, ven sus fotos y compran. Se ve profesional y yo no tengo que explicar nada.",
    instagram: null,
  },
];

function normalizeInstagram(handle: string): string {
  const t = handle.trim().replace(/^@/, "");
  return t ? `https://instagram.com/${t}` : "";
}

export default function TestimoniosPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [form, setForm] = useState({ name: "", message: "", instagram: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const allTestimonials = [
    ...STATIC_TESTIMONIALS.map((t, i) => ({
      id: -i - 1,
      name: t.name,
      message: t.message,
      instagram: t.instagram,
      createdAt: "",
    })),
    ...testimonials,
  ];

  const loadTestimonials = useCallback(async () => {
    try {
      const res = await fetch("/api/public/testimonials");
      if (res.ok) {
        const data = await res.json();
        setTestimonials(data);
      }
    } catch {
      setTestimonials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  useEffect(() => {
    if (allTestimonials.length <= 1) return;
    const t = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % allTestimonials.length);
    }, 6000);
    return () => clearInterval(t);
  }, [allTestimonials.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const res = await fetch("/api/public/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          message: form.message.trim(),
          instagram: form.instagram.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setForm({ name: "", message: "", instagram: "" });
        setSubmitMessage({ type: "success", text: data.message || "¡Gracias! Tu testimonio se publicará pronto." });
        loadTestimonials();
      } else {
        setSubmitMessage({ type: "error", text: data.error || "Error al enviar. Intentá de nuevo." });
      }
    } catch {
      setSubmitMessage({ type: "error", text: "Error de conexión. Intentá de nuevo." });
    } finally {
      setSubmitting(false);
    }
  }

  const current = allTestimonials[currentIndex];

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <div className="container-custom max-w-4xl mx-auto py-12 md:py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-2">
            Testimonios
          </h1>
          <p className="text-[#6b7280]">
            Lo que dicen los fotógrafos que usan ComprameLaFoto
          </p>
        </div>

        {/* Slider de testimonios */}
        {allTestimonials.length > 0 && (
          <section className="mb-16">
            <div className="relative overflow-hidden rounded-2xl bg-white border border-black/6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-8 md:p-12 min-h-[220px]">
              {loading ? (
                <p className="text-[#6b7280] text-center py-8">Cargando testimonios...</p>
              ) : (
                <>
                  <div className="text-center">
                    <blockquote className="text-lg md:text-xl text-[#1a1a1a] italic leading-relaxed mb-6">
                      &ldquo;{current?.message}&rdquo;
                    </blockquote>
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-semibold text-[#1a1a1a]">— {current?.name}</p>
                      {current?.instagram && (
                        <a
                          href={normalizeInstagram(current.instagram)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[#c27b3d] hover:underline text-sm"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.067-.06-1.407-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm0 2.122v.075c0 2.65.012 2.987.06 4.043.049 1.064.218 1.791.465 2.427a4.902 4.902 0 001.153 1.772 4.902 4.902 0 001.772 1.153c.636.247 1.363.416 2.427.465 1.067.048 1.407.06 4.123.06h.08c2.643 0 2.987-.012 4.043-.06 1.064-.049 1.791-.218 2.427-.465a4.902 4.902 0 001.772-1.153 4.902 4.902 0 001.153-1.772c.247-.636.416-1.363.465-2.427.048-1.067.06-1.407.06-4.123v-.08c0-2.643-.012-2.987-.06-4.043-.049-1.064-.218-1.791-.465-2.427a4.902 4.902 0 00-1.153-1.772 4.902 4.902 0 00-1.772-1.153c-.636-.247-1.363-.416-2.427-.465-1.067-.048-1.407-.06-4.123-.06h-.08c-2.643 0-2.987.012-4.043.06-1.064.049-1.791.218-2.427.465a4.902 4.902 0 00-1.772 1.153 4.902 4.902 0 00-1.153 1.772c-.247.636-.416 1.363-.465 2.427-.048 1.067-.06 1.407-.06 4.123v.08z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M11.685 4.874c-3.105 0-5.623 2.52-5.623 5.623 0 3.105 2.52 5.623 5.623 5.623 3.105 0 5.623-2.52 5.623-5.623 0-3.105-2.52-5.623-5.623-5.623zM12 7.706c2.318 0 4.198 1.88 4.198 4.198 0 2.318-1.88 4.198-4.198 4.198-2.318 0-4.198-1.88-4.198-4.198 0-2.318 1.88-4.198 4.198-4.198z" clipRule="evenodd" />
                          </svg>
                          @{current.instagram.replace(/^@/, "")}
                        </a>
                      )}
                    </div>
                  </div>

                  {allTestimonials.length > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentIndex((i) =>
                            i === 0 ? allTestimonials.length - 1 : i - 1
                          )
                        }
                        className="p-2 rounded-full hover:bg-[#f3e6dc] text-[#c27b3d] transition-colors"
                        aria-label="Anterior"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-1">
                        {allTestimonials.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setCurrentIndex(i)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i === currentIndex ? "bg-[#c27b3d]" : "bg-[#e5e7eb] hover:bg-[#d1d5db]"
                            }`}
                            aria-label={`Ir al testimonio ${i + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentIndex((i) => (i + 1) % allTestimonials.length)
                        }
                        className="p-2 rounded-full hover:bg-[#f3e6dc] text-[#c27b3d] transition-colors"
                        aria-label="Siguiente"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Formulario para dejar testimonio */}
        <section className="rounded-2xl bg-white border border-black/6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6 md:p-8">
          <h2 className="text-xl font-semibold text-[#1a1a1a] mb-4">
            Dejá tu testimonio
          </h2>
          <p className="text-[#6b7280] text-sm mb-6">
            Contanos tu experiencia con ComprameLaFoto. Tu mensaje aparecerá en la galería de arriba y otros fotógrafos podrán contactarte por Instagram si tienen consultas.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#1a1a1a] mb-1">
                Nombre o empresa *
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Juan Pérez o Estudio Fotográfico XYZ"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e7eb] bg-white text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/40 focus:border-[#c27b3d]"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-[#1a1a1a] mb-1">
                Mensaje breve *
              </label>
              <textarea
                id="message"
                required
                rows={4}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Contanos en pocas palabras qué te gusta de la plataforma..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e7eb] bg-white text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/40 focus:border-[#c27b3d] resize-none"
              />
              <p className="text-xs text-[#9ca3af] mt-1">{form.message.length}/2000</p>
            </div>
            <div>
              <label htmlFor="instagram" className="block text-sm font-medium text-[#1a1a1a] mb-1">
                Instagram (opcional)
              </label>
              <input
                id="instagram"
                type="text"
                value={form.instagram}
                onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                placeholder="@tuusuario"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e7eb] bg-white text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/40 focus:border-[#c27b3d]"
              />
              <p className="text-xs text-[#9ca3af] mt-1">
                Para que otros fotógrafos puedan contactarte con consultas
              </p>
            </div>
            {submitMessage && (
              <p
                className={`text-sm ${
                  submitMessage.type === "success" ? "text-[#57b851]" : "text-[#ef4444]"
                }`}
              >
                {submitMessage.text}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar testimonio"}
            </Button>
          </form>
        </section>

        <div className="mt-8 text-center">
          <Link href="/land" className="text-[#c27b3d] hover:underline font-medium">
            ← Volver a la landing
          </Link>
        </div>
      </div>
    </div>
  );
}
