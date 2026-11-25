"use client";

import "@repo/auth-ui/tokens.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DnxPasswordField } from "@repo/auth-ui";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import AccountPageShell from "@/components/layout/AccountPageShell";

type Estado = {
  email: string;
  requiresPassword: boolean;
  pendingEmail: string | null;
};

export default function CambiarEmailClient() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/cuenta/cambiar-email", { credentials: "include" }).catch(() => null);
      if (!active) return;
      if (!res || res.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent("/cuenta/cambiar-email")}`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.email) setEstado(data as Estado);
      else setError("No pudimos cargar tu cuenta. Recargá la página.");
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/cuenta/cambiar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo pedir el cambio de email.");
      setEnviadoA(data.pendingEmail);
      setEstado((prev) => (prev ? { ...prev, pendingEmail: data.pendingEmail } : prev));
      setNewEmail("");
      setCurrentPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo pedir el cambio de email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountPageShell>
      <header className="ds-content-container w-full">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">Cambiar email</h1>
        <p className="ds-readable-text text-sm leading-relaxed text-gray-600 md:text-base">
          Es el email con el que iniciás sesión y donde te llegan los avisos de ComprameLaFoto.
        </p>
      </header>

      <Card className="w-full space-y-6 p-6 md:p-8">
        {!estado && !error && <p className="text-center text-gray-600">Cargando…</p>}

        {estado && (
          <div className="w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4 text-sm text-[#1a1a1a]">
            Tu email actual: <strong>{estado.email}</strong>
          </div>
        )}

        {error && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {enviadoA ? (
          <div className="w-full rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <p className="m-0">
              Te mandamos un correo a <strong>{enviadoA}</strong>. Abrilo y tocá «Confirmar nuevo email» para
              terminar el cambio (vence en 24 horas).
            </p>
            <p className="mb-0 mt-2">
              Hasta que lo confirmes seguís entrando con tu email actual. Si no lo ves, revisá Spam o Promociones.
            </p>
          </div>
        ) : estado?.pendingEmail ? (
          <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Tenés un cambio pendiente a <strong>{estado.pendingEmail}</strong>: falta confirmarlo desde el correo que
            te mandamos. Si no te llegó, podés pedirlo de nuevo abajo.
          </div>
        ) : null}

        {estado && (
          <form onSubmit={handleSubmit} className="ds-form-stack w-full max-w-none">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-800" htmlFor="new-email">
              Nuevo email
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                placeholder="tunuevo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                disabled={loading}
              />
            </label>
            {estado.requiresPassword && (
              <DnxPasswordField
                id="current-password"
                name="currentPassword"
                label="Tu contraseña actual"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
                helperText="La pedimos para proteger tu cuenta."
              />
            )}
            <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={loading}>
              {loading ? "Enviando…" : "Enviar enlace de confirmación"}
            </Button>
          </form>
        )}

        <div className="flex w-full flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/cuenta/cambiar-contrasena" className="text-sm font-medium text-[#c27b3d] hover:underline">
            Cambiar contraseña
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:underline">
            Ir al inicio del sitio
          </Link>
        </div>
      </Card>
    </AccountPageShell>
  );
}
