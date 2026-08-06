"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RulesDocument } from "../../../components/contest-public";
import {
  FormField,
  Notice,
  PrimaryButton,
  SecondaryButton,
} from "../../../components/public-ui";
import { isSantaFeEnFocoSlug } from "../../../lib/fotorank/contest-visual";
import { MINOR_CONSENT_NOTICE } from "../../../lib/fotorank/rules-lifecycle/minors";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  maxFiles: number;
  description?: string | null;
};

type Props = {
  contestId: string;
  contestSlug: string;
  categories: CategoryOption[];
  rules: { id: string; versionNumber: number; title: string; content: string; publishedAt?: string | null };
  isFree: boolean;
};

const CATEGORY_HINTS: Record<string, string> = {
  "fotografo-profesional":
    "Para personas que participan como fotógrafos profesionales. La fotografía debe haber sido realizada con una cámara fotográfica. No se admiten fotografías tomadas con teléfono celular.",
  "fotografo-amateur":
    "Para fotógrafos aficionados. Se admiten fotografías realizadas con teléfono celular o cámara fotográfica.",
  "reportero-grafico":
    "Para reporteros gráficos. Es obligatorio ingresar un número de socio de ARGRA, sujeto a verificación por la organización.",
  "fotografia-aerea":
    "Para fotografías realizadas con dron. La organización podrá solicitar información técnica o documentación adicional.",
  profesional:
    "Para personas que participan como fotógrafos profesionales. La fotografía debe haber sido realizada con una cámara fotográfica. No se admiten fotografías tomadas con teléfono celular.",
  amateur:
    "Para fotógrafos aficionados. Se admiten fotografías realizadas con teléfono celular o cámara fotográfica.",
  "fotografia-aerea-dron":
    "Para fotografías realizadas con dron. La organización podrá solicitar información técnica o documentación adicional.",
};

function requiresArgra(slug: string): boolean {
  return slug === "reportero-grafico" || slug.includes("reportero");
}

