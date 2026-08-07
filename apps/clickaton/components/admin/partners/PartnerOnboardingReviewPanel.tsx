"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  OnboardingInvitationRecord,
  PartnerOnboardingSubmission,
  PartnerRecord,
} from "@repo/partners/client-safe";
import { getPartnerLogoVariantGuide } from "@repo/partners/client-safe";
import { PartnerLogoDualPreview } from "@/components/partners/logo/PartnerLogoDualPreview";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";

const REVIEW_STATUS_LABELS: Record<string, string> = {
  NONE: "Sin revisión",
  PENDING_REVIEW: "Revisión pendiente",
  APPROVED: "Aprobado",
  CHANGES_REQUESTED: "Cambios solicitados",
  REJECTED: "Rechazado",
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospecto",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado",
};

type Props = {
  partnerId: string;
  partner: Pick<
    PartnerRecord,
    | "name"
    | "legalName"
    | "description"
    | "websiteUrl"
    | "instagram"
    | "facebookUrl"
    | "linkedinUrl"
    | "address"
    | "city"
    | "provinceOrState"
    | "country"
    | "postalCode"
    | "taxId"
    | "status"
  >;
  invitation: Pick<
    OnboardingInvitationRecord,
    "id" | "status" | "reviewStatus" | "reviewNotes" | "submissionJson" | "submittedAt"
  >;
};

function Row({
  label,
  current,
  proposed,
}: {
  label: string;
  current?: string | null;
  proposed?: string | null;
}) {
  const cur = current?.trim() || "—";
  const prop = proposed?.trim() || "—";
  const changed = cur !== prop;
  return (
    <div className="grid gap-2 border-b border-ck-border/60 py-3 sm:grid-cols-3">
      <p className="text-sm font-medium text-ck-text">{label}</p>
      <p className="text-sm text-ck-text-secondary">
        <span className="text-xs uppercase text-ck-text-muted">Actual</span>
        <br />
        {cur}
      </p>
      <p className={`text-sm ${changed ? "text-amber-100" : "text-ck-text-secondary"}`}>
        <span className="text-xs uppercase text-ck-text-muted">Propuesto</span>
        <br />
        {prop}
      </p>
    </div>
  );
}

/**
 * Review admin: ACTUAL vs PROPUESTO + acciones de aprobación.
 * No publica ni cambia status comercial.
 */
export function PartnerOnboardingReviewPanel({ partnerId, partner, invitation }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(invitation.reviewNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submission = invitation.submissionJson as PartnerOnboardingSubmission | null;
  if (!submission || invitation.status !== "SUBMITTED") return null;

  async function review(action: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partners/${partnerId}/onboarding/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invitationId: invitation.id,
            action,
            notes,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; message?: string };
        if (!res.ok || !json.ok) {
          setError(json.message || "No se pudo completar la revisión.");
          return;
        }
        setMessage("Revisión guardada.");
        router.refresh();
      } catch {
        setError("Error de red al revisar.");
      }
    });
  }

  const company = submission.company;
  const logos = submission.logos ?? [];

  return (
    <Card variant="outlined" className="space-y-8 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-ck-text">Datos enviados por el partner</h3>
        <p className="text-sm text-ck-text-secondary">
          Estado de revisión:{" "}
          {REVIEW_STATUS_LABELS[invitation.reviewStatus] ?? invitation.reviewStatus}
          {invitation.submittedAt
            ? ` · Enviado ${new Date(invitation.submittedAt).toLocaleString("es-AR")}`
            : null}
        </p>
        <p className="text-xs text-ck-text-muted">
          Estado comercial del partner:{" "}
          <strong>{PARTNER_STATUS_LABELS[partner.status] ?? partner.status}</strong> (no
          cambia al aprobar). La publicación pública es un paso aparte.
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ck-text-muted">
          Empresa — actual vs propuesto
        </h4>
        <Row label="Nombre" current={partner.name} proposed={company?.name} />
        <Row label="Razón social" current={partner.legalName} proposed={company?.legalName} />
        <Row label="CUIT" current={partner.taxId} proposed={company?.taxId} />
        <Row label="Descripción" current={partner.description} proposed={company?.description} />
        <Row label="Sitio web" current={partner.websiteUrl} proposed={company?.websiteUrl} />
        <Row label="Instagram" current={partner.instagram} proposed={company?.instagram} />
        <Row label="Facebook" current={partner.facebookUrl} proposed={company?.facebookUrl} />
        <Row label="LinkedIn" current={partner.linkedinUrl} proposed={company?.linkedinUrl} />
        <Row label="Dirección" current={partner.address} proposed={company?.address} />
        <Row label="Ciudad" current={partner.city} proposed={company?.city} />
        <Row
          label="Provincia"
          current={partner.provinceOrState}
          proposed={company?.provinceOrState}
        />
        <Row label="País" current={partner.country} proposed={company?.country} />
        <Row label="CP" current={partner.postalCode} proposed={company?.postalCode} />
        <Row label="Destino click" current={null} proposed={company?.destinationUrl} />
        <Row label="Observaciones" current={null} proposed={company?.observations} />
      </div>

      {submission.contact ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-ck-text-muted">
            Contacto propuesto (privado por defecto)
          </h4>
          <p className="text-sm text-ck-text-secondary">
            {submission.contact.firstName} {submission.contact.lastName ?? ""} ·{" "}
            {submission.contact.roleTitle ?? "Sin cargo"}
          </p>
          <p className="text-sm text-ck-text-secondary">
            Email: {submission.contact.email ?? "—"} (público:{" "}
            {submission.contact.emailIsPublic ? "sí" : "no"})
          </p>
          <p className="text-sm text-ck-text-secondary">
            Tel: {submission.contact.phone ?? "—"} (público:{" "}
            {submission.contact.phoneIsPublic ? "sí" : "no"})
          </p>
        </div>
      ) : null}

      {logos.length ? (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-ck-text-muted">
            Logos enviados
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            {logos.map((logo) => {
              const guide = getPartnerLogoVariantGuide(logo.type);
              const logoLabel = guide?.title ?? logo.type;
              return (
              <div
                key={`${logo.type}-${logo.assetId}`}
                className="space-y-2 rounded-lg border border-ck-border p-4"
              >
                <p className="text-sm font-medium text-ck-text">{logoLabel}</p>
                <p className="text-xs text-ck-text-muted">
                  {logo.width && logo.height ? `${logo.width} × ${logo.height} px · ` : null}
                  {logo.mimeType ?? "—"}
                  {logo.fileSize != null ? ` · ${Math.round(logo.fileSize / 1024)} KB` : null}
                </p>
                {logo.fileUrl ? (
                  <PartnerLogoDualPreview src={logo.fileUrl} alt={logoLabel} />
                ) : (
                  <p className="text-xs text-ck-text-muted">Sin preview</p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <label className="block text-sm font-medium text-ck-text" htmlFor="review-notes">
          Notas de revisión
        </label>
        <Textarea
          id="review-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="lg"
          loading={pending}
          onClick={() => void review("APPROVE_DATA")}
        >
          Aprobar datos
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          loading={pending}
          onClick={() => void review("APPROVE_LOGOS")}
        >
          Aprobar logos
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          loading={pending}
          onClick={() => void review("REQUEST_CHANGES")}
        >
          Solicitar corrección
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          loading={pending}
          onClick={() => void review("REJECT")}
        >
          Rechazar cambios
        </Button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
    </Card>
  );
}
