"use client";

import AppModal from "@/components/ui/AppModal";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  CC_TAX_CONDITION_OPTIONS,
  fetchClfBusinessProfileSeed,
  INITIAL_CUANTO_COBRO_BUSINESS_PROFILE,
  mergeBusinessProfileDraftWithSeed,
  normalizeBusinessProfile,
  saveBusinessProfile,
  type CuantoCobroBusinessProfile,
} from "@/lib/cuantocobro/business-profile";
import { userHasWorkLocation } from "@/lib/photographer/work-location";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";

const AddressGeoSearch = dynamic(() => import("@/components/school/AddressGeoSearch"), {
  ssr: false,
  loading: () => (
    <div className="cc-business-profile__geo-loading flex min-h-[120px] items-center justify-center rounded-lg bg-[var(--cc-color-bg-soft)] text-sm text-[var(--cc-color-muted)]">
      Cargando buscador de dirección…
    </div>
  ),
});

type Props = {
  open: boolean;
  onClose: () => void;
  storedProfile: CuantoCobroBusinessProfile | null;
  onSaved: (profile: CuantoCobroBusinessProfile) => void;
  highlightSection?: "address" | null;
};

function ProfileSection({
  title,
  description,
  children,
  id,
  highlighted = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
  highlighted?: boolean;
}) {
  return (
    <section
      id={id}
      className={`cc-business-profile__section${highlighted ? " cc-business-profile__section--highlight" : ""}`}
    >
      <header className="cc-business-profile__section-header">
        <h3 className="cc-business-profile__section-title m-0">{title}</h3>
        {description ? <p className="cc-business-profile__section-desc m-0">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export default function BusinessProfileModal({
  open,
  onClose,
  storedProfile,
  onSaved,
  highlightSection = null,
}: Props) {
  const [draft, setDraft] = useState<CuantoCobroBusinessProfile>(INITIAL_CUANTO_COBRO_BUSINESS_PROFILE);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function initDraft() {
      if (storedProfile) {
        setDraft(storedProfile);
        return;
      }

      setLoadingSeed(true);
      setDraft(INITIAL_CUANTO_COBRO_BUSINESS_PROFILE);

      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (!meRes.ok) return;
        const meData = await meRes.json();
        const id = meData?.user?.id;
        if (!id || cancelled) return;

        setUserId(id);
        const seed = await fetchClfBusinessProfileSeed(id);
        if (!cancelled) {
          setDraft((prev) => mergeBusinessProfileDraftWithSeed(prev, seed));
        }
      } finally {
        if (!cancelled) setLoadingSeed(false);
      }
    }

    void initDraft();
    return () => {
      cancelled = true;
    };
  }, [open, storedProfile]);

  useEffect(() => {
    if (!open || userId) return;

    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.id) setUserId(data.user.id);
      })
      .catch(() => {});
  }, [open, userId]);

  function patchDraft(patch: Partial<CuantoCobroBusinessProfile>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleCancel() {
    onClose();
  }

  function handleSave() {
    setSaving(true);
    const normalized = normalizeBusinessProfile({
      ...draft,
      seededFromClf: storedProfile?.seededFromClf ?? !storedProfile,
    });
    saveBusinessProfile(normalized);

    const lat = normalized.latitude ? parseFloat(normalized.latitude) : null;
    const lng = normalized.longitude ? parseFloat(normalized.longitude) : null;

    if (userId && userHasWorkLocation(lat, lng)) {
      void fetch("/api/fotografo/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: normalized.address,
          city: normalized.city,
          province: normalized.province,
          country: normalized.country,
          latitude: lat,
          longitude: lng,
        }),
      })
        .then((res) => {
          if (res.ok) {
            window.dispatchEvent(new CustomEvent("clf-photographer-work-location-updated"));
          }
        })
        .catch(() => {});
    }

    onSaved(normalized);
    setSaving(false);
  }

  async function handleLogoUpload(file: File | null) {
    if (!file) return;
    setLogoError(null);

    if (!file.name.toLowerCase().endsWith(".png")) {
      setLogoError("El logo debe ser un archivo PNG.");
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (userId) formData.append("photographerId", String(userId));

      const res = await fetch("/api/fotografo/upload-logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setLogoError(data?.error || "No se pudo subir el logo.");
        return;
      }
      if (data?.logoUrl) {
        patchDraft({ logoUrl: String(data.logoUrl) });
      }
    } catch {
      setLogoError("Error de red al subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  const latNum = draft.latitude ? parseFloat(draft.latitude) : null;
  const lngNum = draft.longitude ? parseFloat(draft.longitude) : null;

  useEffect(() => {
    if (!open || highlightSection !== "address") return;
    const timer = window.setTimeout(() => {
      document.getElementById("cc-business-profile-address")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, highlightSection]);

  return (
    <AppModal
      open={open}
      onClose={handleCancel}

      maxWidthCapRem="52rem"
      title="Perfil comercial"
      description="Datos que aparecen en tus presupuestos y en la vista para el cliente."
      panelClassName="cc-business-profile-modal cc-page"
      contentClassName="!p-0 overflow-hidden"
      zIndexClass="z-[95]"
    >
      <div className="cc-business-profile-modal__scroll">
        <p className="cc-business-profile-modal__notice m-0" role="note">
          Estos datos solo se usan para tus presupuestos. No modifican la landing pública de
          ComprameLaFoto.
        </p>

        {loadingSeed ? (
          <p className="cc-business-profile-modal__loading m-0 text-sm text-[var(--cc-color-muted)]">
            Cargando datos de tu cuenta…
          </p>
        ) : null}

        <ProfileSection
          title="Datos de empresa"
          description="Nombre comercial y responsable que aparecerán en el encabezado del presupuesto."
        >
          <div className="cc-business-profile__grid">
            <DsField label="Nombre comercial / empresa" htmlFor="cc-bp-trade">
              <Input
                id="cc-bp-trade"
                value={draft.tradeName}
                onChange={(e) => patchDraft({ tradeName: e.target.value })}
                placeholder="Ej: Estudio Luz Natural"
              />
            </DsField>
            <DsField label="Nombre del fotógrafo responsable" htmlFor="cc-bp-first">
              <Input
                id="cc-bp-first"
                value={draft.photographerFirstName}
                onChange={(e) => patchDraft({ photographerFirstName: e.target.value })}
                placeholder="Nombre"
              />
            </DsField>
            <DsField label="Apellido del fotógrafo responsable" htmlFor="cc-bp-last">
              <Input
                id="cc-bp-last"
                value={draft.photographerLastName}
                onChange={(e) => patchDraft({ photographerLastName: e.target.value })}
                placeholder="Apellido"
              />
            </DsField>
            <DsField label="CUIT / identificación fiscal" htmlFor="cc-bp-cuit" hint="Opcional">
              <Input
                id="cc-bp-cuit"
                value={draft.cuit}
                onChange={(e) => patchDraft({ cuit: e.target.value })}
                placeholder="Ej: 20-12345678-9"
              />
            </DsField>
            <DsField label="Condición fiscal" htmlFor="cc-bp-tax" hint="Opcional">
              <Select
                id="cc-bp-tax"
                value={draft.taxCondition}
                onChange={(e) => patchDraft({ taxCondition: e.target.value })}
              >
                {CC_TAX_CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value || "none"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </DsField>
          </div>
        </ProfileSection>

        <ProfileSection title="Contacto" description="Cómo te puede contactar tu cliente.">
          <div className="cc-business-profile__grid">
            <DsField label="Email comercial" htmlFor="cc-bp-email">
              <Input
                id="cc-bp-email"
                type="email"
                value={draft.commercialEmail}
                onChange={(e) => patchDraft({ commercialEmail: e.target.value })}
                placeholder="contacto@tuestudio.com"
              />
            </DsField>
            <DsField label="Teléfono / WhatsApp" htmlFor="cc-bp-phone">
              <Input
                id="cc-bp-phone"
                type="tel"
                value={draft.phone}
                onChange={(e) => patchDraft({ phone: e.target.value })}
                placeholder="+54 9 11 1234-5678"
              />
            </DsField>
            <DsField label="Sitio web" htmlFor="cc-bp-web" hint="Opcional">
              <Input
                id="cc-bp-web"
                type="url"
                value={draft.website}
                onChange={(e) => patchDraft({ website: e.target.value })}
                placeholder="https://tuestudio.com"
              />
            </DsField>
            <DsField label="Instagram" htmlFor="cc-bp-ig" hint="Opcional">
              <Input
                id="cc-bp-ig"
                value={draft.instagram}
                onChange={(e) => patchDraft({ instagram: e.target.value })}
                placeholder="@tuestudio"
              />
            </DsField>
          </div>
        </ProfileSection>

        <ProfileSection
          id="cc-business-profile-address"
          highlighted={highlightSection === "address"}
          title="Dirección"
          description="Ubicación de tu estudio u oficina comercial. También se usa para invitaciones a eventos cercanos en ComprameLaFoto."
        >
          <div className="cc-business-profile__grid cc-business-profile__grid--address">
            <div className="cc-business-profile__geo">
              <AddressGeoSearch
                address={draft.address}
                city={draft.city}
                province={draft.province}
                country={draft.country}
                latitude={latNum}
                longitude={lngNum}
                onAddressChange={(value) => patchDraft({ address: value })}
                onCityChange={(value) => patchDraft({ city: value })}
                onProvinceChange={(value) => patchDraft({ province: value })}
                onCountryChange={(value) => patchDraft({ country: value })}
                onCoordsChange={(lat, lon) =>
                  patchDraft({ latitude: String(lat), longitude: String(lon) })
                }
                placeholder="Buscar dirección de tu estudio"
              />
            </div>
            <DsField label="Dirección" htmlFor="cc-bp-address">
              <Input
                id="cc-bp-address"
                value={draft.address}
                onChange={(e) => patchDraft({ address: e.target.value })}
              />
            </DsField>
            <DsField label="Ciudad" htmlFor="cc-bp-city">
              <Input
                id="cc-bp-city"
                value={draft.city}
                onChange={(e) => patchDraft({ city: e.target.value })}
              />
            </DsField>
            <DsField label="Provincia / estado" htmlFor="cc-bp-province">
              <Input
                id="cc-bp-province"
                value={draft.province}
                onChange={(e) => patchDraft({ province: e.target.value })}
              />
            </DsField>
            <DsField label="País" htmlFor="cc-bp-country">
              <Input
                id="cc-bp-country"
                value={draft.country}
                onChange={(e) => patchDraft({ country: e.target.value })}
              />
            </DsField>
            <DsField label="Código postal" htmlFor="cc-bp-postal" hint="Opcional">
              <Input
                id="cc-bp-postal"
                value={draft.postalCode}
                onChange={(e) => patchDraft({ postalCode: e.target.value })}
              />
            </DsField>
            <DsField label="Latitud" htmlFor="cc-bp-lat" hint="Opcional">
              <Input
                id="cc-bp-lat"
                value={draft.latitude}
                onChange={(e) => patchDraft({ latitude: e.target.value })}
                inputMode="decimal"
              />
            </DsField>
            <DsField label="Longitud" htmlFor="cc-bp-lng" hint="Opcional">
              <Input
                id="cc-bp-lng"
                value={draft.longitude}
                onChange={(e) => patchDraft({ longitude: e.target.value })}
                inputMode="decimal"
              />
            </DsField>
          </div>
        </ProfileSection>

        <ProfileSection title="Logo / marca" description="Se muestra en el encabezado del presupuesto.">
          <div className="cc-business-profile__logo">
            {draft.logoUrl ? (
              <div className="cc-business-profile__logo-preview">
                <Image
                  src={draft.logoUrl}
                  alt="Logo de la empresa"
                  width={120}
                  height={64}
                  className="cc-business-profile__logo-img"
                  unoptimized
                />
              </div>
            ) : null}
            <DsField
              label="URL del logo"
              htmlFor="cc-bp-logo-url"
              hint="Pegá un enlace directo a tu logo o subí un PNG."
            >
              <Input
                id="cc-bp-logo-url"
                type="url"
                value={draft.logoUrl}
                onChange={(e) => patchDraft({ logoUrl: e.target.value })}
                placeholder="https://…"
              />
            </DsField>
            <DsField label="Subir logo (PNG)" htmlFor="cc-bp-logo-file">
              <input
                id="cc-bp-logo-file"
                type="file"
                accept="image/png"
                className="cc-business-profile__file-input min-h-[44px] w-full text-sm"
                disabled={uploadingLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
            </DsField>
            {uploadingLogo ? (
              <p className="m-0 text-sm text-[var(--cc-color-muted)]">Subiendo logo…</p>
            ) : null}
            {logoError ? (
              <p className="m-0 text-sm text-red-700" role="alert">
                {logoError}
              </p>
            ) : null}
          </div>
        </ProfileSection>
      </div>

      <footer className="cc-business-profile-modal__footer">
        <CuantoCobroButton
          type="button"
          variant="outline"

          className="min-h-[44px] w-full sm:w-auto"
          onClick={handleCancel}
        >
          Cancelar
        </CuantoCobroButton>
        <CuantoCobroButton
          type="button"
          variant="primary"


          className="min-h-[44px] w-full sm:w-auto sm:min-w-[10rem]"
          onClick={handleSave}
          disabled={saving || loadingSeed}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </CuantoCobroButton>
      </footer>
    </AppModal>
  );
}
