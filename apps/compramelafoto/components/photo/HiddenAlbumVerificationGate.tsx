"use client";

import { useState, useRef, useEffect } from "react";
import Button from "@/components/ui/Button";
import QRCode from "qrcode";

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
    if (!selfieFile) {
      setError("Subí una selfie para continuar");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
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
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Error. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
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
                  disabled={submitting}
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
                onClick={() => inputRef.current?.click()}
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
              Escaneá con la cámara del celular → se abre la galería → tocá «Reconocimiento facial para ver mis fotos»
            </p>
          </div>
        ) : (
          <div className="w-56 h-56 mx-auto bg-slate-200 rounded-xl animate-pulse" />
        )}
      </div>
    </div>
  );
}
