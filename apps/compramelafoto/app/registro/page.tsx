"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { LAB_TERMS_TEXT } from "@/lib/terms/labTerms";
import {
  getReferralCookie,
  deleteReferralCookie,
  getRefForRegistration,
} from "@/lib/referral-cookie";

type UserType = "" | "PHOTOGRAPHER" | "CUSTOMER" | "LAB" | "ORGANIZER";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const marketingOptIn = true; // Siempre activo (novedades y promociones)
  const [showTerms, setShowTerms] = useState(false);
  const [showGoogleTypeModal, setShowGoogleTypeModal] = useState(false);
  const [googleModalType, setGoogleModalType] = useState<UserType>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const redirectParam = searchParams?.get("redirect") || "";
  const safeRedirect = redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "";
  const redirectQuery = safeRedirect ? `&redirect=${encodeURIComponent(safeRedirect)}` : "";
  const refFromQuery = searchParams?.get("ref") ?? null;
  const [refFromCookie, setRefFromCookie] = useState<string | null>(null);

  // Ref final: query tiene prioridad (last-click-wins); si no hay query, usar cookie.
  const refFinal = getRefForRegistration(refFromQuery, refFromCookie);

  useEffect(() => {
    setRefFromCookie(getReferralCookie());
  }, []);

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showTerms) {
          setShowTerms(false);
        }
        if (showGoogleTypeModal) {
          setShowGoogleTypeModal(false);
        }
      }
    }
    if (showTerms || showGoogleTypeModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showTerms, showGoogleTypeModal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userType) {
      setError("Seleccioná el tipo de cuenta");
      return;
    }

    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }

    if (!email.trim()) {
      setError("El email es requerido");
      return;
    }

    if (!password.trim()) {
      setError("La contraseña es requerida");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    // Si es LAB, verificar que aceptó términos
    if (userType === "LAB" && !termsAccepted) {
      setError("Debes aceptar los Términos y Condiciones para registrarte como laboratorio");
      return;
    }

    setLoading(true);

    try {
      let endpoint = "/api/auth/register";
      let redirectPath = `/cliente/login?registered=true${redirectQuery}`;

      // Determinar endpoint y redirección según el tipo de usuario
      if (userType === "PHOTOGRAPHER") {
        endpoint = "/api/auth/register-photographer";
        redirectPath = `/fotografo/login?registered=true${redirectQuery}`;
      } else if (userType === "LAB") {
        endpoint = "/api/auth/register-lab";
        redirectPath = `/lab/login?registered=true${redirectQuery}`;
      } else if (userType === "ORGANIZER") {
        endpoint = "/api/auth/register-organizer";
        redirectPath = `/login?registered=true${redirectQuery}`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          marketingOptIn,
          ...(userType === "PHOTOGRAPHER" && refFinal ? { ref: refFinal } : {}),
          ...(userType === "LAB" && {
            phone: "",
            address: "",
            city: "",
            province: "",
            country: "Argentina",
            termsAccepted: true, // Ya validamos que está aceptado
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error al crear cuenta");
      }

      // Borrar cookie de referido tras registro exitoso (solo preserva el click; la atribución la valida el backend).
      deleteReferralCookie();

      // Si es laboratorio y está pendiente de aprobación, mostrar mensaje especial
      if (userType === "LAB" && data.pendingApproval) {
        redirectPath = `/lab/login?registered=pending${redirectQuery}`;
      }

      // Redirigir al login correspondiente
      router.push(redirectPath);
    } catch (err: any) {
      setError(err?.message || "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleRegister() {
    if (!userType) {
      setShowGoogleTypeModal(true);
      return;
    }
    if (userType === "LAB" && !termsAccepted) {
      setError("Debes aceptar los Términos y Condiciones para registrarte como laboratorio");
      return;
    }
    window.location.href = `/api/auth/google?role=${userType}`;
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              padding: "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(24px, 5vw, 36px)",
                fontWeight: "normal",
                color: "#1a1a1a",
                lineHeight: "1.3",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Crear cuenta
            </h1>
            <p
              style={{
                fontSize: "clamp(16px, 2.5vw, 18px)",
                color: "#6b7280",
                lineHeight: "1.5",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Completá tus datos y elegí el tipo de cuenta que querés crear
            </p>
          </div>

          <Card className="space-y-6">
            {error && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-4">
                <p className="text-[#ef4444] text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Nombre {userType === "LAB" ? "del laboratorio" : ""}
                </label>
                <Input
                  type="text"
                  placeholder={userType === "LAB" ? "Nombre del laboratorio" : "Tu nombre"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.58 10.58a2 2 0 002.83 2.83"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.1 6.1C4.1 7.4 2.6 9.2 2 12c1.6 5 6.1 8 10 8 1.6 0 3.2-.4 4.7-1.2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9.9 4.3C10.6 4.1 11.3 4 12 4c3.9 0 8.4 3 10 8-.4 1.3-1 2.5-1.8 3.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12 18 19.5 12 19.5 1.5 12 1.5 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#6b7280] mt-1">
                  Mínimo 6 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showConfirmPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.58 10.58a2 2 0 002.83 2.83"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.1 6.1C4.1 7.4 2.6 9.2 2 12c1.6 5 6.1 8 10 8 1.6 0 3.2-.4 4.7-1.2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9.9 4.3C10.6 4.1 11.3 4 12 4c3.9 0 8.4 3 10 8-.4 1.3-1 2.5-1.8 3.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12 18 19.5 12 19.5 1.5 12 1.5 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Tipo de cuenta
                </label>
                <Select
                  value={userType}
                  onChange={(e) => {
                    setUserType(e.target.value as UserType);
                    // Resetear términos cuando cambia el tipo
                    if (e.target.value !== "LAB") {
                      setTermsAccepted(false);
                    }
                  }}
                  disabled={loading}
                >
                  <option value="" disabled>Seleccioná una opción</option>
                  <option value="CUSTOMER">👤 Cliente</option>
                  <option value="PHOTOGRAPHER">📷 Fotógrafo</option>
                  <option value="ORGANIZER">📋 Organizador</option>
                  <option value="LAB">🏭 Laboratorio</option>
                </Select>
                {userType === "LAB" && (
                  <p className="text-xs text-[#6b7280] mt-1">
                    Los laboratorios requieren aprobación del administrador antes de poder acceder.
                  </p>
                )}
              </div>

              {/* Checkbox de Términos y Condiciones solo para LAB */}
              {userType === "LAB" && (
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      disabled={loading}
                      className="mt-1 w-4 h-4 text-[#3b82f6] border-[#d1d5db] rounded focus:ring-[#3b82f6]"
                      required
                    />
                    <span className="text-sm text-[#1a1a1a]">
                      Acepto los{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowTerms(true);
                        }}
                        className="text-[#3b82f6] hover:underline"
                      >
                        Términos y Condiciones
                      </button>{" "}
                      (obligatorio)
                    </span>
                  </label>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading || (userType === "LAB" && !termsAccepted)}
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e7eb]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#6b7280]">O</span>
              </div>
            </div>

              <Button
              type="button"
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleRegister}
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </Button>

            <p className="text-xs text-[#6b7280] text-center">
              Al registrarte aceptás nuestra{" "}
              <Link href="/privacidad" className="text-[#c27b3d] hover:underline" target="_blank">
                Política de Privacidad
              </Link>
              .
            </p>
            <div className="text-center pt-4 border-t border-[#e5e7eb]">
              <p className="text-sm text-[#6b7280]">
                ¿Ya tenés cuenta?{" "}
                <Link href="/login" className="text-[#c27b3d] hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </Card>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>

      {/* Modal de Términos y Condiciones para LAB */}
      {showTerms && userType === "LAB" && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTerms(false);
            }
          }}
        >
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-6 border-b border-[#e5e7eb] flex items-center justify-between bg-white sticky top-0 z-10">
              <h2 className="text-xl font-semibold text-[#1a1a1a]">Términos y Condiciones - Laboratorios</h2>
              <button
                onClick={() => setShowTerms(false)}
                className="text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <div className="prose prose-sm max-w-none">
                <div 
                  className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {LAB_TERMS_TEXT}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#e5e7eb] flex items-center justify-end gap-3 bg-white sticky bottom-0 z-10">
              <Button
                variant="secondary"
                onClick={() => setShowTerms(false)}
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setTermsAccepted(true);
                  setShowTerms(false);
                }}
              >
                Aceptar términos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: elegir tipo de cuenta y continuar con Google */}
      {showGoogleTypeModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGoogleTypeModal(false);
              setGoogleModalType("");
            }
          }}
        >
          <div className="bg-white rounded-lg w-[90vw] max-w-xl min-w-[min(90vw,320px)] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[#e5e7eb] flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[#1a1a1a]">Seleccioná tu tipo de cuenta</h2>
              <button
                onClick={() => {
                  setShowGoogleTypeModal(false);
                  setGoogleModalType("");
                }}
                className="text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[#1a1a1a]">
                Antes de continuar con Google, elegí si tu cuenta será de <strong>Cliente</strong>, <strong>Fotógrafo</strong>, <strong>Organizador</strong> o <strong>Laboratorio</strong>.
              </p>
              <div>
                <label htmlFor="google-modal-type" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Tipo de cuenta
                </label>
                <Select
                  id="google-modal-type"
                  value={googleModalType}
                  onChange={(e) => setGoogleModalType((e.target.value || "") as UserType)}
                  className="w-full"
                >
                  <option value="">Elegí una opción</option>
                  <option value="CUSTOMER">Cliente</option>
                  <option value="PHOTOGRAPHER">Fotógrafo</option>
                  <option value="ORGANIZER">Organizador</option>
                  <option value="LAB">Laboratorio</option>
                </Select>
              </div>
              <p className="text-sm text-[#6b7280]">
                Esto define tu panel de acceso y permisos.
              </p>
            </div>
            <div className="p-5 border-t border-[#e5e7eb] flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowGoogleTypeModal(false);
                  setGoogleModalType("");
                }}
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!googleModalType) return;
                  setUserType(googleModalType);
                  setShowGoogleTypeModal(false);
                  setGoogleModalType("");
                  window.location.href = `/api/auth/google?role=${googleModalType}`;
                }}
                disabled={!googleModalType}
              >
                Continuar con Google
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-600">Cargando registro...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
