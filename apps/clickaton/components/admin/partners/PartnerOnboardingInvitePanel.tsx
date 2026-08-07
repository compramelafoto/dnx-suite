"use client";

import { useState, useTransition } from "react";
import {
  PARTNER_ONBOARDING_ADMIN_STATUS_LABELS,
  type OnboardingInvitationRecord,
} from "@repo/partners/client-safe";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type PartnerOnboardingInviteListItem = Pick<
  OnboardingInvitationRecord,
  "id" | "status" | "reviewStatus" | "expiresAt" | "openedAt" | "submittedAt" | "createdAt"
>;

type Props = {
  partnerId: string;
  invitations: PartnerOnboardingInviteListItem[];
  adminStatus?: keyof typeof PARTNER_ONBOARDING_ADMIN_STATUS_LABELS | string;
  /** URL relativa o absoluta del último invite creado (si el parent ya la conoce). */
  lastInviteUrl?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  OPENED: "Abierto",
  SUBMITTED: "Enviado",
  EXPIRED: "Vencido",
  REVOKED: "Revocado",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  NONE: "Sin revisión",
  PENDING_REVIEW: "Revisión pendiente",
  APPROVED: "Aprobado",
  CHANGES_REQUESTED: "Cambios solicitados",
  REJECTED: "Rechazado",
};

/**
 * Panel admin: solicitar datos, copiar link e historial de invitaciones.
 * No envía emails — solo genera / copia el enlace.
 */
export function PartnerOnboardingInvitePanel({
  partnerId,
  invitations,
  adminStatus,
  lastInviteUrl: initialUrl = null,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(initialUrl);
  const [copied, setCopied] = useState(false);
  const [localInvites, setLocalInvites] = useState(invitations);

  const statusLabel =
    adminStatus && adminStatus in PARTNER_ONBOARDING_ADMIN_STATUS_LABELS
      ? PARTNER_ONBOARDING_ADMIN_STATUS_LABELS[
          adminStatus as keyof typeof PARTNER_ONBOARDING_ADMIN_STATUS_LABELS
        ]
      : adminStatus ?? "—";

  async function createInvitation() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/partners/${partnerId}/onboarding`, {
          method: "POST",
        });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          inviteUrl?: string;
          invitation?: PartnerOnboardingInviteListItem;
        };
        if (!res.ok || !json.ok) {
          setError(json.message || "No se pudo crear la invitación.");
          return;
        }
        if (json.inviteUrl) setInviteUrl(json.inviteUrl);
        if (json.invitation) {
          setLocalInvites((prev) => [json.invitation!, ...prev]);
        }
      } catch {
        setError("Error de red al crear la invitación.");
      }
    });
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError("No se pudo copiar el enlace. Copialo manualmente.");
    }
  }

  return (
    <Card variant="outlined" className="space-y-6 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-ck-text">Datos del partner</h3>
        <p className="text-sm text-ck-text-secondary">
          Estado: <span className="font-medium text-ck-text">{statusLabel}</span>
        </p>
        <p className="text-xs text-ck-text-muted">
          Generá un enlace para que el partner complete empresa, contacto y logos. No se envía
          email automático.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          loading={pending}
          onClick={() => void createInvitation()}
        >
          Solicitar datos
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto"
          disabled={!inviteUrl}
          onClick={() => void copyLink()}
        >
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
      </div>

      {inviteUrl ? (
        <div className="space-y-2 rounded-lg border border-ck-border bg-ck-surface-strong/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ck-text-muted">
            Enlace (visible solo al crear)
          </p>
          <p className="break-all text-sm text-ck-text">{inviteUrl}</p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 border-t border-ck-border pt-6">
        <h4 className="text-sm font-semibold text-ck-text">Invitaciones</h4>
        {localInvites.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Todavía no hay invitaciones.</p>
        ) : (
          <ul className="space-y-3">
            {localInvites.map((inv) => (
              <li
                key={inv.id}
                className="rounded-lg border border-ck-border px-4 py-3 text-sm text-ck-text-secondary"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ck-text">
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                  <span className="text-xs text-ck-text-muted">
                    Creada {formatDate(inv.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ck-text-muted">
                  Vence {formatDate(inv.expiresAt)}
                  {inv.openedAt ? ` · Abierta ${formatDate(inv.openedAt)}` : ""}
                  {inv.submittedAt ? ` · Enviada ${formatDate(inv.submittedAt)}` : ""}
                  {inv.reviewStatus && inv.reviewStatus !== "NONE"
                    ? ` · Revisión: ${REVIEW_STATUS_LABELS[inv.reviewStatus] ?? inv.reviewStatus}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
