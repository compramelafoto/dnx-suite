"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EventLocationSearch from "@/components/organizer/EventLocationSearch";

type Category = { id: number; name: string; slug: string };
type Profile = {
  id: string;
  type: string;
  name: string;
  slug: string;
  status: string;
  province: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  description: string | null;
  contactName: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  latitude?: number | null;
  longitude?: number | null;
  categorySlugs?: string[];
  workReferenceLabels?: string[];
};

type Props = {
  profileId: string;
  type: "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR";
  backHref: string;
  backLabel: string;
};

export default function CommunityProfileEditForm({ profileId, type, backHref, backLabel }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationDisplayName, setLocationDisplayName] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [categorySlugs, setCategorySlugs] = useState<string[]>([]);
  const [workReferencesText, setWorkReferencesText] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/community-profiles/${profileId}`).then((r) => r.json()),
      fetch(`/api/public/community-categories?type=${type}`).then((r) => r.json()),
    ])
      .then(([profileRes, catRes]) => {
        if (profileRes.error || !profileRes.profile) {
          setError(profileRes.error || "Perfil no encontrado");
          return;
        }
        const p = profileRes.profile as Profile;
        setProfile(p);
        setName(p.name ?? "");
        setStatus(p.status ?? "ACTIVE");
        setProvince(p.province ?? "");
        setCity(p.city ?? "");
        setAddress(p.address ?? "");
        setEmail(p.email ?? "");
        setWhatsapp(p.whatsapp ?? "");
        setWebsite(p.website ?? "");
        setInstagram(p.instagram ?? "");
        setFacebook(p.facebook ?? "");
        setTiktok(p.tiktok ?? "");
        setYoutube(p.youtube ?? "");
        setDescription(p.description ?? "");
        setContactName(p.contactName ?? "");
        setLogoUrl(p.logoUrl ?? "");
        setLatitude(p.latitude ?? null);
        setLongitude(p.longitude ?? null);
        setLocationDisplayName("");
        setIsFeatured(p.isFeatured ?? false);
        setCategorySlugs(p.categorySlugs ?? []);
        setWorkReferencesText((p.workReferenceLabels ?? []).join("\n"));
        setCategories(Array.isArray(catRes.categories) ? catRes.categories : []);
      })
      .catch(() => setError("Error al cargar"))
      .finally(() => setLoading(false));
  }, [profileId, type]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    let finalLogoUrl = logoUrl;
    if (logoFile) {
      try {
        const fd = new FormData();
        fd.append("file", logoFile);
        const up = await fetch("/api/public/community-upload-logo", { method: "POST", body: fd });
        const upJson = await up.json();
        if (up.ok && upJson.logoUrl) finalLogoUrl = upJson.logoUrl;
      } catch {
        setError("Error al subir el logo.");
        setSaving(false);
        return;
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
      const res = await fetch(`/api/admin/community-profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          province: province.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          email: email.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          website: website.trim() || undefined,
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          youtube: youtube.trim() || undefined,
          description: description.trim() || undefined,
          contactName: contactName.trim() || undefined,
          logoUrl: finalLogoUrl || undefined,
          isFeatured,
          categorySlugs,
          workReferences,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        setSaving(false);
        return;
      }
      setSuccess(true);
      setProfile(data.profile);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-7xl">
        <p className="text-gray-600">Cargando...</p>
      </Card>
    );
  }
  if (error && !profile) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">{error}</p>
        <Link href={backHref} className="text-[#c27b3d] hover:underline">
          ← {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={backHref} className="text-[#c27b3d] hover:underline text-sm">
          ← {backLabel}
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-gray-900">Editar {type === "EVENT_VENDOR" ? "proveedor" : "empresa"}</h1>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-2 text-sm">
          Cambios guardados correctamente.
        </div>
      )}

      <Card className="w-full max-w-7xl">
        <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base"
            >
              <option value="PENDING">Pendiente</option>
              <option value="ACTIVE">Activo</option>
              <option value="DISABLED">Deshabilitado</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded border-gray-300 text-[#c27b3d]"
            />
            <label htmlFor="featured" className="text-sm text-gray-700">Destacado</label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
              <Input value={province} onChange={(e) => setProvince(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación en mapa</label>
            <EventLocationSearch
              onSelect={(lat, lon, displayName) => {
                setLatitude(lat);
                setLongitude(lon);
                setLocationDisplayName(displayName);
                if (!address.trim()) setAddress(displayName);
              }}
              placeholder="Buscar dirección o lugar para ubicación exacta"
              className="w-full"
            />
            {locationDisplayName && (
              <p className="mt-1 text-sm text-gray-600">Ubicación seleccionada: {locationDisplayName}</p>
            )}
            {(latitude != null && longitude != null) && !locationDisplayName && (
              <p className="mt-1 text-sm text-gray-600">Coordenadas: {latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Opcional. Buscá la dirección para que aparezca en el mapa.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
              <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
              <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">YouTube</label>
              <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto (nombre)</label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio</label>
            <select
              value={categorySlugs[0] ?? ""}
              onChange={(e) => setCategorySlugs(e.target.value ? [e.target.value] : [])}
              className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
            >
              <option value="">Seleccioná un rubro</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            {logoUrl && (
              <div className="mb-2">
                <img src={logoUrl} alt="Logo actual" className="h-16 w-16 object-contain rounded border border-gray-200" />
              </div>
            )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Eventos / referencias</label>
              <textarea
                value={workReferencesText}
                onChange={(e) => setWorkReferencesText(e.target.value)}
                placeholder="Uno por línea"
                rows={3}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
              />
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
