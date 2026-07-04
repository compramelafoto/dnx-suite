"use client";

import { useState, useEffect } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EventLocationSearch from "@/components/organizer/EventLocationSearch";
import LocationMap from "@/components/organizer/LocationMap";

type Category = { id: number; name: string; slug: string };
type Props = {
  type: "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR";
  title: string;
  subtitle: string;
  /** Logo del partner/organizador (ej. DNX estudio 2) que se muestra arriba del formulario */
  partnerLogoUrl?: string;
  /** Nombre del partner si no hay logo (ej. "DNX estudio 2") */
  partnerName?: string;
};

const DIRECTORY_DESCRIPTION = `Formar parte de nuestro directorio te permite ser encontrado por fotógrafos, organizadores y clientes que buscan servicios de calidad. Tu ficha aparecerá en el mapa con tu ubicación, contacto y datos, lo que aumenta la visibilidad de tu negocio y te acerca a nuevas oportunidades. Completá el formulario con precisión para que podamos publicar tu información y que más personas te conozcan.`;

export default function CommunityAltaForm({ type, title, subtitle, partnerLogoUrl, partnerName = "DNX estudio 2" }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [categorySlugs, setCategorySlugs] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationDisplayName, setLocationDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [workReferencesText, setWorkReferencesText] = useState("");

  useEffect(() => {
    fetch(`/api/public/community-categories?type=${type}`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data.categories) ? data.categories : []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [type]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nombre obligatorio";
    if (categorySlugs.length === 0) errs.categorySlugs = "Seleccioná al menos un rubro";
    if (latitude == null || longitude == null) errs.location = "Dirección de la empresa obligatoria";
    if (!whatsapp.trim()) errs.whatsapp = "WhatsApp obligatorio";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    let finalLogoUrl = logoUrl;
    if (logoFile) {
      try {
        const fd = new FormData();
        fd.append("file", logoFile);
        const up = await fetch("/api/public/community-upload-logo", { method: "POST", body: fd });
        const upJson = await up.json();
        if (up.ok && upJson.logoUrl) finalLogoUrl = upJson.logoUrl;
      } catch {
        setError("Error al subir el logo. Podés enviar el formulario sin logo.");
      }
    }

    const workReferences =
      type === "EVENT_VENDOR"
        ? workReferencesText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    try {
      const res = await fetch("/api/public/community-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          categorySlugs,
          whatsapp: whatsapp.trim(),
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          youtube: youtube.trim() || undefined,
          description: description.trim() || undefined,
          logoUrl: finalLogoUrl || undefined,
          workReferences,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Error al enviar");
        if (data.details) setFieldErrors({ form: data.details });
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-4xl mx-auto text-center py-12">
        <p className="text-xl text-gray-800 font-medium">Listo, recibimos tus datos.</p>
        <p className="mt-2 text-gray-600">
          En breve los revisamos y aparecerán en el directorio.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-600">Cargando formulario...</p>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {(partnerLogoUrl || partnerName) && (
        <div className="flex flex-col items-center mb-6">
          {partnerLogoUrl ? (
            <img
              src={partnerLogoUrl}
              alt={partnerName}
              className="object-contain h-16 w-auto max-h-20"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) (fallback as HTMLElement).style.display = "block";
              }}
            />
          ) : null}
          <span
            className="text-xl font-semibold text-gray-800"
            style={{ display: partnerLogoUrl ? "none" : "block" }}
          >
            {partnerName}
          </span>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-gray-600">{subtitle}</p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{DIRECTORY_DESCRIPTION}</p>

      <Card className="mt-6 w-full">
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa o marca *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Flor de peluquería"
              required
            />
            {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de servicio *</label>
            <select
              value={categorySlugs[0] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCategorySlugs(v ? [v] : []);
                setFieldErrors((err) => ({ ...err, categorySlugs: "" }));
              }}
              required
              className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
            >
              <option value="">Seleccioná un rubro</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.categorySlugs && <p className="mt-1 text-sm text-red-600">{fieldErrors.categorySlugs}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 341 123 4567"
              required
            />
            {fieldErrors.whatsapp && <p className="mt-1 text-sm text-red-600">{fieldErrors.whatsapp}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="opcional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@usuario o URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
              <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="opcional" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
              <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">YouTube</label>
              <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="opcional" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dirección de la empresa *</label>
            <EventLocationSearch
              onSelect={(lat, lon, displayName) => {
                setLatitude(lat);
                setLongitude(lon);
                setLocationDisplayName(displayName);
                setFieldErrors((e) => ({ ...e, location: "" }));
              }}
              placeholder="Buscar dirección (ej: Av. Corrientes 1234, Rosario)"
              className="w-full"
            />
            {locationDisplayName && (
              <p className="mt-1 text-sm text-gray-600">
                Dirección: {locationDisplayName}
              </p>
            )}
            {fieldErrors.location && <p className="mt-1 text-sm text-red-600">{fieldErrors.location}</p>}
            <p className="mt-1 text-xs text-gray-500 mb-2">Buscá la dirección o mové el marcador en el mapa.</p>
            <LocationMap
              latitude={latitude ?? 0}
              longitude={longitude ?? 0}
              editable
              onPositionChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
                setFieldErrors((e) => ({ ...e, location: "" }));
                if (!locationDisplayName) setLocationDisplayName("Dirección en mapa");
              }}
              height="280px"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción de tu negocio"
              rows={3}
              className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#c27b3d] file:px-4 file:py-2 file:text-white file:font-semibold"
            />
            <p className="mt-1 text-xs text-gray-500">Opcional. JPEG, PNG o WebP, máx. 2 MB.</p>
          </div>

          {type === "EVENT_VENDOR" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Eventos en los que trabajaste con DNX / referencia
              </label>
              <textarea
                value={workReferencesText}
                onChange={(e) => setWorkReferencesText(e.target.value)}
                placeholder="Uno por línea, opcional"
                rows={3}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              />
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
