"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const REQUEST_TYPES = [
  { value: "ACCESO", label: "Acceso a mis datos" },
  { value: "RECTIFICACION", label: "Rectificación de datos" },
  { value: "SUPRESION", label: "Supresión de datos" },
  { value: "OCULTAR_FOTO", label: "Ocultar una foto específica" },
  { value: "BAJA_MARKETING", label: "Baja de emails de marketing" },
  { value: "DESACTIVAR_BIOMETRIA", label: "Desactivar reconocimiento facial" },
];

const RELATIONSHIPS = [
  { value: "TITULAR", label: "Soy el titular" },
  { value: "PADRE_MADRE_TUTOR", label: "Padre / Madre / Tutor" },
];

export default function PrivacidadSolicitudPage() {
  const [form, setForm] = useState({
    type: "ACCESO",
    fullName: "",
    email: "",
    phone: "",
    relationship: "TITULAR",
    description: "",
    albumId: "",
    photoId: "",
    isRepresentative: false,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; ticketId?: number; message?: string; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          relationship: form.relationship,
          description: form.description.trim() || undefined,
          albumId: form.albumId ? parseInt(form.albumId, 10) : undefined,
          photoId: form.photoId ? parseInt(form.photoId, 10) : undefined,
          isRepresentative: form.isRepresentative,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, error: data.error || "Error al enviar" });
        return;
      }
      setResult({ success: true, ticketId: data.ticketId, message: data.message });
      setForm({
        type: "ACCESO",
        fullName: "",
        email: "",
        phone: "",
        relationship: "TITULAR",
        description: "",
        albumId: "",
        photoId: "",
        isRepresentative: false,
      });
    } catch {
      setResult({ success: false, error: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <Link href="/privacidad" className="text-sm text-[#c27b3d] hover:underline mb-2 inline-block">
              ← Política de Privacidad
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">Solicitud de derechos</h1>
            <p className="text-[#6b7280] mt-1 text-base">
              Ejercé tu derecho de acceso, rectificación, supresión u otros sobre tus datos personales (Ley 25.326 / AAIP). Te respondemos a la brevedad.
            </p>
          </div>

          <Card className="p-6">
            {result?.success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">Solicitud recibida</h2>
                <p className="text-[#6b7280] mb-4">{result.message}</p>
                <p className="text-sm text-[#6b7280]">
                  Revisá tu email para la confirmación. Para otra solicitud{" "}
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="text-[#c27b3d] hover:underline"
                  >
                    completá el formulario nuevamente
                  </button>
                  .
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {result?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                    {result.error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Tipo de solicitud *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    {REQUEST_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Nombre y apellido *</label>
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="Juan Pérez"
                      required
                      minLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Email *</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Teléfono (opcional)</label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+54 11 1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Relación con el titular *</label>
                  <select
                    value={form.relationship}
                    onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Descripción de la solicitud</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Detallá tu solicitud para que podamos ayudarte mejor..."
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">ID Álbum (opcional)</label>
                    <Input
                      type="text"
                      value={form.albumId}
                      onChange={(e) => setForm((f) => ({ ...f, albumId: e.target.value }))}
                      placeholder="Ej: 123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">ID Foto (opcional)</label>
                    <Input
                      type="text"
                      value={form.photoId}
                      onChange={(e) => setForm((f) => ({ ...f, photoId: e.target.value }))}
                      placeholder="Ej: 456"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isRepresentative}
                      onChange={(e) => setForm((f) => ({ ...f, isRepresentative: e.target.checked }))}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-[#c27b3d] focus:ring-[#c27b3d]"
                    />
                    <span className="text-sm text-[#1a1a1a]">
                      Declaro ser titular de los datos o representante legal (padre/madre/tutor)
                    </span>
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar solicitud"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
