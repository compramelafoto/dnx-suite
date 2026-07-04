"use client";

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function RemoverFotoPage() {
  const router = useRouter();
  const params = useParams();
  const albumId = params?.id ? String(params.id) : null;
  const photoId = params?.photoId ? String(params.photoId) : null;

  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState<any>(null);
  const [photo, setPhoto] = useState<any>(null);
  const [form, setForm] = useState({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    reason: "",
    declarationOk: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!albumId || !photoId) {
      setError("Parámetros inválidos");
      setLoading(false);
      return;
    }

    // Cargar datos del álbum y foto
    async function loadData() {
      try {
        const res = await fetch(`/api/a/${albumId}/photo/${photoId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error cargando datos");
        }
        if (data.album && data.photo) {
          setAlbum(data.album);
          setPhoto(data.photo);
        } else {
          throw new Error("Datos incompletos");
        }
      } catch (err: any) {
        setError(err?.message || "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [albumId, photoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!albumId || !photoId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/removal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: Number(albumId),
          photoId: Number(photoId),
          requesterName: form.requesterName.trim(),
          requesterEmail: form.requesterEmail.trim(),
          requesterPhone: form.requesterPhone.trim(),
          reason: form.reason.trim(),
          declarationOk: form.declarationOk,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar la solicitud");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Error al enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[#6b7280]">Cargando...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error && !album) {
    return (
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <Card className="p-6">
              <div className="text-center">
                <p className="text-[#ef4444] mb-4">{error}</p>
                <Button variant="secondary" onClick={() => router.back()}>
                  Volver
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <Button variant="secondary" onClick={() => router.back()} className="mb-4">
              ← Volver
            </Button>
            <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
              Solicitar baja de foto
            </h1>
            <p className="text-[#6b7280]">
              Si aparecés en esta foto y querés solicitar su remoción, completá el siguiente formulario. El fotógrafo revisará tu solicitud.
            </p>
          </div>

          {photo && (
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-[#f3f4f6] flex-shrink-0">
                  <img
                    src={photo.previewUrl}
                    alt={`Foto ${photo.id}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm text-[#6b7280] mb-1">Álbum</p>
                  <p className="font-medium text-[#1a1a1a]">{album?.title || "Sin título"}</p>
                  <p className="text-sm text-[#6b7280] mt-2">Foto ID: {photo.id}</p>
                </div>
              </div>
            </Card>
          )}

          {success ? (
            <Card className="p-8 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 text-[#10b981] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">
                Solicitud Enviada
              </h3>
              <p className="text-[#6b7280] mb-6">
                Recibimos tu solicitud. El fotógrafo la revisará y te contactará si es necesario.
              </p>
              <Button variant="primary" onClick={() => router.push(`/a/${albumId}`)}>
                Volver al Álbum
              </Button>
            </Card>
          ) : (
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Nombre y Apellido <span className="text-[#ef4444]">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    minLength={2}
                    value={form.requesterName}
                    onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                    disabled={submitting}
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Email <span className="text-[#ef4444]">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    value={form.requesterEmail}
                    onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}
                    disabled={submitting}
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    WhatsApp/Teléfono <span className="text-[#ef4444]">*</span>
                  </label>
                  <Input
                    type="tel"
                    required
                    minLength={8}
                    value={form.requesterPhone}
                    onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })}
                    placeholder="Ej: +5491123456789"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Motivo de la solicitud <span className="text-[#ef4444]">*</span>
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={6}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Explicá brevemente por qué solicitás la remoción de esta foto..."
                    className="w-full px-4 py-2 border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d] resize-none"
                    disabled={submitting}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    checked={form.declarationOk}
                    onChange={(e) => setForm({ ...form, declarationOk: e.target.checked })}
                    className="mt-1 w-4 h-4 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d]"
                    disabled={submitting}
                    id="removal-declaration"
                  />
                  <label htmlFor="removal-declaration" className="text-sm text-[#1a1a1a] cursor-pointer">
                    Declaro que la solicitud es real y que soy la persona afectada o su representante legal. <span className="text-[#ef4444]">*</span>
                  </label>
                </div>

                {error && (
                  <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-lg">
                    <p className="text-sm text-[#dc2626]">{error}</p>
                  </div>
                )}

                {/* TODO: Agregar captcha aquí cuando se implemente */}
                {/* <div className="captcha-placeholder">
                  <ReCAPTCHA ... />
                </div> */}

                <div className="flex gap-3 justify-end pt-4 border-t border-[#e5e7eb]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.back()}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitting || !form.declarationOk}
                  >
                    {submitting ? "Enviando..." : "Enviar Solicitud"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
