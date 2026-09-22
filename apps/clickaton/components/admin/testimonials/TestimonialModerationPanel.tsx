"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import {
  publishTestimonialAction,
  rejectTestimonialAction,
  saveExcerptAction,
  unpublishTestimonialAction,
  type ModerationState,
} from "@/lib/testimonials/admin/actions";
import { EXCERPT_MAX_LENGTH } from "@/lib/testimonials/domain/survey-definition";
import type { ClickatonTestimonialStatus } from "@/lib/testimonials/domain/types";
import { canPublish } from "@/lib/testimonials/ui/testimonial-status-presentation";

type Props = {
  testimonialId: string;
  status: ClickatonTestimonialStatus;
  publicationConsent: boolean;
  defaultExcerpt: string;
};

const initialState: ModerationState = { ok: false };

function Feedback({ state }: { state: ModerationState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={
        state.ok
          ? "text-sm text-[var(--ck-success)]"
          : "text-sm text-[var(--ck-danger)]"
      }
    >
      {state.message}
    </p>
  );
}

export function TestimonialModerationPanel({
  testimonialId,
  status,
  publicationConsent,
  defaultExcerpt,
}: Props) {
  const [publishState, publishAction, publishing] = useActionState(
    publishTestimonialAction,
    initialState,
  );
  const [excerptState, excerptAction, savingExcerpt] = useActionState(
    saveExcerptAction,
    initialState,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectTestimonialAction,
    initialState,
  );
  const [unpublishState, unpublishAction, unpublishing] = useActionState(
    unpublishTestimonialAction,
    initialState,
  );

  const gate = canPublish({ status, publicationConsent });

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ck-text">
            El fragmento que sale publicado
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Es el recorte que aparece entre comillas en el inicio y en la ficha
            de la edición. Se puede acortar, pero no reescribir lo que dijo.
          </p>
        </div>
        <form action={excerptAction} className="space-y-3">
          <input type="hidden" name="testimonialId" value={testimonialId} />
          <Textarea
            name="highlightedExcerpt"
            rows={3}
            maxLength={EXCERPT_MAX_LENGTH}
            defaultValue={defaultExcerpt}
            disabled={savingExcerpt}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={savingExcerpt}>
              {savingExcerpt ? "Guardando…" : "Guardar fragmento"}
            </Button>
            <Feedback state={excerptState} />
          </div>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-ck-text">Publicación</h2>

        {gate.allowed ? (
          <form action={publishAction} className="flex items-center gap-3">
            <input type="hidden" name="testimonialId" value={testimonialId} />
            <Button type="submit" variant="primary" disabled={publishing}>
              {publishing ? "Publicando…" : "Publicar"}
            </Button>
            <Feedback state={publishState} />
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled>
              Publicar
            </Button>
            {/* La razón se escribe, no se deja sólo un botón apagado. */}
            <span className="text-sm text-ck-text-secondary">{gate.reason}</span>
          </div>
        )}

        {status === "PUBLISHED" ? (
          <form action={unpublishAction} className="flex items-center gap-3">
            <input type="hidden" name="testimonialId" value={testimonialId} />
            <Button type="submit" variant="outline" disabled={unpublishing}>
              {unpublishing ? "Despublicando…" : "Despublicar"}
            </Button>
            <Feedback state={unpublishState} />
          </form>
        ) : null}

        <form action={rejectAction} className="space-y-3 border-t border-ck-border pt-4">
          <input type="hidden" name="testimonialId" value={testimonialId} />
          <label className="block space-y-1 text-sm">
            <span className="text-ck-text-muted">
              Por qué lo rechazás (queda interno)
            </span>
            <Textarea name="moderationNotes" rows={2} disabled={rejecting} />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="ghost" disabled={rejecting}>
              {rejecting ? "Rechazando…" : "Rechazar"}
            </Button>
            <Feedback state={rejectState} />
          </div>
        </form>
      </Card>
    </div>
  );
}
