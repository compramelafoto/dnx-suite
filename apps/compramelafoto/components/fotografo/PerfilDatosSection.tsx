"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsField } from "@/components/ui/DsField";
import {
  coverageRadiusToSelectValue,
  selectValueToCoverageRadius,
  WORKING_COVERAGE_RADIUS_OPTIONS,
} from "@/lib/photographer/working-coverage-radius";

const AddressGeoSearch = dynamic(() => import("@/components/school/AddressGeoSearch"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg bg-gray-100 h-[120px] flex items-center justify-center text-sm text-gray-500">
      Cargando buscador de dirección…
    </div>
  ),
});

function ProfileBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full p-6 md:p-8">
      <header className="ds-content-container mb-6 w-full">
        <h2 className="text-lg font-semibold text-[#1a1a1a]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">{description}</p>
      </header>
      {children}
    </Card>
  );
}

export type PerfilDatosSectionProps = {
  email: string;
  loading: boolean;
  onSave: () => void;
  titularFirstName: string;
  setTitularFirstName: (v: string) => void;
  titularLastName: string;
  setTitularLastName: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  cuit: string;
  setCuit: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  instagram: string;
  setInstagram: (v: string) => void;
  tiktok: string;
  setTiktok: (v: string) => void;
  facebook: string;
  setFacebook: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  province: string;
  setProvince: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  latitude: string;
  setLatitude: (v: string) => void;
  longitude: string;
  setLongitude: (v: string) => void;
  setCompanyAddress: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  /** km desde ubicación principal; `null` = sin límite (persistencia local hasta campo en User). */
  coverageRadiusKm: number | null;
  setCoverageRadiusKm: (v: number | null) => void;
  /** Resalta la sección de ubicación (p. ej. al llegar desde el aviso post-login). */
  highlightWorkLocation?: boolean;
};

