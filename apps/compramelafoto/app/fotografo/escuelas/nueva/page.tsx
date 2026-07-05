"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import AddressGeoSearch from "@/components/school/AddressGeoSearch";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function FotografoEscuelasNuevaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photographer, setPhotographer] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPhotographer(data))
        .catch(() => {});
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/fotografo/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          province: province.trim() || undefined,
          country: country.trim() || undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          logoUrl: logoUrl || undefined,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Error al crear");
      router.push(`/fotografo/escuelas/${data.id}`);
    } catch (err: any) {
      setError(err?.message || "Error al crear la escuela");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogoFile(file: File | null) {
    if (!file) return;
    setLogoUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/fotografo/schools/upload-logo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al subir el logo");
      if (data.logoUrl) setLogoUrl(data.logoUrl);
    } catch (err: any) {
      setError(err?.message || "Error al subir el logo");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-8">
        <DsDashboardInner>
          <div className="mb-6">
            <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
              ← Volver a Escolar
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            Nueva escuela
          </h1>
          <p className="ds-readable-text ds-readable-text--fluid mb-6 text-gray-600">
            Creá una escuela para vincular álbumes escolares y configurar cursos/divisiones.
          </p>

          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo de la escuela (opcional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Se mostrará en la ficha de la escuela. JPG, PNG, WebP o GIF, máx. 5 MB.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleLogoFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
                  </Button>
                  {logoUrl && (
                    <>
                      <div className="h-20 w-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden shrink-0">
                        <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                      </div>
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => setLogoUrl(null)}
                      >
                        Quitar logo
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la escuela *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Colegio San Martín"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email de contacto
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contacto@escuela.edu.ar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono de contacto
                </label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <AddressGeoSearch
                address={address}
                city={city}
                province={province}
                country={country}
                latitude={latitude}
                longitude={longitude}
                onAddressChange={setAddress}
                onCityChange={setCity}
                onProvinceChange={setProvince}
                onCountryChange={setCountry}
                onCoordsChange={(lat, lon) => {
                  setLatitude(lat);
                  setLongitude(lon);
                }}
                placeholder="Buscar dirección (ej. Colegio San Martín, Buenos Aires)"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas internas..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear escuela"}
                </Button>
                <Link href="/fotografo/escuelas">
                  <Button type="button" variant="secondary">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
