"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegistroOrganizadorPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("El nombre es requerido");
    if (!email.trim()) return setError("El email es requerido");
    if (!password) return setError("La contraseña es requerida");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden");

    setLoading(true);
    try {
      const registerRes = await fetch("/api/auth/register-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          marketingOptIn: true,
        }),
      });
      const registerData = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) throw new Error(registerData?.error || "No se pudo crear la cuenta");

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!loginRes.ok) {
        router.push("/login?registered=true&redirect=%2Forganizador%2Fevents%2Fnew");
        return;
      }

      window.location.href = "/organizador/events/new";
    } catch (err: any) {
      setError(err?.message || "Error al registrarte");
      setLoading(false);
    }
  }

  return (
    <main className="clf-landing bg-white py-12 text-[#111827] sm:py-16">
      <section>
        <div className="clf-container">
          <div className="clf-form-shell">
            <div className="clf-form-card text-center">
              <p className="inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
                Módulo organizadores
              </p>
              <h1 className="clf-hero-title mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                Creá tu cuenta de organizador
              </h1>
              <p className="clf-hero-text mx-auto mt-4 text-base leading-relaxed text-[#4b5563] sm:text-lg">
                Completá tus datos y empezá a crear tu primer evento en ComprameLaFoto.
              </p>
            </div>

            <div className="clf-form-card mt-8 rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8">
              {error && (
                <div className="mb-5 rounded-lg border border-[#ef4444] bg-[#ef4444]/10 p-4 text-sm text-[#ef4444]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#111827]">Nombre</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                    disabled={loading}
                    className="clf-field"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#111827]">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    disabled={loading}
                    className="clf-field"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#111827]">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    disabled={loading}
                    className="clf-field"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#111827]">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetí tu contraseña"
                    required
                    disabled={loading}
                    className="clf-field"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="clf-btn clf-btn--primary clf-btn--block disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creando cuenta..." : "Registrarme y crear mi evento"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e5e7eb]" />
                <span className="text-xs uppercase tracking-wide text-[#9ca3af]">o</span>
                <div className="h-px flex-1 bg-[#e5e7eb]" />
              </div>

              <a
                href="/api/auth/google?role=ORGANIZER"
                className="clf-btn clf-btn--outline clf-btn--block"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.79-2.12-6.74-4.96H1.26v3.11A12 12 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.26 14.29A7.21 7.21 0 0 1 4.88 12c0-.79.13-1.56.38-2.29V6.6H1.26A12 12 0 0 0 0 12c0 1.93.46 3.76 1.26 5.4l4-3.11z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.76 0 3.33.61 4.57 1.81l3.43-3.43C17.95 1.25 15.24 0 12 0A12 12 0 0 0 1.26 6.6l4 3.11c.95-2.84 3.61-4.94 6.74-4.94z"
                  />
                </svg>
                Continuar con Google
              </a>

              <p className="mt-4 text-center text-xs text-[#6b7280]">
                Al registrarte aceptás la{" "}
                <Link href="/privacidad" className="text-[#9a5c2a] hover:underline">
                  Política de Privacidad
                </Link>
                .
              </p>

              <div className="mt-5 border-t border-[#e5e7eb] pt-4 text-center text-sm text-[#6b7280]">
                ¿Ya tenés cuenta?{" "}
                <Link
                  href="/login?redirect=%2Forganizador%2Fevents%2Fnew"
                  className="text-[#9a5c2a] hover:underline"
                >
                  Iniciar sesión
                </Link>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Link href="/organizador" className="text-sm text-[#6b7280] hover:text-[#111827]">
                ← Volver a la landing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
