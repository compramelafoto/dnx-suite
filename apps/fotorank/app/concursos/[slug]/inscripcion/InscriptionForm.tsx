"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MINOR_CONSENT_NOTICE } from "../../../lib/fotorank/rules-lifecycle/minors";

type CategoryOption = { id: string; name: string; maxFiles: number };

type Props = {
  contestId: string;
  contestSlug: string;
  categories: CategoryOption[];
  rules: { id: string; versionNumber: number; title: string; content: string; publishedAt?: string | null };
  isFree: boolean;
};

export function InscriptionForm({ contestId, contestSlug, categories, rules, isFree }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [acceptedLicense, setAcceptedLicense] = useState(false);
  const [promotionalOptIn, setPromotionalOptIn] = useState(false);
  const [declaredAgeYears, setDeclaredAgeYears] = useState<string>("");
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [minorAccepted, setMinorAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const singleCategory = categories.length === 1;
  const ageNum = declaredAgeYears === "" ? null : Number(declaredAgeYears);
  const needsMinorAuth = useMemo(
    () => ageNum != null && Number.isFinite(ageNum) && ageNum >= 16 && ageNum < 18,
    [ageNum],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Elegí una categoría.");
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
      <div className="fr-recuadro mt-10 space-y-6 border border-fr-border bg-fr-card" data-testid="inscription-success">
        <p className="text-lg font-semibold text-fr-primary">
          {isFree ? "Inscripción confirmada" : "Inscripción registrada (pago pendiente)"}
        </p>
        <p className="text-fr-muted">Tu número de inscripción:</p>
        <p className="text-2xl font-semibold text-gold" data-testid="registration-number">
          {registrationNumber}
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href={`/concursos/${contestSlug}/inscripcion`} className="fr-btn fr-btn-primary px-6 py-3">
            Continuar con la fotografía
          </Link>
          <Link href="/participaciones" className="fr-btn fr-btn-secondary px-6 py-3">
            Ir a mis participaciones
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 space-y-10"
      data-testid="inscription-form"
      data-contest-id={contestId}
    >
      <section className="fr-recuadro space-y-6 border border-fr-border bg-fr-card">
        <h2 className="text-xl font-semibold tracking-tight">Categoría</h2>
        {singleCategory ? (
          <p className="text-fr-primary">
            {categories[0]?.name}
            <span className="mt-2 block text-sm text-fr-muted">
              Hasta {categories[0]?.maxFiles} fotografía(s).
            </span>
          </p>
        ) : (
          <label className="block">
            <span className="text-base font-semibold text-fr-primary">Elegí una categoría</span>
            <select
              className="mt-8 w-full rounded-xl border border-fr-border bg-fr-bg px-5 py-4 text-fr-primary"
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
          </label>
        )}
        <label className="block">
          <span className="text-base font-semibold text-fr-primary">Edad (años)</span>
          <input
            type="number"
            min={16}
            max={120}
            className="mt-8 w-full max-w-xs rounded-xl border border-fr-border bg-fr-bg px-5 py-4 text-fr-primary"
            value={declaredAgeYears}
            onChange={(e) => setDeclaredAgeYears(e.target.value)}
            required
            data-testid="inscription-age"
          />
        </label>
      </section>

      <section className="fr-recuadro space-y-6 border border-fr-border bg-fr-card" id="bases-inscripcion">
        <h2 className="text-xl font-semibold tracking-tight">
          {rules.title}{" "}
          <span className="text-sm font-normal text-fr-muted">(v{rules.versionNumber})</span>
        </h2>
        {rules.publishedAt ? (
          <p className="text-sm text-fr-muted">Publicada: {new Date(rules.publishedAt).toLocaleString("es-AR")}</p>
        ) : null}
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-fr-border bg-fr-bg p-6 text-sm leading-relaxed text-fr-muted">
          {rules.content}
        </div>
        <label className="flex items-start gap-4 text-base text-fr-primary">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[#d4af37]"
            checked={acceptedRules}
            onChange={(e) => setAcceptedRules(e.target.checked)}
            data-testid="inscription-accept-rules"
          />
          <span>
            Acepto las bases publicadas (versión {rules.versionNumber}). Esta aceptación queda
            registrada con fecha, versión y hashes.
          </span>
        </label>
        <label className="flex items-start gap-4 text-base text-fr-primary">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[#d4af37]"
            checked={acceptedLicense}
            onChange={(e) => setAcceptedLicense(e.target.checked)}
            data-testid="inscription-accept-license"
          />
          <span>Acepto la licencia necesaria para participar (obligatoria, separada de las bases).</span>
        </label>
        <label className="flex items-start gap-4 text-base text-fr-muted">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[#d4af37]"
            checked={promotionalOptIn}
            onChange={(e) => setPromotionalOptIn(e.target.checked)}
            data-testid="inscription-promo-optin"
          />
          <span>Deseo recibir comunicaciones promocionales opcionales (no obligatorio).</span>
        </label>
      </section>

      {needsMinorAuth ? (
        <section className="fr-recuadro space-y-6 border border-amber-500/30 bg-amber-500/5">
          <h2 className="text-xl font-semibold tracking-tight">Autorización de menor</h2>
          <p className="text-sm text-fr-muted">{MINOR_CONSENT_NOTICE}</p>
          <label className="block">
            <span className="text-base font-semibold">Nombre del adulto responsable</span>
            <input
              className="mt-8 w-full rounded-xl border border-fr-border bg-fr-bg px-5 py-4"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              data-testid="inscription-guardian-name"
            />
          </label>
          <label className="block">
            <span className="text-base font-semibold">Vínculo</span>
            <input
              className="mt-8 w-full rounded-xl border border-fr-border bg-fr-bg px-5 py-4"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Padre / Madre / Tutor legal"
              data-testid="inscription-guardian-relationship"
            />
          </label>
          <label className="flex items-start gap-4">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[#d4af37]"
              checked={minorAccepted}
              onChange={(e) => setMinorAccepted(e.target.checked)}
              data-testid="inscription-minor-auth"
            />
            <span>Declaro como adulto responsable autorizar la participación del menor.</span>
          </label>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-sm text-red-200" role="alert">
          {error}
        </div>
      ) : null}

      <div className="fr-content-to-actions mt-16 flex flex-wrap gap-4 border-t border-fr-border pt-8">
        <button
          type="submit"
          disabled={pending}
          className="fr-btn fr-btn-primary px-8 py-4 text-base font-semibold disabled:opacity-60"
          data-testid="inscription-submit"
        >
          {pending ? "Confirmando…" : isFree ? "Confirmar inscripción gratuita" : "Continuar a pago"}
        </button>
        <Link href={`/concursos/${contestSlug}`} className="fr-btn fr-btn-secondary px-8 py-4">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