export function InscriptionForm({ contestId, contestSlug, categories, rules, isFree }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [acceptedLicense, setAcceptedLicense] = useState(false);
  const [promotionalOptIn, setPromotionalOptIn] = useState(false);
  const [declaredAgeYears, setDeclaredAgeYears] = useState<string>("");
  const [argraMembershipNumber, setArgraMembershipNumber] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [minorAccepted, setMinorAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const singleCategory = categories.length === 1;
  const selected = categories.find((c) => c.id === categoryId) ?? categories[0];
  const ageNum = declaredAgeYears === "" ? null : Number(declaredAgeYears);
  const needsMinorAuth = useMemo(
    () => ageNum != null && Number.isFinite(ageNum) && ageNum >= 16 && ageNum < 18,
    [ageNum],
  );
  const needsArgra = selected ? requiresArgra(selected.slug) : false;
  const needsInstagram = isSantaFeEnFocoSlug(contestSlug);
  const categoryHint =
    selected?.description ||
    (selected ? CATEGORY_HINTS[selected.slug] : null) ||
    "Una fotografía por participante; una única categoría.";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Elegí una categoría.");
      return;
    }
    if (needsArgra && !argraMembershipNumber.trim()) {
      setError("Para Reportero Gráfico debés ingresar tu número de socio de ARGRA.");
      return;
    }
    if (needsInstagram && !instagramHandle.trim()) {
      setError("Instagram es obligatorio para participar.");
      return;
    }
    if (!acceptedRules) {
      setError("Debés aceptar las bases para continuar.");
      return;
    }
    if (!acceptedLicense) {
      setError("Debés aceptar la licencia necesaria para participar.");
      return;
    }
    if (ageNum == null || !Number.isFinite(ageNum)) {
      setError("Indicá tu edad en años.");
      return;
    }
    if (needsMinorAuth && (!minorAccepted || !guardianName.trim() || !relationship.trim())) {
      setError(MINOR_CONSENT_NOTICE);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/fotorank/contests/${contestId}/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId,
            rulesVersionId: rules.id,
            rulesAccepted: true,
            licenseAccepted: true,
            declaredAgeYears: Math.floor(ageNum),
            promotionalOptIn,
            argraMembershipNumber: needsArgra ? argraMembershipNumber : undefined,
            instagramHandle: needsInstagram ? instagramHandle : undefined,
            minorAuthorization: needsMinorAuth
              ? {
                  guardianName,
                  relationship,
                  declarationAccepted: true,
                }
              : undefined,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          registration?: { registrationNumber?: string; status?: string };
          error?: { message?: string };
        };
        if (!res.ok || !data.ok) {
          setError(data.error?.message ?? "No se pudo completar la inscripción.");
          return;
        }
        setRegistrationNumber(data.registration?.registrationNumber ?? null);
        router.refresh();
      } catch {
        setError("Error de red. Intentá de nuevo.");
      }
    });
  }

  if (registrationNumber) {
    return (
      <section className="fr-public-card" data-testid="inscription-success">
        <h2 className="fr-public-title text-xl md:text-2xl">
          {isFree ? "Inscripción confirmada" : "Inscripción registrada (pago pendiente)"}
        </h2>
        <p className="fr-public-body">Tu número de inscripción:</p>
        <p
          className="text-2xl font-semibold text-[var(--primary)]"
          data-testid="registration-number"
        >
          {registrationNumber}
        </p>
        <div className="fr-public-card-actions">
          <PrimaryButton href={`/concursos/${contestSlug}/inscripcion`}>
            Continuar con la fotografía
          </PrimaryButton>
          <SecondaryButton href="/participaciones">Ir a mis participaciones</SecondaryButton>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-8"
      data-testid="inscription-form"
      data-contest-id={contestId}
    >
      {isSantaFeEnFocoSlug(contestSlug) ? (
        <Notice tone="info" title="Participación abierta">
          <p data-testid="open-participation-note">
            La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La
            fotografía presentada deberá haber sido realizada dentro del territorio de la Provincia
            de Santa Fe y durante el período oficial establecido para el concurso.
          </p>
        </Notice>
      ) : null}

      <section className="fr-public-card" aria-labelledby="inscription-data-title">
        <h2 id="inscription-data-title" className="fr-public-title text-xl">
          Datos de inscripción
        </h2>
        {singleCategory ? (
          <div className="fr-public-meta-list__item">
            <p className="fr-public-field__label">Categoría</p>
            <p className="text-[var(--foreground)]">{categories[0]?.name}</p>
            <p className="fr-public-field__helper">Hasta {categories[0]?.maxFiles} fotografía(s).</p>
          </div>
        ) : (
          <FormField
            id="inscription-category"
            as="select"
            label="Elegí una categoría"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            data-testid="inscription-category"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (máx. {c.maxFiles})
              </option>
            ))}
          </FormField>
        )}
        <p className="fr-public-field__helper" data-testid="category-hint">
          {categoryHint}
        </p>
        {needsArgra ? (
          <FormField
            id="inscription-argra"
            label="Número de socio de ARGRA"
            required
            helper="El número será utilizado únicamente para verificar la elegibilidad en esta categoría. No se publica en perfiles ni resultados."
            value={argraMembershipNumber}
            onChange={(e) => setArgraMembershipNumber(e.target.value)}
            autoComplete="off"
            data-testid="inscription-argra"
          />
        ) : null}
        {needsInstagram ? (
          <FormField
            id="inscription-instagram"
            label="Instagram"
            required
            helper="Obligatorio. Podés ingresar @usuario o el enlace de tu perfil. No se usa como identidad pública de la obra."
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            autoComplete="off"
            placeholder="@tu_usuario"
            data-testid="inscription-instagram"
          />
        ) : null}
        <FormField
          id="inscription-age"
          type="number"
          label="Edad (años)"
          required
          helper="Edad mínima: 16 años. Entre 16 y 17 se solicita autorización de un adulto responsable."
          min={16}
          max={120}
          inputMode="numeric"
          value={declaredAgeYears}
          onChange={(e) => setDeclaredAgeYears(e.target.value)}
          data-testid="inscription-age"
          className="max-w-[12rem]"
        />
      </section>

      <section className="fr-public-card" id="bases-inscripcion" aria-labelledby="bases-title">
        <div className="flex flex-col gap-3">
          <h2 id="bases-title" className="fr-public-title text-xl">
            Bases publicadas
          </h2>
          <p className="fr-public-body text-sm">
            {rules.title} · versión {rules.versionNumber}
          </p>
          {rules.publishedAt ? (
            <p className="fr-public-body text-sm">
              Publicada: {new Date(rules.publishedAt).toLocaleString("es-AR")}
            </p>
          ) : null}
        </div>
        <div className="fr-rules-scroll">
          <RulesDocument content={rules.content} />
        </div>
        <label className="fr-contest-check">
          <input
            type="checkbox"
            checked={acceptedRules}
            onChange={(e) => setAcceptedRules(e.target.checked)}
            data-testid="inscription-accept-rules"
          />
          <span>
            Acepto las bases publicadas (versión {rules.versionNumber}). Esta aceptación queda
            registrada con fecha, versión y hashes.
          </span>
        </label>
        <label className="fr-contest-check">
          <input
            type="checkbox"
            checked={acceptedLicense}
            onChange={(e) => setAcceptedLicense(e.target.checked)}
            data-testid="inscription-accept-license"
          />
          <span>Acepto la licencia necesaria para participar (obligatoria, separada de las bases).</span>
        </label>
        <label className="fr-contest-check text-[var(--foreground-muted)]">
          <input
            type="checkbox"
            checked={promotionalOptIn}
            onChange={(e) => setPromotionalOptIn(e.target.checked)}
            data-testid="inscription-promo-optin"
          />
          <span>Deseo recibir comunicaciones promocionales opcionales (no obligatorio).</span>
        </label>
      </section>

      {needsMinorAuth ? (
        <Notice tone="warning" title="Autorización de menor">
          <div className="flex flex-col gap-6">
            <p className="fr-public-field__helper">{MINOR_CONSENT_NOTICE}</p>
            <FormField
              id="inscription-guardian-name"
              label="Nombre del adulto responsable"
              required
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              data-testid="inscription-guardian-name"
            />
            <FormField
              id="inscription-guardian-relationship"
              label="Vínculo"
              required
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Padre / Madre / Tutor legal"
              data-testid="inscription-guardian-relationship"
            />
            <label className="fr-contest-check">
              <input
                type="checkbox"
                checked={minorAccepted}
                onChange={(e) => setMinorAccepted(e.target.checked)}
                data-testid="inscription-minor-auth"
              />
              <span>Declaro como adulto responsable autorizar la participación del menor.</span>
            </label>
          </div>
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" title="No se pudo continuar" role="alert">
          <p>{error}</p>
        </Notice>
      ) : null}

      <div className="fr-public-actions">
        <PrimaryButton type="submit" disabled={pending} data-testid="inscription-submit" loading={pending}>
          {pending ? "Confirmando…" : isFree ? "Confirmar inscripción gratuita" : "Continuar a pago"}
        </PrimaryButton>
        <SecondaryButton href={`/concursos/${contestSlug}`}>Cancelar</SecondaryButton>
      </div>
    </form>
  );
}
