"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type FormState = {
  name: string;
  lastName: string;
  whatsapp: string;
  email: string;
};

export default function AlbumNotifyForm({ albumId }: { albumId: number }) {
  const [form, setForm] = useState<FormState>({
    name: "",
    lastName: "",
    whatsapp: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/a/${albumId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          lastName: form.lastName.trim(),
          whatsapp: form.whatsapp.trim(),
          email: form.email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo guardar la notificación.");
        return;
      }
      setMessage("¡Listo! Te avisaremos cuando las fotos estén disponibles.");
      setForm({ name: "", lastName: "", whatsapp: "", email: "" });
    } catch {
      setError("Error de conexión. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ds-notify-form-shell">
      <form onSubmit={handleSubmit} className="ds-form-stack w-full">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Nombre</label>
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Apellido</label>
          <Input
            value={form.lastName}
            onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
          <Input
            value={form.whatsapp}
            onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </div>
        {error && <p className="text-base text-red-600">{error}</p>}
        {message && <p className="text-base text-green-600">{message}</p>}
        <div className="flex justify-center pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full h-12 rounded-md text-base"
          >
            {loading ? "Enviando..." : "Avisarme cuando estén listas"}
          </Button>
        </div>
      </form>
    </div>
  );
}
