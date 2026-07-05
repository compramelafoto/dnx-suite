"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

type InvitationResponse = {
  invitation?: {
    id: string;
    email: string;
    name: string | null;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
    valid: boolean;
    expiresAt: string;
    school: { id: number; name: string };
  };
  error?: string;
};

export default function ActivateSchoolOrganizerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationResponse["invitation"] | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token inválido o ausente.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/school-organizer/invitations/${encodeURIComponent(token)}`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );
        const data = (await res.json().catch(() => ({}))) as InvitationResponse;
        if (!res.ok) {
          throw new Error(data?.error || "No se pudo validar la invitación.");
        }
        if (!data.invitation) {
          throw new Error("Invitación inválida.");
        }
        setInvitation(data.invitation);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No se pudo validar la invitación.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [token]);

  async function handleAccept() {
    if (!token || !invitation) return;
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/school-organizer/invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo activar la cuenta.");
      }
      setSaved(true);
      window.setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <Card className="space-y-4 p-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Activar cuenta de escuela</h1>
          <p className="text-sm text-gray-600">
            Completá este paso para ingresar al panel de escuela con acceso restringido.
          </p>
        </div>

        {loading ? <p className="text-sm text-gray-600">Validando invitación...</p> : null}
        {!loading && error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {!loading && !error && invitation ? (
          <>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              <p>
                Escuela: <span className="font-medium">{invitation.school.name}</span>
              </p>
              <p>
                Email invitado: <span className="font-medium">{invitation.email}</span>
              </p>
              <p>
                Estado: <span className="font-medium">{invitation.status}</span>
              </p>
            </div>

            {!invitation.valid ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Esta invitación ya no está disponible. Solicitá una nueva invitación al administrador.
              </p>
            ) : saved ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Cuenta activada correctamente. Redirigiendo al login...
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Nueva contraseña</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Confirmar contraseña
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repetí la contraseña"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleAccept()}
                    disabled={saving}
                  >
                    {saving ? "Activando..." : "Activar cuenta"}
                  </Button>
                </div>
              </>
            )}
          </>
        ) : null}
      </Card>
    </main>
  );
}
