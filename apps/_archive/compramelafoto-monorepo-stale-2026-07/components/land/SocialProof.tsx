"use client";

import { useState, useEffect } from "react";

const STATIC_TESTIMONIALS = [
  {
    quote:
      "Dejé de perseguir pagos por WhatsApp. Mis clientes entran, eligen y pagan solos. Me ahorra horas cada semana.",
    role: "Fotógrafo de eventos sociales",
  },
  {
    quote:
      "Antes tenía carpetas en Drive, transferencias a mano y pedidos desordenados. Ahora todo está en un solo lugar y cobro automático.",
    role: "Fotógrafa escolar",
  },
  {
    quote:
      "Mis clientes entienden al toque. Entran por el link, ven sus fotos y compran. Se ve profesional y yo no tengo que explicar nada.",
    role: "Fotógrafo deportivo",
  },
];

interface LandingStats {
  daysActive: number;
  totalUsers: number;
  totalPhotos: number;
  totalAmountSold: number;
}

function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const SLIDE_DURATION_MS = 8000; // Tiempo de lectura por testimonio
const STATS_POLL_INTERVAL_MS = 15_000; // Actualizar stats cada 15 segundos

function fetchStats(): Promise<LandingStats | null> {
  return fetch(`/api/public/landing-stats?_=${Date.now()}`, {
    cache: "no-store",
    mode: "cors",
    headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data || typeof data.daysActive !== "number") return null;
      return {
        daysActive: data.daysActive ?? 0,
        totalUsers: data.totalUsers ?? 0,
        totalPhotos: data.totalPhotos ?? 0,
        totalAmountSold: data.totalAmountSold ?? 0,
      };
    })
    .catch(() => null);
}

export default function SocialProof() {
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [approvedTestimonials, setApprovedTestimonials] = useState<
    Array<{ message: string; name: string }>
  >([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const refreshStats = () => fetchStats().then((data) => data && setStats(data));

  // Carga inicial + polling + refetch al volver a la pestaña
  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, STATS_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshStats);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshStats);
    };
  }, []);

  useEffect(() => {
    fetch("/api/public/testimonials")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setApprovedTestimonials(
            data.map((t: { message: string; name: string }) => ({
              message: t.message,
              name: t.name,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const testimonialsToShow =
    approvedTestimonials.length > 0
      ? approvedTestimonials.map((t) => ({ quote: t.message, role: t.name }))
      : STATIC_TESTIMONIALS;

  useEffect(() => {
    if (testimonialsToShow.length <= 1) return;
    const t = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % testimonialsToShow.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(t);
  }, [testimonialsToShow.length]);

  const statCards = stats
    ? [
        { value: stats.daysActive.toLocaleString("es-AR"), label: "Días de plataforma activa" },
        { value: stats.totalUsers.toLocaleString("es-AR"), label: "Usuarios registrados" },
        { value: stats.totalPhotos.toLocaleString("es-AR"), label: "Fotos subidas" },
        { value: formatARS(stats.totalAmountSold), label: "Vendido en la plataforma" },
      ]
    : null;

  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-10 md:text-3xl">
          Fotógrafos que ya venden con ComprameLaFoto
        </h2>
        {statCards && (
          <div className="space-y-4 mb-10">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={refreshStats}
                className="text-xs text-[#6b7280] hover:text-[#c27b3d] transition-colors underline-offset-2 hover:underline"
              >
                Actualizar números
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {statCards.map((card, i) => (
              <div
                key={i}
                className="text-center p-6 rounded-2xl bg-white border border-black/6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow duration-200"
              >
                <p className="text-2xl md:text-3xl font-bold text-[#c27b3d]">
                  {card.value}
                </p>
                <p className="text-sm text-[#6b7280] mt-1">{card.label}</p>
              </div>
            ))}
            </div>
          </div>
        )}
        <div className="relative overflow-hidden min-h-[220px]">
          {testimonialsToShow.map((t, i) => (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <div className="p-6 md:p-12 rounded-2xl bg-white border border-black/6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] w-full max-w-4xl mx-auto text-center">
                <p className="text-[#1a1a1a] italic text-base md:text-xl leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="text-sm text-[#6b7280] mt-4">— {t.role}</p>
              </div>
            </div>
          ))}
          {testimonialsToShow.length > 1 && (
            <div className="flex justify-center gap-2 mt-6 relative z-20">
              {testimonialsToShow.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentSlide ? "bg-[#c27b3d]" : "bg-[#e5e7eb] hover:bg-[#d1d5db]"
                  }`}
                  aria-label={`Ir al testimonio ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