export default function PerfilDatosSection({
  email,
  loading,
  onSave,
  titularFirstName,
  setTitularFirstName,
  titularLastName,
  setTitularLastName,
  contactPhone,
  setContactPhone,
  companyName,
  setCompanyName,
  cuit,
  setCuit,
  website,
  setWebsite,
  instagram,
  setInstagram,
  tiktok,
  setTiktok,
  facebook,
  setFacebook,
  address,
  setAddress,
  city,
  setCity,
  province,
  setProvince,
  country,
  setCountry,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  setCompanyAddress,
  birthDate,
  setBirthDate,
  coverageRadiusKm,
  setCoverageRadiusKm,
  highlightWorkLocation = false,
}: PerfilDatosSectionProps) {
  const [advancedLocationOpen, setAdvancedLocationOpen] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);

  const latNum = latitude ? parseFloat(latitude) : null;
  const lonNum = longitude ? parseFloat(longitude) : null;
  const hasCoords =
    latNum != null &&
    lonNum != null &&
    !Number.isNaN(latNum) &&
    !Number.isNaN(lonNum) &&
    (latNum !== 0 || lonNum !== 0);

  function handleAddressChange(value: string) {
    setAddress(value);
    if (value.trim()) setCompanyAddress(value.trim());
  }

  return (
    <div className="ds-stack-section w-full max-w-none space-y-6">
      <header className="ds-content-container w-full">
        <h1 className="text-xl font-medium text-[#1a1a1a] md:text-2xl">Perfil</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Datos del titular, tu marca y la ubicación donde trabajás. Completá lo esencial; el resto es opcional.
        </p>
      </header>

      <ProfileBlock
        title="Datos personales"
        description="Persona responsable de la cuenta y contacto. La fecha de nacimiento es opcional."
      >
        <div className="ds-form-grid grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <DsField label="Nombre del titular">
            <Input
              type="text"
              placeholder="Ej: María"
              value={titularFirstName}
              onChange={(e) => setTitularFirstName(e.target.value)}
            />
          </DsField>
          <DsField label="Apellido del titular">
            <Input
              type="text"
              placeholder="Ej: González"
              value={titularLastName}
              onChange={(e) => setTitularLastName(e.target.value)}
            />
          </DsField>
          <DsField label="Email" className="md:col-span-2" hint="El email no se puede modificar desde aquí.">
            <Input type="email" value={email} disabled className="cursor-not-allowed bg-[#f3f4f6]" />
          </DsField>
          <DsField
            label="Teléfono personal o WhatsApp"
            className="md:col-span-2"
            hint="Un solo número de contacto. Incluí código de país (ej: +54 9 11 …). Se usa en tu página pública si activás WhatsApp."
          >
            <Input
              type="tel"
              placeholder="+54 9 11 1234-5678"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </DsField>
          <DsField
            label="Fecha de nacimiento"
            htmlFor="birth-date"
            hint="Opcional. No es necesaria para vender fotos."
          >
            <Input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </DsField>
        </div>
      </ProfileBlock>

      <ProfileBlock
        title="Datos de la empresa o marca"
        description="Nombre comercial y presencia online."
      >
        <div className="ds-form-grid grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <DsField label="Nombre de la empresa / estudio" className="md:col-span-2">
            <Input
              type="text"
              placeholder="Ej: Estudio Luz, Fotografía MG"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </DsField>
          <DsField label="CUIT" hint="Opcional. Formato XX-XXXXXXXX-X" className="md:col-span-2">
            <Input
              type="text"
              placeholder="XX-XXXXXXXX-X"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
            />
          </DsField>
          <DsField label="Sitio web" className="md:col-span-2">
            <Input
              type="url"
              placeholder="https://www.tusitio.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </DsField>
          <DsField label="Instagram">
            <Input
              type="text"
              placeholder="@tuinstagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
          </DsField>
          <DsField label="TikTok">
            <Input
              type="text"
              placeholder="@tutiktok"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
            />
          </DsField>
          <DsField label="Facebook" className="md:col-span-2">
            <Input
              type="text"
              placeholder="https://facebook.com/tupagina"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
            />
          </DsField>
        </div>
      </ProfileBlock>

      <ProfileBlock
        title="Ubicación de trabajo"
        description="Buscá tu dirección en el mapa y guardamos tu ubicación de trabajo para invitaciones a eventos cercanos."
      >
        <div
          id="photographer-work-location"
          className={
            highlightWorkLocation
              ? "rounded-xl ring-2 ring-[#c27b3d] ring-offset-2 -m-1 p-1"
              : undefined
          }
        >
        <div className="w-full space-y-4">
          <AddressGeoSearch
            address={address}
            city={city}
            province={province}
            country={country}
            latitude={hasCoords ? latNum : null}
            longitude={hasCoords ? lonNum : null}
            onAddressChange={handleAddressChange}
            onCityChange={setCity}
            onProvinceChange={setProvince}
            onCountryChange={setCountry}
            onCoordsChange={(lat, lon) => {
              setLatitude(String(lat));
              setLongitude(String(lon));
            }}
            placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
          />

          {address.trim() ? (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Dirección detectada</p>
              <p className="mt-1 text-sm text-[#1a1a1a]">{address}</p>
              {(city || province || country) && (
                <p className="mt-1 text-xs text-[#6b7280]">
                  {[city, province, country].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#6b7280]">
              Todavía no hay dirección guardada. Buscá y elegí un resultado para fijar tu ubicación.
            </p>
          )}

          <div className="w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
            <h4 className="text-sm font-semibold text-[#1a1a1a] m-0">Área de cobertura</h4>
            <p className="mt-2 text-sm leading-relaxed text-[#1a1a1a] m-0">
              Indicá hasta qué distancia estás dispuesto a trabajar desde tu ubicación principal.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#6b7280] m-0">
              Este dato se utiliza para mostrarte convocatorias, eventos y oportunidades laborales cercanas dentro de
              ComprameLaFoto.
            </p>
            <div className="ds-form-grid mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
              <DsField label="Distancia máxima para trabajar" htmlFor="working-coverage-radius">
                <Select
                  id="working-coverage-radius"
                  className="rounded-2xl"
                  value={coverageRadiusToSelectValue(coverageRadiusKm)}
                  onChange={(e) => setCoverageRadiusKm(selectValueToCoverageRadius(e.target.value))}
                >
                  {WORKING_COVERAGE_RADIUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="unlimited">Sin límite</option>
                </Select>
              </DsField>
            </div>
            {!hasCoords && (
              <p className="mt-3 text-xs text-[#6b7280] m-0">
                Guardá tu ubicación en el mapa para que el radio de cobertura tenga sentido en búsquedas cercanas.
              </p>
            )}
          </div>

          {hasCoords && (
            <details
              className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2"
              open={coordsOpen}
              onToggle={(e) => setCoordsOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-sm font-medium text-[#4b5563]">
                Coordenadas guardadas (dato técnico)
              </summary>
              <p className="mt-2 font-mono text-xs text-[#6b7280]">
                {latNum?.toFixed(6)}, {lonNum?.toFixed(6)}
              </p>
            </details>
          )}

          <div className="border-t border-[#e5e7eb] pt-4">
            <button
              type="button"
              className="text-sm font-medium text-[#c27b3d] hover:underline"
              onClick={() => setAdvancedLocationOpen((o) => !o)}
            >
              {advancedLocationOpen ? "Ocultar datos avanzados de ubicación" : "Datos avanzados de ubicación"}
            </button>
            {advancedLocationOpen && (
              <div className="ds-form-grid mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <DsField label="Domicilio (texto libre)" className="md:col-span-2">
                  <Input
                    type="text"
                    placeholder="Dirección completa"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </DsField>
                <DsField label="Ciudad">
                  <Input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
                </DsField>
                <DsField label="Provincia / estado">
                  <Input type="text" value={province} onChange={(e) => setProvince(e.target.value)} />
                </DsField>
                <DsField label="País">
                  <Input type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
                </DsField>
              </div>
            )}
          </div>
        </div>
        </div>
      </ProfileBlock>

      <div className="flex justify-end border-t border-[#e5e7eb] pt-4">
        <Button variant="primary" onClick={onSave} disabled={loading}>
          {loading ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
