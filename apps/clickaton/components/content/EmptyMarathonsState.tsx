import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import {
  marathonFormatLabels,
  registrationStatusLabels,
  type MarathonFormat,
  type RegistrationStatus,
} from "@/types/marathon";

type EmptyMarathonsStateProps = {
  message: string;
  note: string;
  formats: readonly MarathonFormat[];
  registrationStatuses: readonly RegistrationStatus[];
  cardHints: readonly string[];
};

export function EmptyMarathonsState({
  message,
  note,
  formats,
  registrationStatuses,
  cardHints,
}: EmptyMarathonsStateProps) {
  return (
    <div className="space-y-8">
      <Card variant="outlined" className="border-dashed bg-ck-white">
        <EditorialLabel>Agenda en preparación</EditorialLabel>
        <p className="ck-heading-lg mt-4">{message}</p>
        <p className="ck-body-sm mt-3 max-w-prose text-ck-text-muted">{note}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className="flex min-h-[9rem] flex-col justify-between rounded-[var(--ck-radius-md)] border-2 border-dashed border-ck-gray-300 bg-ck-bg-alt p-4"
            >
              <div className="space-y-2">
                <div className="h-2.5 w-16 rounded-sm bg-ck-gray-200" />
                <div className="h-5 w-28 rounded-sm bg-ck-gray-100" />
                <div className="h-2.5 w-24 rounded-sm bg-ck-gray-100" />
              </div>
              <span className="ck-label flex items-center gap-2 text-ck-text-muted">
                <FocusMark size="sm" />
                Próximamente
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="ck-heading-md">Qué verás en cada futura tarjeta</h3>
          <ul className="mt-4 space-y-2">
            {cardHints.map((hint) => (
              <li key={hint} className="ck-body-sm text-ck-text-secondary">
                · {hint}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="ck-heading-md">Formatos y estados</h3>
          <p className="ck-label mt-4 text-ck-text-muted">Formatos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {formats.map((format) => (
              <Badge key={format} variant="brand">
                {marathonFormatLabels[format]}
              </Badge>
            ))}
          </div>
          <p className="ck-label mt-5 text-ck-text-muted">Inscripción</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {registrationStatuses.map((status) => (
              <Badge key={status} variant="neutral">
                {registrationStatusLabels[status]}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
