"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import type { EventPricingEnrollmentCopy } from "@/lib/event-photo-pricing";
import { EventJoinPolicy, EventMemberStatus } from "@prisma/client";

const COMMITMENT_MESSAGE = (
  <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 m-0">
    Inscribirse al evento es un <strong>compromiso de asistencia</strong>. Para no afectar a otros colegas, es importante respetar ese compromiso. Si tenés que cancelar, avisá en la plataforma con <strong>mínimo 24 horas de anticipación</strong> (desinscribite desde &quot;Mis eventos&quot; en tu panel).
  </p>
);

function PhotoPricingEnrollmentBlocks({ copy }: { copy: EventPricingEnrollmentCopy }) {
  return (
    <div className="space-y-2 mb-3 min-w-0">
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 space-y-2">
        {copy.summaryLines.map((line, i) => (
          <p key={i} className="ds-readable-text ds-readable-text--fluid text-sm text-gray-900 m-0">
            {line}
          </p>
        ))}
      </div>
      {copy.acceptanceNote ? (
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 m-0">
          {copy.acceptanceNote}
        </p>
      ) : null}
    </div>
  );
}

function PhotoPricingEnrollmentLine({ line }: { line?: string | null }) {
  if (!line?.trim()) return null;
  return (
    <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-800 bg-sky-50 border border-sky-100 rounded-lg p-3 mb-3 m-0">
      {line}
    </p>
  );
}

/** Prioriza `{ pricingEnrollment }` si existe (copy estructurada); si no, usa `photoPricingLine`. */
function PhotoPricingEnrollmentDisplay({
  pricingEnrollment,
  photoPricingLine,
}: {
  pricingEnrollment?: EventPricingEnrollmentCopy | null;
  photoPricingLine?: string | null;
}) {
  if (pricingEnrollment) {
    return <PhotoPricingEnrollmentBlocks copy={pricingEnrollment} />;
  }
  return <PhotoPricingEnrollmentLine line={photoPricingLine} />;
}

type Props = {
  shareSlug: string;
  isLoggedIn: boolean;
  isPhotographer: boolean;
  membershipStatus: EventMemberStatus | null;
  joinPolicy: EventJoinPolicy;
  maxPhotographers: number | null;
  activePhotographersCount: number;
  isPrivateOrInviteOnly?: boolean;
  isInvited?: boolean;
  termsText?: string;
  uploadsRuleText?: string;
  /** @deprecated usar pricingEnrollment cuando exista copy estructurada */
  photoPricingLine?: string | null;
  /** Regla comercial visible antes de inscribirse (venta digital / precios oficiales). */
  pricingEnrollment?: EventPricingEnrollmentCopy | null;
};

