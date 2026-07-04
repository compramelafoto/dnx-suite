"use client";

import Link from "next/link";

const accent = "#c27b3d";

export default function DemoUiPage() {
  return (
    <main className="min-h-screen bg-[#f7f5f2] text-[#1a1a1a]">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/watermark.png"
              alt="ComprameLaFoto"
              className="h-9 w-9 rounded-full ring-1 ring-black/10"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold">ComprameLaFoto</p>
              <p className="text-xs text-black/60">Demo UI 2026</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-black/70 md:flex">
            <a href="#features" className="hover:text-black">Funcionalidades</a>
            <a href="#steps" className="hover:text-black">Cómo funciona</a>
            <a href="#pricing" className="hover:text-black">Planes</a>
            <a href="#cta" className="hover:text-black">Empezar</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/70 hover:text-black"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ background: accent }}
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.15),transparent_45%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-black/60">
              Nuevo look 2026
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
            </span>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Vendé fotos e impresiones con una experiencia moderna, simple y confiable.
            </h1>
            <p className="text-base text-black/70 md:text-lg">
              ComprameLaFoto conecta fotógrafos, laboratorios y clientes con un flujo
              claro: álbumes, selección y pago. Todo con identidad visual consistente y
              soporte integrado.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#cta"
                className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#c27b3d]/20"
                style={{ background: accent }}
              >
                Probar demo
              </Link>
              <Link
                href="/fotografo/registro"
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black/80"
              >
                Soy fotógrafo
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-black/60">
              <div>
                <p className="text-lg font-semibold text-black">+3k</p>
                <p>Álbumes activos</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-black">98%</p>
                <p>Pagos exitosos</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-black">24/7</p>
                <p>Soporte interno</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Panel del fotógrafo</p>
                <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs text-black/60">
                  Demo
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-black/5 bg-[#f9fafb] p-4">
                  <p className="text-xs text-black/50">Álbum reciente</p>
                  <p className="text-base font-semibold">Casamiento · Abril 2026</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-black/60">
                    <span className="rounded-full bg-white px-2 py-1">48 fotos</span>
                    <span className="rounded-full bg-white px-2 py-1">AR$ 8.500</span>
                    <span className="rounded-full bg-white px-2 py-1">Activo</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["Subir fotos", "Recordatorios", "Precios", "Soporte"].map((label) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm font-medium text-black/70"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <p className="text-xs text-black/50">Estado de pagos</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-base font-semibold">Mercado Pago</p>
                    <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-xs text-[#166534]">
                      Conectado
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-2 hidden rounded-3xl border border-black/10 bg-white/90 p-4 text-xs text-black/70 shadow-xl md:block">
              Nuevo flujo agrupado de emails ✉️
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-black/50">Funcionalidades clave</p>
          <h2 className="text-3xl font-semibold">Diseño moderno, operaciones simples.</h2>
          <p className="text-black/60">
            Unificamos álbumes, ventas y soporte con una interfaz más limpia y una
            experiencia mobile‑first.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Álbumes inteligentes",
              desc: "Recordatorios y estados automáticos para que no pierdas ventas.",
            },
            {
              title: "Checkout confiable",
              desc: "Pagos con Mercado Pago y flujo optimizado para conversión.",
            },
            {
              title: "Soporte integrado",
              desc: "Tickets internos y comunicación directa con el admin.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5"
            >
              <div className="mb-4 h-10 w-10 rounded-2xl" style={{ background: `${accent}20` }} />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-black/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="rounded-3xl border border-black/10 bg-white p-8 md:p-10">
          <h3 className="text-2xl font-semibold">Cómo funciona</h3>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              "Creás el álbum y cargás fotos.",
              "Los clientes eligen y compran.",
              "Recibís el pago y entregás.",
            ].map((text, index) => (
              <div key={text} className="rounded-2xl border border-black/5 bg-[#f9fafb] p-4">
                <p className="text-xs text-black/50">Paso {index + 1}</p>
                <p className="mt-2 text-sm font-medium">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Starter", price: "Gratis", desc: "Ideal para probar el flujo." },
            { title: "Pro", price: "AR$ 19.900", desc: "Escalá ventas y automatizaciones." },
            { title: "Studio", price: "Custom", desc: "Para equipos y laboratorios." },
          ].map((plan) => (
            <div
              key={plan.title}
              className="rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5"
            >
              <p className="text-xs uppercase tracking-widest text-black/40">{plan.title}</p>
              <p className="mt-3 text-2xl font-semibold">{plan.price}</p>
              <p className="mt-2 text-sm text-black/60">{plan.desc}</p>
              <button
                className="mt-6 w-full rounded-full border border-black/10 bg-[#f9fafb] px-4 py-2 text-sm font-semibold text-black/70"
              >
                Ver detalles
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#111827] px-8 py-10 text-white md:flex-row md:items-center">
          <div>
            <p className="text-sm text-white/60">Listo para despegar</p>
            <h3 className="mt-2 text-2xl font-semibold">
              Probá el flujo completo con una estética actualizada.
            </h3>
          </div>
          <Link
            href="/registro"
            className="rounded-full px-5 py-3 text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            Empezar ahora
          </Link>
        </div>
      </section>

      <footer className="border-t border-black/5 py-8 text-center text-xs text-black/50">
        Demo UI 2026 · ComprameLaFoto
      </footer>
    </main>
  );
}
