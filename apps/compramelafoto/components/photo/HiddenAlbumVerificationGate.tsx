"use client";

import { useState, useRef, useEffect } from "react";
import Button from "@/components/ui/Button";
import QRCode from "qrcode";
import {
  BIOMETRIC_CONSENT_FIELD,
  BIOMETRIC_CONSENT_REQUIRED_MESSAGE,
  BIOMETRIC_CONSENT_VERSION,
} from "@/lib/legal/biometric-consent-check";

/** Casilla de consentimiento biométrico (obligatoria antes de la cámara/subida). */
function BiometricConsentCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-700 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-testid="biometric-consent-checkbox"
      />
      <span>
        Acepto que mi selfie se use sólo para buscar mis fotos en este álbum, según el{" "}
        <a href="/consentimiento-biometrico" target="_blank" rel="noopener noreferrer" className="underline font-medium">
          Consentimiento biométrico
        </a>{" "}
        y la{" "}
        <a href="/privacidad/escuelas" target="_blank" rel="noopener noreferrer" className="underline font-medium">
          Política de privacidad escolar
        </a>
        .
      </span>
    </label>
  );
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  return /android|iphone|ipod|ipad|webos|blackberry|iemobile|opera mini|mobile/i.test(ua.toLowerCase());
}

export default function HiddenAlbumVerificationGate({
  albumId,
  albumTitle,
  tertiaryColor,
}: {
  albumId: number;
  albumTitle: string;
  tertiaryColor?: string | null;
}) {
  const accentColor = tertiaryColor || "#c27b3d";
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  /** Si el álbum guarda la selfie, la respuesta trae un enlace para borrarla ya. */
  const [verifiedWithStoredSelfie, setVerifiedWithStoredSelfie] = useState<{
    deletionUrl: string;
    expiresAt: string | null;
  } | null>(null);
  const [deletingSelfie, setDeletingSelfie] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    if (!isMobile) {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (url) {
        QRCode.toDataURL(url, { width: 240, margin: 2 }).then(setQrDataUrl).catch(() => {});
      }
    }
  }, [isMobile]);

  useEffect(() => {
    if (!selfieFile) {
      if (selfiePreview) URL.revokeObjectURL(selfiePreview);
      setSelfiePreview(null);
      return;
    }
    const url = URL.createObjectURL(selfieFile);
    setSelfiePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selfieFile]);

  async function handleSelfieSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentAccepted) {
      setError(BIOMETRIC_CONSENT_REQUIRED_MESSAGE);
      return;
    }
    if (!selfieFile) {
      setError("Subí una selfie para continuar");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append(BIOMETRIC_CONSENT_FIELD, BIOMETRIC_CONSENT_VERSION);
      formData.append("selfie", selfieFile);
      const res = await fetch(`/api/albums/${albumId}/hidden/selfie`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error al verificar. Intentá de nuevo.");
      }
      if (typeof data?.selfieDeletionUrl === "string" && data.selfieDeletionUrl) {
        // La selfie quedó guardada: antes de mostrar las fotos ofrecemos borrarla ya.
        setVerifiedWithStoredSelfie({
          deletionUrl: data.selfieDeletionUrl,
          expiresAt: typeof data?.selfieExpiresAt === "string" ? data.selfieExpiresAt : null,
        });
        return;
      }
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Error. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSelfie() {
    if (!verifiedWithStoredSelfie) return;
    setDeletingSelfie(true);
    setDeletionMessage(null);
    try {
      const url = new URL(verifiedWithStoredSelfie.deletionUrl, window.location.origin);
      const token = url.searchParams.get("token") || "";
      const res = await fetch(url.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      setDeletionMessage(res.ok ? data?.message || "Listo: borramos tu selfie." : data?.error || "No pudimos borrar tu selfie.");
    } catch {
      setDeletionMessage("No pudimos borrar tu selfie. Probá de nuevo.");
    } finally {
      setDeletingSelfie(false);
    }
  }

  if (verifiedWithStoredSelfie) {
    const expiresLabel = verifiedWithStoredSelfie.expiresAt
      ? new Intl.DateTimeFormat("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(verifiedWithStoredSelfie.expiresAt))
      : null;
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
        <div className="w-full min-w-0 max-w-xl border-2 border-slate-200 bg-white rounded-2xl p-6 shadow-sm text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">¡Listo! Ya podés ver tus fotos</h2>
          <p className="text-sm text-slate-600">
            Este álbum guarda la selfie por un tiempo limitado
            {expiresLabel ? <> (se borra sola el <strong>{expiresLabel}</strong>)</> : null}. Si preferís, podés borrarla
            ahora.
          </p>
          {deletionMessage ? (
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{deletionMessage}</p>
          ) : (
            <Button type="button" variant="secondary" className="w-full" onClick={handleDeleteSelfie} disabled={deletingSelfie}>
              {deletingSelfie ? "Borrando..." : "Borrar mi selfie ahora"}
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => window.location.reload()}
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          >
            Ver mis fotos
          </Button>
        </div>
      </div>
    );
  }

  // Móvil: mensaje + un solo botón de reconocimiento facial
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
        <div className="w-full min-w-0 max-w-4xl border-2 border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <span className="text-3xl">🔒</span>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 text-center mb-3">
            Galería con fotos ocultas
          </h2>
          <div className="text-sm text-slate-600 text-center space-y-2 mb-6 px-1">
            <p>
              En esta galería <strong>nadie puede ver todas las fotos</strong>. Solo vos vas a ver <strong>tus propias fotos</strong> después de verificar tu identidad.
            </p>
            <p>
              El reconocimiento facial compara tu selfie con las fotos del evento y te muestra solo las que coinciden con tu rostro.
            </p>
          </div>

          <form onSubmit={handleSelfieSubmit} className="space-y-4">
            <BiometricConsentCheckbox
              checked={consentAccepted}
              onChange={(v) => {
                setConsentAccepted(v);
                if (v) setError(null);
              }}
              disabled={submitting}
            />
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.type.startsWith("image/")) setSelfieFile(f);
              }}
            />
            {selfiePreview ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-slate-200 aspect-square max-h-44">
                  <img
                    src={selfiePreview}
                    alt="Tu selfie"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setSelfieFile(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                  >
                    ×
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={submitting || !consentAccepted}
                  style={accentColor ? { backgroundColor: accentColor } : undefined}
                >
                  {submitting ? "Verificando..." : "Ver mis fotos"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="w-full py-4 text-base font-semibold"
                disabled={!consentAccepted}
                onClick={() => {
                  if (!consentAccepted) {
                    setError(BIOMETRIC_CONSENT_REQUIRED_MESSAGE);
                    return;
                  }
                  inputRef.current?.click();
                }}
                style={accentColor ? { backgroundColor: accentColor } : undefined}
              >
                Reconocimiento facial para ver mis fotos
              </Button>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Desktop: mismo mensaje + QR como única opción (un solo “botón” conceptual)
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
      <div className="w-full min-w-0 max-w-4xl border-2 border-slate-200 bg-white rounded-2xl p-6 shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}18` }}
          >
            <span className="text-3xl">🔒</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          Galería con fotos ocultas
        </h2>
        <div className="text-sm text-slate-600 text-center space-y-2 mb-6 px-1">
          <p>
            En esta galería <strong>nadie puede ver todas las fotos</strong>. Solo vos vas a ver <strong>tus propias fotos</strong> después de verificar tu identidad con reconocimiento facial.
          </p>
          <p>
            En la computadora no podés subir la selfie. <strong>Escaneá el código con tu celular</strong> y ahí vas a poder hacer el reconocimiento facial para ver tus fotos.
          </p>
        </div>

        {qrDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={qrDataUrl}
              alt="QR para abrir en celular"
              className="w-56 h-56 rounded-xl border-2 border-slate-200 shadow-md"
            />
            <p className="text-xs text-slate-500">
              Escaneá con la cámara del celular → se abre la galería → aceptá el consentimiento y tocá «Reconocimiento facial para ver mis fotos»
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              En el celular te vamos a pedir que aceptes que tu selfie se use sólo para buscar tus fotos en este álbum,
              según el{" "}
              <a href="/consentimiento-biometrico" target="_blank" rel="noopener noreferrer" className="underline">
                Consentimiento biométrico
              </a>{" "}
              y la{" "}
              <a href="/privacidad/escuelas" target="_blank" rel="noopener noreferrer" className="underline">
                Política de privacidad escolar
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="w-56 h-56 mx-auto bg-slate-200 rounded-xl animate-pulse" />
        )}
      </div>
    </div>
  );
}