export default function EventJoinBlock({
  shareSlug,
  isLoggedIn,
  isPhotographer,
  membershipStatus,
  joinPolicy,
  maxPhotographers,
  activePhotographersCount,
  isPrivateOrInviteOnly = false,
  isInvited = false,
  termsText,
  uploadsRuleText,
  photoPricingLine,
  pricingEnrollment,
}: Props) {
  const [joining, setJoining] = useState(false);
  const [joinedSuccessActive, setJoinedSuccessActive] = useState(false);
  const [joinedSuccessPending, setJoinedSuccessPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const requiresInviteFlow = isPrivateOrInviteOnly;
  const usesRequestApproval =
    joinPolicy === EventJoinPolicy.REQUEST && !requiresInviteFlow;
  const canReapplyAfterReject = usesRequestApproval;

  const isActiveEffective =
    !left && (membershipStatus === EventMemberStatus.ACTIVE || joinedSuccessActive);
  const isPendingEffective =
    !left && (membershipStatus === EventMemberStatus.PENDING || joinedSuccessPending);
  const isRejectedBlocked =
    !left &&
    membershipStatus === EventMemberStatus.REJECTED &&
    !canReapplyAfterReject;

  const canJoin =
    isPhotographer &&
    !joinedSuccessActive &&
    !joinedSuccessPending &&
    (left ||
      (membershipStatus !== EventMemberStatus.ACTIVE &&
        membershipStatus !== EventMemberStatus.PENDING &&
        !(
          membershipStatus === EventMemberStatus.REJECTED && !canReapplyAfterReject
        ))) &&
    (usesRequestApproval ||
      maxPhotographers == null ||
      activePhotographersCount < maxPhotographers) &&
    (!isPrivateOrInviteOnly || isInvited);

  async function handleLeave() {
    if (!isActiveEffective && !isPendingEffective) return;
    setError(null);
    setLeaving(true);
    try {
      const res = await fetch(`/api/public/events/${shareSlug}/leave`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLeft(true);
        setJoinedSuccessActive(false);
        setJoinedSuccessPending(false);
      } else {
        setError(data.error || "No se pudo desinscribir");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLeaving(false);
    }
  }

  async function handleJoin() {
    if (!canJoin) return;
    if (!acceptedTerms) {
      setError("Debés aceptar las condiciones para inscribirte.");
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/public/events/${shareSlug}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptTerms: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/fotografo/login?redirect=${encodeURIComponent(`/e/${shareSlug}`)}`;
          return;
        }
        setError(data.error || "No se pudo inscribir");
        return;
      }

      const outcome = data.outcome as string | undefined;
      if (data.success === false && outcome === "rejected") {
        setError(data.message || "Tu solicitud fue rechazada.");
        return;
      }

      if (outcome === "request_pending" || outcome === "already_pending") {
        setJoinedSuccessPending(true);
        setJoinedSuccessActive(false);
        return;
      }

      if (
        outcome === "joined_active" ||
        outcome === "already_active" ||
        data.alreadyMember
      ) {
        setJoinedSuccessActive(true);
        setJoinedSuccessPending(false);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setJoining(false);
    }
  }

  if (isActiveEffective) {
    return (
      <div className="space-y-3">
        {COMMITMENT_MESSAGE}
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          <p className="mb-3">Ya estás inscrito en este evento.</p>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/fotografo/dashboard">
              <Button variant="secondary" size="sm">Ir a Mis eventos</Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLeave}
              disabled={leaving}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {leaving ? "Desinscribiendo…" : "Desinscribirme"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isPendingEffective) {
    return (
      <div className="space-y-3">
        {COMMITMENT_MESSAGE}
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900">
          <p className="mb-3">
            Tu solicitud está pendiente de aprobación del organizador. Cuando te acepten,
            vas a ver el evento en &quot;Mis eventos&quot; y vas a poder cargar fotos.
          </p>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLeave}
            disabled={leaving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {leaving ? "Cancelando…" : "Cancelar solicitud"}
          </Button>
        </div>
      </div>
    );
  }

  if (isRejectedBlocked) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 text-gray-700">
        <PhotoPricingEnrollmentDisplay
          pricingEnrollment={pricingEnrollment}
          photoPricingLine={photoPricingLine}
        />
        <p className="text-sm">
          Tu solicitud fue rechazada. Para volver a participar necesitás que el organizador te
          invite o apruebe nuevamente.
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4">
        <PhotoPricingEnrollmentDisplay
          pricingEnrollment={pricingEnrollment}
          photoPricingLine={photoPricingLine}
        />
        <p className="text-gray-700 mb-3">
          Iniciá sesión con tu cuenta de fotógrafo para inscribirte al evento.
        </p>
        <Link href={`/fotografo/login?redirect=${encodeURIComponent(`/e/${shareSlug}`)}`} className="inline-block">
          <Button variant="primary">
            Iniciar sesión para inscribirse
          </Button>
        </Link>
      </div>
    );
  }

  if (isPrivateOrInviteOnly && isLoggedIn && isPhotographer && !isInvited) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 text-gray-700">
        <PhotoPricingEnrollmentDisplay
          pricingEnrollment={pricingEnrollment}
          photoPricingLine={photoPricingLine}
        />
        <p className="text-sm">
          Este evento es privado. Solo los fotógrafos invitados por el organizador pueden inscribirse.
        </p>
      </div>
    );
  }

  if (!isPhotographer) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
        <PhotoPricingEnrollmentDisplay
          pricingEnrollment={pricingEnrollment}
          photoPricingLine={photoPricingLine}
        />
        <p className="text-sm mb-3">
          Solo los fotógrafos pueden inscribirse a este evento. Iniciá sesión con una cuenta de fotógrafo para inscribirte.
        </p>
        <Link
          href={`/fotografo/login?redirect=${encodeURIComponent(`/e/${shareSlug}`)}`}
          className="inline-block"
        >
          <Button variant="primary">
            Iniciar sesión para inscribirse
          </Button>
        </Link>
      </div>
    );
  }

  if (
    maxPhotographers != null &&
    activePhotographersCount >= maxPhotographers &&
    !usesRequestApproval
  ) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 text-gray-700">
        <PhotoPricingEnrollmentDisplay
          pricingEnrollment={pricingEnrollment}
          photoPricingLine={photoPricingLine}
        />
        <p className="text-sm m-0">El evento ya alcanzó el cupo máximo de fotógrafos.</p>
      </div>
    );
  }

  const joinButtonLabel = usesRequestApproval ? "Enviar solicitud" : "Inscribirme al evento";

  return (
    <div className="space-y-2">
      <PhotoPricingEnrollmentDisplay
        pricingEnrollment={pricingEnrollment}
        photoPricingLine={photoPricingLine}
      />
      {COMMITMENT_MESSAGE}
      {uploadsRuleText && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2">
          {uploadsRuleText}
        </p>
      )}
      {termsText && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
          <p className="font-semibold text-gray-800 mb-2">Condiciones para fotógrafos</p>
          <p className="whitespace-pre-wrap">{termsText}</p>
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5"
        />
        <span>Acepto las condiciones para inscribirme al evento.</span>
      </label>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <Button
        variant="primary"
        onClick={handleJoin}
        disabled={joining}
      >
        {joining ? (usesRequestApproval ? "Enviando…" : "Inscribiendo...") : joinButtonLabel}
      </Button>
    </div>
  );
}
