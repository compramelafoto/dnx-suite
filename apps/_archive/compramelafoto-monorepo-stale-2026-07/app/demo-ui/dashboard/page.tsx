"use client";

import Link from "next/link";

const accent = "#c27b3d";

const kpis = [
  { label: "Ventas del mes", value: "AR$ 1.240.000", delta: "+18%" },
  { label: "Álbumes activos", value: "42", delta: "+6%" },
  { label: "Pedidos de impresión", value: "128", delta: "+9%" },
  { label: "Clientes nuevos", value: "73", delta: "+12%" },
];

const albums = [
  { name: "Casamiento · Abril", status: "Activo", photos: 186, sales: "AR$ 320.000" },
  { name: "Egresados · 5to B", status: "En carga", photos: 72, sales: "AR$ 84.000" },
  { name: "Book · Martina", status: "Borrador", photos: 0, sales: "AR$ 0" },
];

const tickets = [
  { title: "No puedo subir fotos", status: "En progreso", time: "hace 2h" },
  { title: "Pago pendiente MP", status: "Nuevo", time: "hace 5h" },
  { title: "Consulta sobre precios", status: "Resuelto", time: "ayer" },
];

const activity = [
  "Se conectó Mercado Pago.",
  "Se creó el álbum “Casamiento · Abril”.",
  "Se enviaron 8 recordatorios de álbum.",
  "Se aprobó un pedido de impresión.",
];

export default function DemoDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#111827]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 flex-col border-r border-black/5 bg-white/80 px-6 py-6 lg:flex">
          <div className="flex items-center gap-3">
            <img
              src="/watermark.png"
              alt="ComprameLaFoto"
              className="h-9 w-9 rounded-full ring-1 ring-black/10"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold">ComprameLaFoto</p>
              <p className="text-xs text-black/60">Dashboard demo</p>
            </div>
          </div>
          <nav className="mt-10 space-y-2 text-sm text-black/70">
            {[
              "Resumen",
              "Álbumes",
              "Pedidos",
              "Clientes",
              "Productos",
              "Soporte",
              "Configuración",
            ].map((item) => (
              <button
                key={item}
                className="flex w-full items-center justify-between rounded-xl px-4 py-2 text-left hover:bg-[#f3f4f6]"
              >
                <span>{item}</span>
                {item === "Soporte" && (
                  <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs text-[#991b1b]">
                    3
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-black/5 bg-[#111827] p-4 text-white">
            <p className="text-xs text-white/60">Plan actual</p>
            <p className="mt-1 text-base font-semibold">Pro Studio</p>
            <button
              className="mt-3 w-full rounded-full px-3 py-2 text-xs font-semibold text-white"
              style={{ background: accent }}
            >
              Administrar plan
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-black/40">Dashboard</p>
                <h1 className="text-2xl font-semibold">Resumen general</h1>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-full border border-black/10 px-4 py-2 text-sm text-black/70">
                  Exportar
                </button>
                <Link
                  href="/dashboard/albums"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: accent }}
                >
                  Nuevo álbum
                </Link>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-6 py-8">
            {/* KPI */}
            <section className="grid gap-4 md:grid-cols-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-3xl border border-black/10 bg-white p-5 shadow-lg shadow-black/5"
                >
                  <p className="text-xs text-black/50">{kpi.label}</p>
                  <p className="mt-2 text-lg font-semibold">{kpi.value}</p>
                  <p className="mt-1 text-xs text-[#16a34a]">{kpi.delta} vs mes anterior</p>
                </div>
              ))}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              {/* Albums */}
              <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Álbumes recientes</h2>
                  <button className="text-sm text-black/60 hover:text-black">Ver todos</button>
                </div>
                <div className="mt-4 space-y-4">
                  {albums.map((album) => (
                    <div
                      key={album.name}
                      className="flex items-center justify-between rounded-2xl border border-black/5 bg-[#f9fafb] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{album.name}</p>
                        <p className="text-xs text-black/50">
                          {album.photos} fotos · {album.sales}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-black/60">
                        {album.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Support */}
              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5">
                <h2 className="text-lg font-semibold">Soporte técnico</h2>
                <div className="mt-4 space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.title}
                      className="rounded-2xl border border-black/5 bg-[#f9fafb] px-4 py-3"
                    >
                      <p className="text-sm font-medium">{ticket.title}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-black/50">
                        <span>{ticket.status}</span>
                        <span>{ticket.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: accent }}
                >
                  Ver tickets
                </button>
              </div>
            </section>

            <section className="mt-8 grid gap-6 md:grid-cols-2">
              {/* Activity */}
              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5">
                <h2 className="text-lg font-semibold">Actividad reciente</h2>
                <ul className="mt-4 space-y-3 text-sm text-black/70">
                  {activity.map((item) => (
                    <li key={item} className="rounded-2xl border border-black/5 bg-[#f9fafb] px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Insights */}
              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5">
                <h2 className="text-lg font-semibold">Insights</h2>
                <div className="mt-4 space-y-4 text-sm text-black/70">
                  <div className="rounded-2xl border border-black/5 bg-[#f9fafb] px-4 py-3">
                    <p className="text-xs text-black/50">Conversión</p>
                    <p className="text-base font-semibold">42% en álbumes activos</p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[#f9fafb] px-4 py-3">
                    <p className="text-xs text-black/50">Tiempo de compra</p>
                    <p className="text-base font-semibold">Promedio 3,2 días</p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[#f9fafb] px-4 py-3">
                    <p className="text-xs text-black/50">Top álbum</p>
                    <p className="text-base font-semibold">Casamiento · Abril</p>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
