"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

const DEFAULT_TEMPLATES = {
  reminder: "Hola {{nombre}}, ¿cómo estás? Te escribo para recordarte que hoy a las {{hora}} tenemos la charla \"{{titulo}}\". Te dejo el acceso y acordate también de sumarte al grupo si todavía no entraste. {{calendarUrl}}",
  groupInvite: "Hola {{nombre}}, ¿cómo estás? Te comparto el grupo de WhatsApp de la charla para que recibas recordatorios y material extra: {{whatsappGroupUrl}}",
  followUp: "Hola {{nombre}}, gracias por sumarte a la charla de hoy. Si querés, podés responder este mensaje y seguimos por acá. También podés crear tu cuenta en ComprameLaFoto para empezar a probar la plataforma.",
};

export default function AdminTalkNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    slug: "",
    shortDescription: "",
    longDescription: "",
    speakerName: "",
    badgeText: "Charla gratuita",
    eventDate: "",
    eventTime: "18:00",
    timezone: "America/Argentina/Buenos_Aires",
    modality: "ONLINE",
    meetUrl: "",
    calendarUrl: "",
    whatsappGroupUrl: "",
    primaryCtaText: "Reservar mi lugar",
    secondaryCtaText: "Sumarme al grupo",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    status: "DRAFT",
    showFaq: true,
    enableLeadCapture: true,
    enableCalendarStep: true,
    enableWhatsappStep: true,
    requireName: true,
    requireWhatsapp: true,
    requireEmail: true,
    sourceTag: "",
    internalNotes: "",
    reminderTemplate: DEFAULT_TEMPLATES.reminder,
    groupInviteTemplate: DEFAULT_TEMPLATES.groupInvite,
    followUpTemplate: DEFAULT_TEMPLATES.followUp,
    heroImageUrl: "/charla-foto-escolar-flyer.png",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/talks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear la charla.");
      }
      router.push(`/admin/marketing/charlas/${data.talk.id}`);
    } catch (err: any) {
      setError(err?.message || "Error creando charla.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Crear charla</h1>
        <p className="text-sm text-gray-500">Cargá los datos principales para empezar.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Slug</label>
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Subtítulo</label>
          <input
            value={form.subtitle}
            onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              value={form.eventDate}
              onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Hora</label>
            <input
              type="time"
              value={form.eventTime}
              onChange={(event) => setForm((prev) => ({ ...prev, eventTime: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Calendar URL</label>
            <input
              value={form.calendarUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, calendarUrl: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">WhatsApp Group URL</label>
            <input
              value={form.whatsappGroupUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, whatsappGroupUrl: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">CTA principal</label>
            <input
              value={form.primaryCtaText}
              onChange={(event) => setForm((prev) => ({ ...prev, primaryCtaText: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">CTA secundario</label>
            <input
              value={form.secondaryCtaText}
              onChange={(event) => setForm((prev) => ({ ...prev, secondaryCtaText: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Crear charla"}
        </Button>
      </form>
    </div>
  );
}
