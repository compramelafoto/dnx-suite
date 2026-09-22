"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RegistrationShirtSizeStep } from "@/components/public-registration/experience/RegistrationShirtSizeStep";
import { Button } from "@/components/ui/Button";
import { redeemGiftVoucherAction } from "@/lib/gift-vouchers/actions/gift-vouchers";
import type { PublicRegistrationContextDto } from "@/lib/public-registration/domain/types";

/**
 * Activación del regalo: el wizard de inscripción de siempre, menos el pago.
 * Quien recibe el regalo elige sede y talle, y carga sus propios datos.
 */
export function GiftRedeemClient(props: {
  code: string;
  context: PublicRegistrationContextDto;
  editionSlug: string;
  /** Entrada que compró quien regaló: de ahí salen los productos del kit. */
  ticketTypeId: string;
  idempotencyKey: string;
  marathonHref: string;
}) {
  const router = useRouter();
  const venues = props.context.venues;
  const needsVenue = venues.length > 1;

  const [venueId, setVenueId] = useState(needsVenue ? "" : (venues[0]?.id ?? ""));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [variantChoices, setVariantChoices] = useState<Record<string, string>>({});

  const [profilePhotoAssetId, setProfilePhotoAssetId] = useState("");
  const [profilePhotoFileName, setProfilePhotoFileName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los productos salen de LA entrada que compró quien regaló, no de la
  // primera del catálogo: si hay más de una, son kits distintos.
  const shirtProducts = useMemo(() => {
    const ticket =
      props.context.tickets.find((t) => t.id === props.ticketTypeId) ??
      props.context.tickets[0];
    if (!ticket) return [];
    return ticket.products.filter((p) => p.requiresVariantChoice);
  }, [props.context.tickets, props.ticketTypeId]);

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    setProfilePhotoFileName(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/public/registration/profile-photo", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        ok: boolean;
        assetId?: string;
        error?: string;
      };
      if (!result.ok || !result.assetId) {
        throw new Error(result.error ?? "No se pudo subir la foto.");
      }
      setProfilePhotoAssetId(result.assetId);
    } catch (err) {
      setProfilePhotoAssetId("");
      setProfilePhotoFileName("");
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = "";
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function submit() {
    setError(null);

    if (needsVenue && !venueId) {
      setError("Elegí la sede donde vas a participar.");
      return;
    }
    for (const product of shirtProducts) {
      if (!variantChoices[product.productId]) {
        setError(`Elegí el talle de ${product.productName}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("code", props.code);
      fd.set("venueId", venueId);
      fd.set(
        "variantChoices",
        JSON.stringify(
          Object.entries(variantChoices).map(([productId, productVariantId]) => ({
            productId,
            productVariantId,
          })),
        ),
      );
      fd.set("firstName", firstName);
      fd.set("lastName", lastName);
      fd.set("email", email);
      fd.set("phone", phone);
      fd.set("documentNumber", documentNumber);
      fd.set("city", city);
      fd.set("province", province);
      fd.set("instagramHandle", instagramHandle);
      fd.set("emergencyContactName", emergencyContactName);
      fd.set("emergencyContactPhone", emergencyContactPhone);
      fd.set("profilePhotoAssetId", profilePhotoAssetId);
      fd.set("acceptTerms", acceptTerms ? "on" : "");
      fd.set("idempotencyKey", props.idempotencyKey);

      const result = await redeemGiftVoucherAction(undefined, fd);
      if (!result.ok || !result.data) {
        setError(result.message ?? "No pudimos activar tu regalo.");
        return;
      }
      router.push(`/regalo/${props.code}/listo?inscripcion=${result.data.registrationId}`);
    } catch (err) {
      // Sin esto, un fallo de red deja el botón mudo y la persona no sabe
      // si su regalo se activó o no.
      console.error("[clickaton] activar regalo falló:", err);
      setError(
        "No pudimos activar tu regalo. Revisá tu conexión y probá de nuevo; tu regalo sigue guardado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      {needsVenue ? (
        <fieldset className="space-y-4">
          <legend className="text-xl font-semibold md:text-2xl">¿Dónde participás?</legend>
          <div className="space-y-3">
            {venues.map((venue) => (
              <label
                key={venue.id}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--ck-radius-control)] border p-4 ${
                  venueId === venue.id ? "border-ck-yellow" : "border-ck-border"
                }`}
              >
                <input
                  type="radio"
                  name="venue"
                  value={venue.id}
                  checked={venueId === venue.id}
                  onChange={() => setVenueId(venue.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">{venue.name}</span>
                  {venue.city ? (
                    <span className="block text-sm text-ck-text-secondary">{venue.city}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {shirtProducts.map((p) => {
        const activeVariants = [...p.variants]
          .filter((v) => v.isActive && v.availableStock > 0)
          .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
        return (
          <RegistrationShirtSizeStep
            key={p.productId}
            productName={p.productName}
            options={activeVariants.map((v) => ({ value: v.id, label: v.name }))}
            value={variantChoices[p.productId] ?? ""}
            error={null}
            onChange={(variantId) =>
              setVariantChoices((prev) => ({ ...prev, [p.productId]: variantId }))
            }
            sizeChartUrl={p.sizeChartUrl}
            sizeChartDescription={p.sizeChartDescription}
            sizeChartInstructions={p.sizeChartInstructions}
            confirmationHint="Elegí tu talle para confirmar el beneficio al activar tu lugar."
          />
        );
      })}

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold md:text-2xl">Tus datos</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="Nombre *" value={firstName} onChange={setFirstName} />
          <Field
            id="instagramHandle"
            label="Usuario de Instagram *"
            value={instagramHandle}
            onChange={setInstagramHandle}
          />
          <Field id="lastName" label="Apellido *" value={lastName} onChange={setLastName} />
          <Field id="email" label="Email *" type="email" value={email} onChange={setEmail} />
          <Field id="phone" label="Teléfono" value={phone} onChange={setPhone} />
          <Field
            id="documentNumber"
            label="Documento"
            value={documentNumber}
            onChange={setDocumentNumber}
          />
          <Field id="city" label="Ciudad" value={city} onChange={setCity} />
          <Field id="province" label="Provincia" value={province} onChange={setProvince} />
          <Field
            id="emergencyContactName"
            label="Contacto de emergencia"
            value={emergencyContactName}
            onChange={setEmergencyContactName}
          />
          <Field
            id="emergencyContactPhone"
            label="Teléfono de emergencia"
            value={emergencyContactPhone}
            onChange={setEmergencyContactPhone}
          />
        </div>

        <div className="block text-sm">
          <span className="font-medium text-ck-text">Foto de perfil *</span>
          <input
            ref={profilePhotoInputRef}
            id="profilePhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploadingPhoto}
            onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={uploadingPhoto}
            onClick={() => profilePhotoInputRef.current?.click()}
            className={[
              "mt-3 flex w-full min-h-[7.5rem] flex-col items-center justify-center gap-3 rounded-[var(--ck-radius-card)] border-2 border-dashed px-6 py-8 text-center transition-colors",
              profilePhotoAssetId
                ? "border-ck-yellow/70 bg-ck-yellow/5"
                : "border-ck-border-strong bg-ck-surface hover:border-ck-yellow hover:bg-ck-surface-strong",
              uploadingPhoto ? "opacity-70" : "",
            ].join(" ")}
          >
            <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-ck-yellow bg-ck-yellow px-5 text-sm font-semibold text-[var(--ck-text-on-brand)]">
              {uploadingPhoto
                ? "Subiendo…"
                : profilePhotoAssetId
                  ? "Cambiar foto"
                  : "Elegir foto"}
            </span>
            <span className="max-w-sm text-sm text-ck-text-secondary">
              {uploadingPhoto
                ? "Subiendo foto…"
                : profilePhotoAssetId
                  ? `Foto cargada${profilePhotoFileName ? `: ${profilePhotoFileName}` : "."}`
                  : "JPG, PNG o WEBP. Mínimo 400×400 px."}
            </span>
          </button>
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-1"
        />
        <span>
          Acepto las{" "}
          <a href={props.context.legal.rulesAnchor} className="underline">
            bases y condiciones
          </a>{" "}
          de la Clickatón.
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-[var(--ck-danger)]">
          {error}
        </p>
      ) : null}

      <Button type="button" onClick={() => void submit()} disabled={submitting}>
        {submitting ? "Activando tu lugar…" : "Activar mi lugar"}
      </Button>
      <p className="text-sm text-ck-text-secondary">
        No tenés que pagar nada: tu amigo ya lo hizo.
      </p>
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="ck-label text-ck-text">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
      />
    </div>
  );
}
