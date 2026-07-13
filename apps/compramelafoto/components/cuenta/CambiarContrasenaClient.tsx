"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AccountPageShell from "@/components/layout/AccountPageShell";

type PasswordStatus = {
  hasLocalPassword: boolean;
  linkedWithGoogle: boolean;
  canChangeLocalPassword: boolean;
  googleOnlyAccount: boolean;
};

type CambiarContrasenaClientProps = {
  /** Ruta para volver tras login redirect */
  loginRedirectPath?: string;
  /** Enlace «Volver a configuración» (panel fotógrafo) */
  backToConfigHref?: string;
};

export default function CambiarContrasenaClient({
  loginRedirectPath = "/cuenta/cambiar-contrasena",
  backToConfigHref = "/fotografo/configuracion?tab=datos",
}: CambiarContrasenaClientProps) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!meRes.ok) {
          router.replace(`/login?redirect=${encodeURIComponent(loginRedirectPath)}`);
          return;
        }
        const meData = await meRes.json().catch(() => ({}));
        if (!meData?.user) {
          router.replace(`/login?redirect=${encodeURIComponent(loginRedirectPath)}`);
          return;
        }

        const statusRes = await fetch("/api/cuenta/password-status", { credentials: "include" });
        const statusData = await statusRes.json().catch(() => ({}));
        if (!active) return;

        if (statusRes.ok) {
          setPasswordStatus(statusData as PasswordStatus);
        } else {
          setPasswordStatus({
            hasLocalPassword: true,
            linkedWithGoogle: false,
            canChangeLocalPassword: true,
            googleOnlyAccount: false,
          });
        }
        setAuthChecked(true);
      } catch {
        if (active) {
          router.replace(`/login?redirect=${encodeURIComponent(loginRedirectPath)}`);
        }
      } finally {
        if (active) setStatusLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [router, loginRedirectPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar la contraseña.");
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  const googleOnly = passwordStatus?.googleOnlyAccount === true;

  if (!authChecked) {
    return (
      <AccountPageShell>
        <Card className="w-full p-6">
          <p className="text-center text-gray-600">Verificando sesión…</p>
        </Card>
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell>
      <header className="ds-content-container w-full">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">Cambiar contraseña</h1>
        <p className="ds-readable-text text-sm leading-relaxed text-gray-600 md:text-base">
          Gestioná el acceso a tu cuenta de ComprameLaFoto.
        </p>
      </header>

      <Card className="w-full space-y-6 p-6 md:p-8">
        {error && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="w-full rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              Contraseña actualizada correctamente. Recibirás un email de confirmación.
            </p>
          </div>
        )}

        {statusLoading && (
          <p className="text-center text-sm text-gray-600">Verificando tipo de cuenta…</p>
        )}

        {!statusLoading && googleOnly && (
          <div className="ds-form-stack w-full">
            <div className="w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4">
              <p className="m-0 text-sm text-[#1a1a1a]">
                Tu cuenta está vinculada con Google. Para cambiar la contraseña, tenés que hacerlo desde tu
                cuenta de Google.
              </p>
              {passwordStatus?.linkedWithGoogle && (
                <p className="mb-0 mt-2 text-xs text-[#6b7280]">
                  En ComprameLaFoto no hay una contraseña local guardada para este usuario.
                </p>
              )}
            </div>
            <a
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#c27b3d] hover:underline"
            >
              Abrir seguridad de Google →
            </a>
          </div>
        )}

        {!statusLoading && !googleOnly && !success && (
          <form onSubmit={handleSubmit} className="ds-form-stack w-full max-w-none">
            {passwordStatus?.linkedWithGoogle && passwordStatus?.hasLocalPassword && (
              <p className="m-0 text-xs text-[#6b7280]">
                Tu cuenta también está vinculada con Google; la contraseña de ComprameLaFoto es independiente.
              </p>
            )}
            <div className="w-full">
              <label htmlFor="current-password" className="mb-2 block text-sm font-medium text-gray-700">
                Contraseña actual
              </label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña actual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="w-full">
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-700">
                Nueva contraseña
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="w-full">
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-700">
                Confirmar nueva contraseña
              </label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repetí la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={loading}>
              {loading ? "Guardando…" : "Cambiar contraseña"}
            </Button>
          </form>
        )}

        <div className="flex w-full flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href={backToConfigHref} className="text-sm font-medium text-[#c27b3d] hover:underline">
            ← Volver a Configuración
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:underline">
            Ir al inicio del sitio
          </Link>
        </div>
      </Card>
    </AccountPageShell>
  );
}
