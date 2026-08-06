"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ContestFormField,
  ContentToActions,
  contestControlClass,
  contestSelectClass,
  RulesDocument,
  Stack,
  Surface,
} from "../../../components/contest-public";
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
      <Surface className="mt-8" padding="lg" data-testid="inscription-success">
        <Stack gap="md">
          <p className="fr-type-h3" style={{ color: "var(--cv-foreground)" }}>
            {isFree ? "Inscripción confirmada" : "Inscripción registrada (pago pendiente)"}
          </p>
          <p className="fr-type-body">Tu número de inscripción:</p>
          <p className="text-2xl font-semibold text-gold" data-testid="registration-number">
            {registrationNumber}
          </p>
          <ContentToActions className="fr-contest-cluster fr-contest-cluster--gap-sm">
            <Link href={`/concursos/${contestSlug}/inscripcion`} className="fr-btn fr-btn-primary">
              Continuar con la fotografía
            </Link>
            <Link href="/participaciones" className="fr-btn fr-btn-secondary">
              Ir a mis participaciones
            </Link>
          </ContentToActions>
        </Stack>
      </Surface>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 fr-contest-stack fr-contest-stack--lg"
      data-testid="inscription-form"
      data-contest-id={contestId}
    >
      {isSantaFeEnFocoSlug(contestSlug) ? (
        <Surface padding="md">
          <h2 className="fr-type-h3" style={{ color: "var(--cv-foreground)" }}>
            Participación abierta
          </h2>
          <p className="fr-type-body-small mt-2" data-testid="open-participation-note">
            La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La fotografía
            presentada deberá haber sido realizada dentro del territorio de la Provincia de Santa Fe y durante
            el período oficial establecido para el concurso.
          </p>
        </Surface>
      ) : null}

      <Surface padding="md">
        <Stack gap="md">
          <h2 className="fr-type-h3" style={{ color: "var(--cv-foreground)" }}>
            Datos de inscripción
          </h2>
          {singleCategory ? (
            <div>
              <p className="fr-type-label">Categoría</p>
              <p className="mt-2" style={{ color: "var(--cv-foreground)" }}>
                {categories[0]?.name}
              </p>
              <p className="fr-type-helper mt-1">Hasta {categories[0]?.maxFiles} fotografía(s).</p>
            </div>
          ) : (
            <ContestFormField id="inscription-category" label="Elegí una categoría" required>
              <select
                id="inscription-category"
                className={contestSelectClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                data-testid="inscription-category"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (máx. {c.maxFiles})
                  </option>
                ))}
              </select>
            </ContestFormField>
          )}
          <p className="fr-type-helper" data-testid="category-hint">
            {categoryHint}
          </p>
          {needsArgra ? (
            <ContestFormField
              id="inscription-argra"
              label="Número de socio de ARGRA"
              required
              hint="El número será utilizado únicamente para verificar la elegibilidad en esta categoría. No se publica en perfiles ni resultados."
            >
              <input
                id="inscription-argra"
                className={contestControlClass}
                value={argraMembershipNumber}
                onChange={(e) => setArgraMembershipNumber(e.target.value)}
                required
                autoComplete="off"
                data-testid="inscription-argra"
              />
            </ContestFormField>
          ) : null}
          {needsInstagram ? (
            <ContestFormField
              id="inscription-instagram"
              label="Instagram"
              required
              hint="Obligatorio. Podés ingresar @usuario o el enlace de tu perfil. No se usa como identidad pública de la obra."
            >
              <input
                id="inscription-instagram"
                className={contestControlClass}
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                required
                autoComplete="off"
                placeholder="@tu_usuario"
                data-testid="inscription-instagram"
              />
            </ContestFormField>
          ) : null}
          <ContestFormField
            id="inscription-age"
            label="Edad (años)"
            required
            hint="Edad mínima: 16 años. Entre 16 y 17 se solicita autorización de un adulto responsable."
            className="fr-contest-field--inline"
          >
            <input
              id="inscription-age"
              type="number"
              min={16}
              max={120}
              inputMode="numeric"
              className={`${contestControlClass} fr-contest-control--narrow`}
              value={declaredAgeYears}
              onChange={(e) => setDeclaredAgeYears(e.target.value)}
              required
              data-testid="inscription-age"
            />
          </ContestFormField>
        </Stack>
      </Surface>

      <Surface padding="md" id="bases-inscripcion">
        <Stack gap="md">
          <div>
            <h2 className="fr-type-h3" style={{ color: "var(--cv-foreground)" }}>
              Bases publicadas
            </h2>
            <p className="fr-type-caption mt-1">
              {rules.title} · versión {rules.versionNumber}
            </p>
            {rules.publishedAt ? (
              <p className="fr-type-caption mt-1">
                Publicada: {new Date(rules.publishedAt).toLocaleString("es-AR")}
              </p>
            ) : null}
          </div>
          <div className="fr-rules-scroll rounded-[var(--cv-radius)] border border-[var(--cv-border)] bg-[var(--cv-background)] p-4">
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
              Acepto las bases publicadas (versión {rules.versionNumber}). Esta aceptación queda registrada con
              fecha, versión y hashes.
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
          <label className="fr-contest-check" style={{ color: "var(--cv-muted-foreground)" }}>
            <input
              type="checkbox"
              checked={promotionalOptIn}
              onChange={(e) => setPromotionalOptIn(e.target.checked)}
              data-testid="inscription-promo-optin"
            />
            <span>Deseo recibir comunicaciones promocionales opcionales (no obligatorio).</span>
          </label>
        </Stack>
      </Surface>

      {needsMinorAuth ? (
        <Surface padding="md" className="fr-contest-surface--warning">
          <Stack gap="md">
            <h2 className="fr-type-h3" style={{ color: "var(--cv-foreground)" }}>
              Autorización de menor
            </h2>
            <p className="fr-type-helper">{MINOR_CONSENT_NOTICE}</p>
            <ContestFormField id="inscription-guardian-name" label="Nombre del adulto responsable" required>
              <input
                id="inscription-guardian-name"
                className={contestControlClass}
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                data-testid="inscription-guardian-name"
              />
            </ContestFormField>
            <ContestFormField id="inscription-guardian-relationship" label="Vínculo" required>
              <input
                id="inscription-guardian-relationship"
                className={contestControlClass}
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Padre / Madre / Tutor legal"
                data-testid="inscription-guardian-relationship"
              />
            </ContestFormField>
            <label className="fr-contest-check">
              <input
                type="checkbox"
                checked={minorAccepted}
                onChange={(e) => setMinorAccepted(e.target.checked)}
                data-testid="inscription-minor-auth"
              />
              <span>Declaro como adulto responsable autorizar la participación del menor.</span>
            </label>
          </Stack>
        </Surface>
      ) : null}

      {error ? (
        <div className="fr-contest-alert-error px-4 py-3" role="alert">
          {error}
        </div>
      ) : null}

      <ContentToActions
        bordered
        className="fr-contest-cluster fr-contest-cluster--gap-sm"
      >
        <button
          type="submit"
          disabled={pending}
          className="fr-btn fr-btn-primary"
          data-testid="inscription-submit"
        >
          {pending ? "Confirmando…" : isFree ? "Confirmar inscripción gratuita" : "Continuar a pago"}
        </button>
        <Link href={`/concursos/${contestSlug}`} className="fr-btn fr-btn-secondary">
          Cancelar
        </Link>
      </ContentToActions>
    </form>
  );
}
