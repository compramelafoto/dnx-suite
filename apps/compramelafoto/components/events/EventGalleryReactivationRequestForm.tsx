"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

type FormState = {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  message: string;
};

type Props = {
  shareSlug: string;
  reactivatableCount: number;
};

export default function EventGalleryReactivationRequestForm({
  shareSlug,
  reactivatableCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/events/${shareSlug}/reactivation-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterName: form.requesterName.trim(),
          requesterEmail: form.requesterEmail.trim(),
          requesterPhone: form.requesterPhone.trim(),
          message: form.message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo reactivar la galería.");
        return;
      }
      setSuccess(true);
      setOpen(false);
    } catch {
      setError("Error de conexión. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-5 sm:py-5 text-center space-y-4">
        <p className="text-sm font-semibold text-emerald-900 m-0">
          Galería reactivada. Ya podés recargar la página para ver las fotos disponibles.
        </p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full sm:w-auto min-w-[12rem]"
          onClick={() => window.location.reload()}
        >
          Ver fotos
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 pt-1">
      {reactivatableCount > 0 ? (
        <p className="text-sm font-medium text-amber-800 m-0">
          {reactivatableCount === 1
            ? "1 galería disponible para reactivar"
            : `${reactivatableCount} galerías disponibles para reactivar`}
        </p>
      ) : null}

      {!open ? (
        <div className="ds-stack-section w-full gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full min-w-[14rem] whitespace-nowrap"
            onClick={() => setOpen(true)}
          >
            Reactivar galería
          </Button>
          <p className="text-xs sm:text-sm text-gray-500 m-0 leading-relaxed w-full">
            La reactivación extiende temporalmente la disponibilidad de las galerías. Puede tener
            costo adicional según las condiciones del fotógrafo o de la plataforma.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="ds-form-stack w-full text-left rounded-xl border border-amber-100 bg-white/90 p-4 sm:p-5 shadow-sm"
        >
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-gray-900 m-0">
              Reactivar galería del evento
            </h3>
            <p className="text-sm text-gray-700 m-0 leading-relaxed">
              Dejanos tus datos para registrar la reactivación y avisarte si hace falta contactarte
              por esta solicitud.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <Input
              value={form.requesterName}
              onChange={(e) => setForm((p) => ({ ...p, requesterName: e.target.value }))}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <Input
              type="email"
              value={form.requesterEmail}
              onChange={(e) => setForm((p) => ({ ...p, requesterEmail: e.target.value }))}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Input
              value={form.requesterPhone}
              onChange={(e) => setForm((p) => ({ ...p, requesterPhone: e.target.value }))}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Mensaje <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              rows={3}
              className="min-h-[88px]"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-700 m-0" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full sm:flex-1"
            >
              {loading ? "Reactivando…" : "Reactivar galería"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              className="w-full sm:flex-1"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
          <p className="text-xs text-gray-500 m-0 leading-relaxed">
            La reactivación extiende temporalmente la disponibilidad de las galerías. Puede tener
            costo adicional según las condiciones del fotógrafo o de la plataforma.
          </p>
        </form>
      )}
    </div>
  );
}
