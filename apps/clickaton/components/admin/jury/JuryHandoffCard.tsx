import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import {
  JURY_ANONYMITY_NOTICE,
  JURY_HANDOFF_NOTICE,
  TECHNICAL_VS_JURY_ADMIN,
  juryToneToBadgeVariant,
  presentJuryActionLabel,
  presentJuryHandoffFromBatch,
} from "@/lib/jury-results/ui/jury-results-status-presentation";

type Props = {
  editionId: string;
  batchStatus?: string | null;
  batchId?: string | null;
  frozenCount?: number;
  fotorankAdminHref?: string | null;
  admissionHref: string;
};

/**
 * Puente Clickatón → evaluación en FotoRank.
 * No implementa panel de jurado ni cambia lógica de freeze.
 */
export function JuryHandoffCard({
  editionId,
  batchStatus,
  batchId,
  frozenCount,
  fotorankAdminHref,
  admissionHref,
}: Props) {
  const handoff = presentJuryHandoffFromBatch(batchStatus);

  return (
    <Card variant="outlined" className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ck-yellow">
            Evaluación y resultados
          </p>
          <h2 className="text-lg font-semibold text-ck-text">Puente hacia el jurado</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ck-text-secondary">
            {TECHNICAL_VS_JURY_ADMIN}
          </p>
        </div>
        <Badge variant={juryToneToBadgeVariant(handoff.tone)}>{handoff.label}</Badge>
      </div>

      <p className="text-sm leading-relaxed text-ck-text-muted">{JURY_HANDOFF_NOTICE}</p>
      <p className="text-sm leading-relaxed text-ck-text-secondary">{handoff.description}</p>
      {handoff.nextAction ? (
        <p className="text-sm font-medium text-ck-text">{handoff.nextAction}</p>
      ) : null}

      <div
        className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong px-4 py-3 text-sm"
        role="note"
      >
        <p className="font-semibold text-ck-text">Anonimización</p>
        <p className="mt-1 leading-relaxed text-ck-text-secondary">{JURY_ANONYMITY_NOTICE}</p>
        <p className="mt-2 text-xs text-ck-text-muted">
          Congelar para el jurado no es lo mismo que publicar resultados. Publicar ocurre en
          FotoRank cuando la organización confirma el ranking.
        </p>
      </div>

      {typeof frozenCount === "number" ? (
        <p className="text-sm text-ck-text-secondary">
          Obras listas para el circuito de jurado (congeladas): <strong>{frozenCount}</strong>
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button href={admissionHref} variant="primary" className="min-h-11 w-full sm:w-auto">
          Ir a admisión técnica
        </Button>
        {fotorankAdminHref ? (
          <Button
            href={fotorankAdminHref}
            variant="secondary"
            className="min-h-11 w-full sm:w-auto"
          >
            Abrir evaluación en FotoRank
          </Button>
        ) : null}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
            {presentJuryActionLabel("freeze_for_jury")}
          </dt>
          <dd className="mt-1 text-ck-text-secondary">
            Deja las obras admitidas listas para evaluación artística. No publica ranking.
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
            {presentJuryActionLabel("publish_results")}
          </dt>
          <dd className="mt-1 text-ck-text-secondary">
            Acción de FotoRank. Solo después de confirmar resultados.
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
            {presentJuryActionLabel("confirm_results")}
          </dt>
          <dd className="mt-1 text-ck-text-secondary">
            Cierra el ranking en organización. Distinto de publicar al público.
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
            {presentJuryActionLabel("update_preliminary")}
          </dt>
          <dd className="mt-1 text-ck-text-secondary">
            Recalcula un ranking provisional. No comunica ganadores oficiales.
          </dd>
        </div>
      </dl>

      <AdminTechnicalInfo
        title="Información técnica del puente"
        description="IDs de edición y lote. Cerrado por defecto."
        rows={[
          { label: "ID de edición", value: editionId, mono: true, copyText: editionId },
          {
            label: "Estado interno del lote",
            value: batchStatus ?? "—",
            mono: true,
          },
          {
            label: "ID de lote",
            value: batchId ?? "—",
            mono: true,
            copyText: batchId ?? undefined,
          },
        ]}
      />
    </Card>
  );
}
