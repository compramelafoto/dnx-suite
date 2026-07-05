"use client";

import { useState } from "react";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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

  if (!open) return null;

  return (
    <AppModal
      open={open}
      onClose={handleClose}
      size="lg"
      title="Recomendar un laboratorio"
      titleId="recommend-lab-modal-title"
      zIndexClass="z-[110]"
      panelClassName="max-h-[min(92vh,900px)] overflow-y-auto shadow-xl"
    >
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {success ? (
          <div className="py-2">
            <p className="text-[#059669] font-medium mb-2">¡Listo!</p>
            <p className="max-w-2xl text-base leading-relaxed text-gray-600">
              La recomendación fue enviada. Le escribimos al laboratorio por email para invitarlo a sumarse a
              ComprameLaFoto.
            </p>
            <Button variant="primary" onClick={handleClose} className="mt-4">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
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
              <label className="block text-sm font-medium text-[#374151] mb-1">WhatsApp del laboratorio</label>
              <Input
                type="text"
                value={labWhatsapp}
                onChange={(e) => setLabWhatsapp(e.target.value)}
                placeholder="+54 9 11 1234-5678"
                disabled={loading}
                className="w-full"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
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
      </div>
    </AppModal>
  );
}
