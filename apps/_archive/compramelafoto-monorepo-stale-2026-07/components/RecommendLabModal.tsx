"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

type RecommendLabModalProps = {
  open: boolean;
  onClose: () => void;
  defaultPhotographerName?: string;
};

export default function RecommendLabModal({
  open,
  onClose,
  defaultPhotographerName = "",
}: RecommendLabModalProps) {
  const [photographerName, setPhotographerName] = useState(defaultPhotographerName);
  const [labName, setLabName] = useState("");
  const [labEmail, setLabEmail] = useState("");
  const [labWhatsapp, setLabWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setSuccess(false);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/recommend-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photographerName: photographerName.trim(),
          labName: labName.trim(),
          labEmail: labEmail.trim(),
          labWhatsapp: labWhatsapp.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error al enviar");
      }
      setSuccess(true);
      setLabName("");
      setLabEmail("");
      setLabWhatsapp("");
    } catch (err: any) {
      setError(err?.message || "Error al enviar la recomendación");
    } finally {
      setLoading(false);
    }
  }

  // Cerrar modal con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        handleClose();
      }
    }
    if (open) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center z-[110] p-4 pointer-events-none">
        <Card
          className="w-full max-w-xl min-w-[min(100%,360px)] max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[#1a1a1a]">
              Recomendar un laboratorio
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-[#6b7280] hover:text-[#1a1a1a] p-1"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {success ? (
            <div className="py-4">
              <p className="text-[#059669] font-medium mb-2">¡Listo!</p>
              <p className="text-[#6b7280] text-sm">
                La recomendación fue enviada. Le escribimos al laboratorio por email para invitarlo a sumarse a ComprameLaFoto.
              </p>
              <Button variant="primary" onClick={handleClose} className="mt-4">
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Nombre del fotógrafo <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={photographerName}
                  onChange={(e) => setPhotographerName(e.target.value)}
                  placeholder="Tu nombre o nombre del estudio"
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Nombre del laboratorio <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="Nombre del laboratorio"
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Email del laboratorio <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={labEmail}
                  onChange={(e) => setLabEmail(e.target.value)}
                  placeholder="correo@laboratorio.com"
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  WhatsApp del laboratorio
                </label>
                <Input
                  type="text"
                  value={labWhatsapp}
                  onChange={(e) => setLabWhatsapp(e.target.value)}
                  placeholder="+54 9 11 1234-5678"
                  disabled={loading}
                  className="w-full"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? "Enviando…" : "Enviar recomendación"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
