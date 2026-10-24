"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { SCHOOL_ORGANIZER_PROFILE_MAX_LENGTH } from "@/lib/school-organizer-profile-logic";

type SchoolProfile = {
  id: number;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  logoUrl: string | null;
};

type ProfileForm = {
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  province: string;
  country: string;
};

const EMPTY_FORM: ProfileForm = {
  contactEmail: "",
  contactPhone: "",
  address: "",
  city: "",
  province: "",
  country: "",
};

function toForm(profile: SchoolProfile): ProfileForm {
  return {
    contactEmail: profile.contactEmail ?? "",
    contactPhone: profile.contactPhone ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    province: profile.province ?? "",
    country: profile.country ?? "",
  };
}

const FIELDS: Array<{
  key: keyof ProfileForm;
  label: string;
  type?: string;
  placeholder?: string;
  wide?: boolean;
}> = [
  { key: "contactEmail", label: "Email de contacto", type: "email", placeholder: "secretaria@colegio.edu.ar" },
  { key: "contactPhone", label: "Teléfono de contacto", type: "tel", placeholder: "+54 341 555-1234" },
  { key: "address", label: "Dirección", placeholder: "Calle y número", wide: true },
  { key: "city", label: "Localidad" },
  { key: "province", label: "Provincia" },
  { key: "country", label: "País" },
];

/**
 * Botón «Editar perfil» y formulario para que el organizador edite contacto,
 * ubicación y logo de su escuela. El nombre lo define el fotógrafo.
 */
export default function SchoolProfileEditor({
  schoolId,
  onSaved,
}: {
  schoolId: string | number;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  async function openEditor() {
    setOpen(true);
    setError(null);
    setMessage(null);
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/school-organizer/schools/${schoolId}/profile`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar el perfil de la escuela");
      setProfile(data.school as SchoolProfile);
      setForm(toForm(data.school as SchoolProfile));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil de la escuela");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/school-organizer/schools/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar el perfil");
      setProfile(data.school as SchoolProfile);
      setForm(toForm(data.school as SchoolProfile));
      setMessage("Perfil guardado.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFile(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/school-organizer/schools/${schoolId}/logo`, {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo subir el logo");
      setProfile((prev) => (prev ? { ...prev, logoUrl: data.logoUrl ?? null } : prev));
      setMessage("Logo actualizado.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el logo");
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    if (!window.confirm("¿Quitar el logo de la escuela?")) return;
    setLogoBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/school-organizer/schools/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ logoUrl: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo quitar el logo");
      setProfile(data.school as SchoolProfile);
      setMessage("Logo quitado.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el logo");
    } finally {
      setLogoBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => void openEditor()}>
        Editar perfil
      </Button>
    );
  }

  return (
    <div className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900">Editar perfil de la escuela</h2>
        <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving || logoBusy}>
          Cerrar
        </Button>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Podés actualizar el contacto, la ubicación y el logo. El nombre de la escuela lo define el
        fotógrafo responsable.
      </p>

      {loadingProfile ? (
        <p className="mt-3 text-sm text-gray-600">Cargando perfil...</p>
      ) : profile ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {profile.logoUrl ? (
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.logoUrl} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-100" />
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleLogoFile(event.target.files?.[0] ?? null)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoBusy || saving}
            >
              {logoBusy ? "Procesando..." : profile.logoUrl ? "Cambiar logo" : "Subir logo"}
            </Button>
            {profile.logoUrl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRemoveLogo()}
                disabled={logoBusy || saving}
              >
                Quitar logo
              </Button>
            ) : null}
            <span className="text-xs text-gray-500">JPG, PNG, WebP o GIF de hasta 5 MB.</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {FIELDS.map((field) => (
              <label key={field.key} className={`block text-sm ${field.wide ? "md:col-span-2" : ""}`}>
                <span className="mb-1 block text-gray-700">{field.label}</span>
                <Input
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  maxLength={SCHOOL_ORGANIZER_PROFILE_MAX_LENGTH[field.key]}
                  value={form[field.key]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => ({ ...prev, [field.key]: value }));
                  }}
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => void handleSave()} disabled={saving || logoBusy}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
