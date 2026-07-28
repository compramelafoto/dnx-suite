"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IncludedProductsSection } from "@/components/public-registration/IncludedProductsSection";
import { createPublicRegistrationAction } from "@/lib/public-registration/actions/public-registration";
import type { PublicRegistrationContextDto } from "@/lib/public-registration/domain/types";
import {
  formatHoldExpiry,
  formatPublicPrice,
  kitKindLabel,
} from "@/lib/public-registration/ui/format";
import { marathonPath } from "@/config/navigation";

type Props = {
  context: PublicRegistrationContextDto;
  idempotencyKey: string;
};

type Step = "venue" | "ticket" | "participant" | "review";

function stableIdempotencyKey(editionSlug: string, seed: string): string {
  if (typeof window === "undefined") return seed;
  const storageKey = `ck_reg_idem_${editionSlug}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing && existing.length >= 8) return existing;
    sessionStorage.setItem(storageKey, seed);
    return seed;
  } catch {
    return seed;
  }
}

export function PublicRegistrationWizard({ context, idempotencyKey }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const idemRef = useRef(idempotencyKey);
  const [idemKey, setIdemKey] = useState(idempotencyKey);

  useEffect(() => {
    const key = stableIdempotencyKey(context.edition.slug, idempotencyKey);
    idemRef.current = key;
    setIdemKey(key);
  }, [context.edition.slug, idempotencyKey]);
  const [step, setStep] = useState<Step>(
    context.venues.length > 1 ? "venue" : "ticket",
  );
  const [venueId, setVenueId] = useState<string>(
    context.venues.length === 1 ? context.venues[0]!.id : "",
  );
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [variantChoices, setVariantChoices] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptImage, setAcceptImage] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [profilePhotoAssetId, setProfilePhotoAssetId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [imageUsageConsent, setImageUsageConsent] = useState(false);
  const [socialPublicationConsent, setSocialPublicationConsent] = useState(false);

  const ticketsForVenue = useMemo(() => {
    return context.tickets.filter((t) => {
      if (t.venueId && venueId && t.venueId !== venueId) return false;
      return true;
    });
  }, [context.tickets, venueId]);

  const selectedTicket = ticketsForVenue.find((t) => t.id === ticketTypeId) ?? null;
  const selectedVenue =
    context.venues.find((v) => v.id === venueId) ??
    (context.venues.length === 1 ? context.venues[0]! : null);

  const steps: Step[] =
    context.venues.length > 1
      ? ["venue", "ticket", "participant", "review"]
      : ["ticket", "participant", "review"];
  const stepIndex = steps.indexOf(step);

  function goNext() {
    setError(null);
    if (step === "venue") {
      if (!venueId) {
        setError("Elegí una sede para continuar.");
        return;
      }
      setStep("ticket");
      return;
    }
    if (step === "ticket") {
      if (!selectedTicket) {
        setError("Elegí una entrada.");
        return;
      }
      if (selectedTicket.isSoldOut || selectedTicket.salesStatus !== "open") {
        setError("Esa entrada no está disponible para inscripción.");
        return;
      }
      for (const p of selectedTicket.products) {
        if (p.requiresVariantChoice && !variantChoices[p.productId]) {
          setError(`Elegí el talle de ${p.productName}.`);
          return;
        }
      }
      setStep("participant");
      return;
    }
    if (step === "participant") {
      const errs: Record<string, string> = {};
      if (firstName.trim().length < 2) errs.firstName = "Nombre requerido.";
      if (lastName.trim().length < 2) errs.lastName = "Apellido requerido.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = "Email inválido.";
      }
      if (!acceptTerms) errs.acceptTerms = "Obligatorio.";
      if (!acceptPrivacy) errs.acceptPrivacy = "Obligatorio.";
      if (!instagramHandle.trim()) errs.instagramHandle = "Instagram requerido.";
      if (!profilePhotoAssetId) errs.profilePhotoAssetId = "Subí una foto de perfil.";
      if (!imageUsageConsent) errs.imageUsageConsent = "Obligatorio.";
      if (!socialPublicationConsent) errs.socialPublicationConsent = "Obligatorio.";
      setFieldErrors(errs);
      if (Object.keys(errs).length) {
        setError("Completá los datos obligatorios y los consentimientos.");
        return;
      }
      setStep("review");
    }
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/public/registration/profile-photo", { method: "POST", body: form });
      const result = (await response.json()) as { ok: boolean; assetId?: string; error?: string };
      if (!result.ok || !result.assetId) throw new Error(result.error ?? "No se pudo subir la foto.");
      setProfilePhotoAssetId(result.assetId);
    } catch (err) {
      setProfilePhotoAssetId("");
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function submit() {
    if (!selectedTicket) return;
    setError(null);
    const fd = new FormData();
    fd.set("editionSlug", context.edition.slug);
    fd.set("venueId", venueId || selectedTicket.venueId || "");
    fd.set("ticketTypeId", selectedTicket.id);
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
    fd.set("country", "AR");
    if (acceptTerms) fd.set("acceptTerms", "true");
    if (acceptPrivacy) fd.set("acceptPrivacy", "true");
    if (acceptImage) fd.set("acceptImage", "true");
    fd.set("instagramHandle", instagramHandle);
    fd.set("profilePhotoAssetId", profilePhotoAssetId);
    if (imageUsageConsent) fd.set("imageUsageConsent", "true");
    if (socialPublicationConsent) fd.set("socialPublicationConsent", "true");
    fd.set("consentVersion", "2026-08-social-v1");
    fd.set("idempotencyKey", idemRef.current || idemKey);

    startTransition(async () => {
      const result = await createPublicRegistrationAction(undefined, fd);
      if (!result.ok || !result.data) {
        setError(result.message ?? "No se pudo crear la inscripción.");
        setFieldErrors(result.errors ?? {});
        if (result.code === "RATE_LIMITED") setStep("review");
        else setStep("participant");
        return;
      }
      try {
        sessionStorage.removeItem(`ck_reg_idem_${context.edition.slug}`);
      } catch {
        /* ignore */
      }
      const href = `${marathonPath(context.edition.slug)}/inscripcion/resumen/${result.data.registrationId}?t=${encodeURIComponent(result.data.accessToken)}`;
      router.push(href);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-8">
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progreso de inscripción">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${
                i === stepIndex
                  ? "bg-ck-yellow text-ck-bg"
                  : i < stepIndex
                    ? "bg-ck-surface-elevated text-ck-text"
                    : "bg-ck-bg text-ck-text-muted"
              }`}
            >
              {i + 1}.{" "}
              {s === "venue"
                ? "Sede"
                : s === "ticket"
                  ? "Entrada"
                  : s === "participant"
                    ? "Datos"
                    : "Confirmar"}
            </li>
          ))}
        </ol>

        {error ? (
          <p className="text-sm text-[var(--ck-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {step === "venue" ? (
          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold">Elegí la sede</legend>
            <div className="grid gap-4">
              {context.venues.map((v) => (
                <label
                  key={v.id}
                  className={`block cursor-pointer rounded-[var(--ck-radius-card)] border p-5 ${
                    venueId === v.id ? "border-ck-yellow" : "border-ck-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="venue"
                    className="sr-only"
                    checked={venueId === v.id}
                    onChange={() => setVenueId(v.id)}
                  />
                  <span className="font-semibold">{v.name}</span>
                  <span className="mt-2 block text-sm text-ck-text-secondary">
                    {[v.city, v.province].filter(Boolean).join(", ")}
                    {v.address ? ` · ${v.address}` : ""}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === "ticket" ? (
          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold">Elegí tu entrada</legend>
            {ticketsForVenue.length === 0 ? (
              <p role="status" className="text-sm text-ck-text-muted">
                No hay entradas vendibles para esta selección.
              </p>
            ) : (
              <div className="grid gap-4">
                {ticketsForVenue.map((t) => {
                  const disabled = t.isSoldOut || t.salesStatus !== "open";
                  return (
                    <label
                      key={t.id}
                      className={`block rounded-[var(--ck-radius-card)] border p-5 ${
                        disabled
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      } ${ticketTypeId === t.id ? "border-ck-yellow" : "border-ck-border"}`}
                    >
                      <input
                        type="radio"
                        name="ticket"
                        className="sr-only"
                        disabled={disabled}
                        checked={ticketTypeId === t.id}
                        onChange={() => setTicketTypeId(t.id)}
                      />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="font-semibold">{t.name}</span>
                          <span className="ml-2 text-xs text-ck-text-muted">
                            {kitKindLabel(t.kitKind)}
                          </span>
                          {t.description ? (
                            <p className="mt-2 text-sm text-ck-text-secondary">
                              {t.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatPublicPrice(
                              context.currentPricePhase?.amount ?? t.priceAmount,
                              context.currentPricePhase?.currency ?? t.currency,
                            )}
                          </p>
                          {context.currentPricePhase ? (
                            <p className="text-xs text-ck-text-muted">
                              {context.currentPricePhase.name}
                            </p>
                          ) : null}
                          <p className="text-xs text-ck-text-muted">
                            {t.isUnlimited
                              ? "Cupo ilimitado"
                              : t.isSoldOut
                                ? "Agotada"
                                : `Disp. ${t.available}`}
                          </p>
                        </div>
                      </div>
                      <IncludedProductsSection
                        products={t.products}
                        selected={ticketTypeId === t.id}
                        variantChoices={variantChoices}
                        onVariantChange={(productId, variantId) =>
                          setVariantChoices((prev) => ({
                            ...prev,
                            [productId]: variantId,
                          }))
                        }
                        emptyPhaseMessage={
                          context.currentPricePhase &&
                          !context.currentPricePhase.includesPhysicalMerch
                            ? "Esta fase incluye la participación en Clickatón. La remera puede adquirirse por separado en la tienda."
                            : null
                        }
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        ) : null}

        {step === "participant" ? (
          <fieldset className="space-y-6">
            <legend className="text-xl font-semibold">Tus datos</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="firstName"
                label="Nombre *"
                value={firstName}
                onChange={setFirstName}
                error={fieldErrors.firstName}
              />
              <Field
                id="instagramHandle"
                label="Usuario de Instagram *"
                value={instagramHandle}
                onChange={setInstagramHandle}
                error={fieldErrors.instagramHandle}
              />
              <Field
                id="lastName"
                label="Apellido *"
                value={lastName}
                onChange={setLastName}
                error={fieldErrors.lastName}
              />
              <Field
                id="email"
                label="Email *"
                type="email"
                value={email}
                onChange={setEmail}
                error={fieldErrors.email}
              />
              <Field
                id="phone"
                label="Teléfono"
                value={phone}
                onChange={setPhone}
                error={fieldErrors.phone}
              />
              <Field
                id="documentNumber"
                label="Documento"
                value={documentNumber}
                onChange={setDocumentNumber}
              />
              <Field id="city" label="Localidad" value={city} onChange={setCity} />
              <Field
                id="province"
                label="Provincia"
                value={province}
                onChange={setProvince}
              />
            </div>
            <label className="block text-sm">
              <span className="font-medium">Foto de perfil *</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full"
                disabled={uploadingPhoto}
                onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)}
              />
              <span className="mt-1 block text-ck-text-secondary">
                {uploadingPhoto ? "Subiendo foto…" : profilePhotoAssetId ? "Foto cargada." : "JPG, PNG o WEBP. Mínimo 400×400 px."}
              </span>
            </label>
            <div className="space-y-3 text-sm">
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  Acepto las{" "}
                  <a className="underline" href={context.legal.termsPath} target="_blank" rel="noreferrer">
                    bases y condiciones
                  </a>{" "}
                  y las{" "}
                  <a className="underline" href={context.legal.rulesAnchor}>
                    reglas de la edición
                  </a>
                  .
                </span>
              </label>
              <label className="flex gap-3">
                <input type="checkbox" checked={imageUsageConsent} onChange={(e) => setImageUsageConsent(e.target.checked)} />
                <span>Autorizo el uso de mi foto para mi placa de bienvenida.</span>
              </label>
              <label className="flex gap-3">
                <input type="checkbox" checked={socialPublicationConsent} onChange={(e) => setSocialPublicationConsent(e.target.checked)} />
                <span>Autorizo la publicación social de mi placa. No se publicará automáticamente.</span>
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={acceptPrivacy}
                  onChange={(e) => setAcceptPrivacy(e.target.checked)}
                />
                <span>
                  Acepto la{" "}
                  <a className="underline" href={context.legal.privacyPath} target="_blank" rel="noreferrer">
                    política de privacidad
                  </a>{" "}
                  y el tratamiento de mis datos.
                </span>
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={acceptImage}
                  onChange={(e) => setAcceptImage(e.target.checked)}
                />
                <span>Autorizo el uso de imagen (opcional).</span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {step === "review" && selectedTicket ? (
          <section className="space-y-4" aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-xl font-semibold">
              Revisá tu inscripción
            </h2>
            <p className="rounded border border-ck-yellow/40 bg-ck-yellow/10 p-4 text-sm" role="status">
              La inscripción todavía no está confirmada. La confirmación dependerá del
              pago o validación correspondiente. La reserva de cupo es temporal
              {selectedTicket.holdMinutes
                ? ` (aprox. ${selectedTicket.holdMinutes} minutos)`
                : ""}
              .
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ck-text-secondary">Edición</dt>
                <dd>{context.edition.name}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Sede</dt>
                <dd>{selectedVenue?.name ?? "Sin sede específica"}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Entrada</dt>
                <dd>{selectedTicket.name}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Importe</dt>
                <dd>
                  {formatPublicPrice(
                    selectedTicket.priceAmount,
                    selectedTicket.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Participante</dt>
                <dd>
                  {firstName} {lastName} · {email}
                </dd>
              </div>
            </dl>
            {selectedTicket.products.length > 0 ? (
              <div className="rounded border border-ck-border p-4">
                <h3 className="font-semibold">Incluido en la inscripción</h3>
                <ul className="mt-3 space-y-3 text-sm">
                  {selectedTicket.products.map((p) => {
                    const choiceId = variantChoices[p.productId];
                    const chosen = p.variants.find((v) => v.id === choiceId);
                    return (
                      <li key={p.productId}>
                        <p className="font-medium">{p.productName}</p>
                        <p className="text-ck-text-secondary">
                          Cantidad: {p.quantity} · Incluida · Precio adicional:{" "}
                          {formatPublicPrice(0, selectedTicket.currency)}
                        </p>
                        {p.requiresVariantChoice ? (
                          <p>
                            Talle seleccionado:{" "}
                            <strong>{chosen?.name ?? "—"}</strong>
                          </p>
                        ) : p.fixedVariant ? (
                          <p>Talle: {p.fixedVariant.name}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setStep(steps[stepIndex - 1]!)}
              className="w-full sm:w-auto"
            >
              Volver
            </Button>
          ) : (
            <span />
          )}
          {step !== "review" ? (
            <Button
              type="button"
              disabled={pending}
              onClick={goNext}
              className="w-full sm:w-auto"
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending}
              onClick={submit}
              className="w-full sm:w-auto"
            >
              {pending ? "Reservando…" : "Confirmar reserva"}
            </Button>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-[var(--ck-radius-card)] border border-ck-border p-5 lg:sticky lg:top-28">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ck-text-muted">
          Resumen
        </h2>
        <p className="mt-3 font-semibold">{context.edition.name}</p>
        <p className="mt-2 text-sm text-ck-text-secondary">
          {selectedVenue?.name ?? "Sede a elegir"}
        </p>
        <p className="mt-2 text-sm text-ck-text-secondary">
          {selectedTicket?.name ?? "Entrada a elegir"}
        </p>
        <p className="mt-4 text-lg font-semibold">
          {selectedTicket
            ? formatPublicPrice(selectedTicket.priceAmount, selectedTicket.currency)
            : "—"}
        </p>
        {selectedTicket ? (
          <p className="mt-2 text-xs text-ck-text-muted">
            Reserva temporal ~{selectedTicket.holdMinutes} min · vence aprox.{" "}
            {formatHoldExpiry(
              new Date(Date.now() + selectedTicket.holdMinutes * 60_000),
            )}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
}) {
  const describedBy = props.error ? `${props.id}-error` : undefined;
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
        aria-describedby={describedBy}
        aria-invalid={Boolean(props.error)}
        className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
      />
      {props.error ? (
        <p id={describedBy} className="mt-1 text-xs text-[var(--ck-danger)]" role="alert">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}
