import { Badge } from "@/components/ui/Badge";
import type { ValidationCheckItem } from "@/lib/photo-upload/ui/submission-status-presentation";

const STATUS_LABEL: Record<ValidationCheckItem["status"], string> = {
  pass: "Correcto",
  fail: "No cumple",
  warning: "Advertencia",
  review: "Revisar",
  unknown: "Sin dato",
};

const STATUS_VARIANT: Record<
  ValidationCheckItem["status"],
  "success" | "danger" | "warning" | "neutral" | "brand"
> = {
  pass: "success",
  fail: "danger",
  warning: "warning",
  review: "brand",
  unknown: "neutral",
};

type Props = {
  items: ValidationCheckItem[];
};

export function ValidationChecklist({ items }: Props) {
  return (
    <section aria-label="Checklist de validación técnica" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ck-text">Validación técnica</h3>
        <p className="mt-1 text-xs text-ck-text-muted">
          Comprueba requisitos de archivo, fecha, consigna y entrega. No evalúa calidad artística.
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface/50 px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium text-ck-text">{item.label}</p>
              <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
            </div>
            <p className="mt-2 text-sm text-ck-text-secondary">{item.resultLabel}</p>
            <p className="mt-1 text-xs text-ck-text-muted">{item.explanation}</p>
            {item.needsReview ? (
              <p className="mt-2 text-xs font-medium text-[var(--ck-warning)]">
                Requiere revisión humana
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
