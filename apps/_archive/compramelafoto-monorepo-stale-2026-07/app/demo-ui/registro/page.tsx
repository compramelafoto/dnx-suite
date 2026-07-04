"use client";

import Link from "next/link";

const accent = "#c27b3d";

export default function DemoRegistroPage() {
  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#111827]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 rounded-[36px] border border-black/10 bg-white p-10 shadow-2xl shadow-black/10 md:grid-cols-2">
          {/* Left */}
          <div className="flex flex-col justify-between gap-10">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f9fafb] px-3 py-1 text-xs font-semibold text-black/60">
                Registro 2026
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              </span>
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                Creá tu cuenta y empezá a vender fotos hoy.
              </h1>
              <p className="text-sm text-black/60 md:text-base">
                Unificamos álbumes, pagos y soporte en un solo panel. Elegí tu rol y
                personalizá tu perfil.
              </p>
            </div>
            <div className="rounded-3xl border border-black/5 bg-[#111827] p-6 text-white">
              <p className="text-sm text-white/60">Lo que vas a poder hacer</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>• Crear álbumes y compartir links</li>
                <li>• Cobrar con Mercado Pago</li>
                <li>• Gestionar pedidos de impresión</li>
              </ul>
              <Link
                href="/demo-ui"
                className="mt-6 inline-flex items-center text-xs font-semibold text-white/70 hover:text-white"
              >
                ← Volver a la demo
              </Link>
            </div>
          </div>

          {/* Right */}
          <div className="rounded-3xl border border-black/5 bg-[#f9fafb] p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-black/40">Nueva cuenta</p>
                <h2 className="text-xl font-semibold">Registro</h2>
              </div>
              <img
                src="/watermark.png"
                alt="ComprameLaFoto"
                className="h-9 w-9 rounded-full ring-1 ring-black/10"
              />
            </div>

            <form className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-black/60">Nombre</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="text-xs text-black/60">Apellido</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-black/60">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="text-xs text-black/60">Contraseña</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="rounded-2xl border border-black/5 bg-white p-4">
                <p className="text-xs font-semibold text-black/70">Seleccioná tu rol</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {["Fotógrafo", "Laboratorio", "Cliente"].map((role) => (
                    <button
                      type="button"
                      key={role}
                      className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/70 hover:border-black/30"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-full px-4 py-3 text-sm font-semibold text-white"
                style={{ background: accent }}
              >
                Crear cuenta
              </button>

              <button
                type="button"
                className="w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/70"
              >
                Continuar con Google
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-black/50">
              ¿Ya tenés cuenta?{" "}
              <Link href="/login" className="text-[#c27b3d] hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
