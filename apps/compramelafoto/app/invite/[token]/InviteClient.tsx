"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type InvitationData = {
  id: string;
  invitedEmail: string;
  status: string;
  expiresAt: Date;
  albumId: number;
  album: { id: number; title: string; publicSlug: string | null } | null;
};

type UserData = {
  id: number;
  email: string;
  emailVerifiedAt: Date | string | null;
} | null;

export default function InviteClient({
  token,
  invitation,
  user,
  hasAccess,
}: {
  token: string;
  invitation: InvitationData | null;
  user: UserData;
  hasAccess: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const redirectUrl = useMemo(() => `/invite/${token}`, [token]);
  const albumUrl = invitation?.album?.publicSlug
    ? `/a/${invitation.album.publicSlug}`
    : invitation?.album?.id
      ? `/a/${invitation.album.id}`
      : "/";

  const isLoggedIn = Boolean(user?.id);
  const isVerified = Boolean(user?.emailVerifiedAt);
  const emailMismatch =
    Boolean(user?.email && invitation?.invitedEmail) &&
    user?.email.toLowerCase() !== invitation?.invitedEmail.toLowerCase();

  async function handleAccept() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "EMAIL_NOT_VERIFIED") {
          setError("Necesitás verificar tu email para aceptar la invitación.");
        } else {
          setError(data?.error || "No se pudo aceptar la invitación");
        }
        return;
      }
      setSuccess(true);
      router.push(albumUrl);
    } catch (err: any) {
      setError(err?.message || "Error aceptando invitación");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/resend-verification", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo reenviar la verificación");
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo reenviar la verificación");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = (() => {
    if (!invitation) return "Invitación inválida";
    if (invitation.status === "ACCEPTED") return "Invitación aceptada";
    if (invitation.status === "REVOKED") return "Invitación revocada";
    if (invitation.status === "EXPIRED") return "Invitación expirada";
    return "Invitación pendiente";
  })();

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-[min(45rem,50%)] mx-auto space-y-6 px-4 sm:px-0">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[#1a1a1a]">Invitación al álbum</h1>
            <p className="text-sm text-[#6b7280]">{statusLabel}</p>
          </div>

          <Card className="space-y-4 p-6 min-w-0">
            {!invitation && (
              <p className="text-sm text-[#6b7280]">
                Este enlace no es válido o ya expiró. Pedile al fotógrafo una nueva invitación.
              </p>
            )}

            {invitation && (
              <>
                <div>
                  <p className="text-xs text-[#6b7280]">Álbum</p>
                  <p className="text-sm text-[#111827] font-medium">{invitation.album?.title || "Álbum"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#6b7280]">Invitado</p>
                  <p className="text-sm text-[#111827] break-words">{invitation.invitedEmail}</p>
                </div>
              </>
            )}

            {error && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-3">
                <p className="text-[#ef4444] text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">Listo. Podés acceder al álbum.</p>
              </div>
            )}

            {invitation?.status === "PENDING" && (
              <>
                {!isLoggedIn && (
                  <div className="flex flex-col gap-2">
                    <Button variant="primary" onClick={() => router.push(`/registro?redirect=${encodeURIComponent(redirectUrl)}`)}>
                      Crear cuenta
                    </Button>
                    <Button variant="secondary" onClick={() => router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`)}>
                      Iniciar sesión
                    </Button>
                  </div>
                )}

                {isLoggedIn && !isVerified && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#6b7280]">
                      Verificá tu email para aceptar la invitación.
                    </p>
                    <Button variant="primary" onClick={handleResendVerification} disabled={loading}>
                      {loading ? "Enviando..." : "Reenviar verificación"}
                    </Button>
                  </div>
                )}

                {isLoggedIn && isVerified && (
                  <>
                    {emailMismatch && !hasAccess ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-amber-700 text-sm">
                          Esta invitación es para otro email. Iniciá sesión con el email invitado.
                        </p>
                      </div>
                    ) : (
                      <Button variant="primary" onClick={handleAccept} disabled={loading}>
                        {loading ? "Aceptando..." : "Aceptar invitación"}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}

            {invitation?.status === "ACCEPTED" && (
              <Button variant="primary" onClick={() => router.push(albumUrl)}>
                Ir al álbum
              </Button>
            )}

            {invitation?.status === "PENDING" && hasAccess && (
              <Button variant="primary" onClick={() => router.push(albumUrl)}>
                Ir al álbum
              </Button>
            )}
          </Card>

          <div className="text-center">
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
