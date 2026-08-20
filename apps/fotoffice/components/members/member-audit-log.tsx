import type { MemberAuditRecord } from "@repo/db/fotoffice-members";
import {
  MEMBER_AUDIT_ACTION_LABELS,
  MEMBER_AUDIT_SOURCE_LABELS,
  formatAuditValue,
  memberFieldLabel,
} from "@/lib/members/audit-labels";

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

type FieldChange = { before?: unknown; after?: unknown };

function readChanges(raw: unknown): [string, FieldChange][] {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, FieldChange>);
}

/**
 * Historial del socio, más reciente primero. Es solo lectura: el registro es inmutable y no se
 * ofrece editarlo ni borrarlo desde ningún lado.
 */
export function MemberAuditLog({ entries }: { entries: MemberAuditRecord[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--fo-muted)]">
        Todavía no hay movimientos registrados. El historial se genera a partir de la incorporación de
        esta función.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((e) => {
        const changes = readChanges(e.changesJson);
        return (
          <li key={e.id} className="border-l-2 border-[var(--fo-accent)]/40 pl-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-[var(--fo-text)]">
                {MEMBER_AUDIT_ACTION_LABELS[e.action] ?? e.action}
              </span>
              <span className="text-xs text-[var(--fo-muted)]">{fmtDateTime(e.createdAt)}</span>
              <span className="text-xs text-[var(--fo-muted-soft)]">
                {MEMBER_AUDIT_SOURCE_LABELS[e.source] ?? e.source}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-[var(--fo-muted)]">
              {/* actorLabel sobrevive aunque el usuario se elimine: por eso se muestra el label
                  guardado y no un join contra User. */}
              {e.actorLabel ? `Por ${e.actorLabel}` : "Proceso automático"}
              {e.sourceRow !== null ? ` · fila ${e.sourceRow} del archivo` : ""}
            </p>

            {e.reason ? (
              <p className="mt-1 text-sm text-[var(--fo-text)]">
                <span className="text-[var(--fo-muted)]">Motivo:</span> {e.reason}
              </p>
            ) : null}

            {changes.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {changes.map(([field, change]) => (
                  <li key={field} className="text-xs text-[var(--fo-muted)]">
                    <span className="text-[var(--fo-text)]">{memberFieldLabel(field)}:</span>{" "}
                    <span className="line-through">{formatAuditValue(field, change.before)}</span>{" "}
                    <span aria-hidden>→</span>{" "}
                    <span className="text-[var(--fo-text)]">{formatAuditValue(field, change.after)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
