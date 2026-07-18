import { Card } from "@/components/ui/Card";

const FLASH_MESSAGES: Record<string, { title: string; body?: string; tone: "success" | "warning" | "danger" }> = {
  edition_created: { title: "Edición creada", tone: "success" },
  edition_updated: { title: "Edición actualizada", tone: "success" },
  edition_deleted: { title: "Edición eliminada", tone: "success" },
  edition_unpublished: { title: "Edición despublicada", tone: "success" },
  venue_created: { title: "Sede creada", tone: "success" },
  venue_updated: { title: "Sede actualizada", tone: "success" },
  venue_deleted: { title: "Sede eliminada", tone: "success" },
  venue_deactivated: { title: "Sede desactivada", tone: "success" },
  migration_pending: {
    title: "Migración pendiente",
    body: "Las tablas de ediciones y sedes aún no están disponibles en la base conectada.",
    tone: "warning",
  },
  error: { title: "No se pudo completar la acción", tone: "danger" },
};

type Props = {
  flash?: string | null;
  message?: string | null;
};

export function AdminFlashMessage({ flash, message }: Props) {
  if (!flash && !message) return null;

  const preset = flash ? FLASH_MESSAGES[flash] : undefined;
  if (!preset && !message) return null;

  const tone = preset?.tone ?? "danger";
  const borderClass =
    tone === "success"
      ? "border-[var(--ck-success)]/40 bg-[var(--ck-success-soft)]"
      : tone === "warning"
        ? "border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)]"
        : "border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)]";

  return (
    <Card variant="outlined" className={`space-y-1 p-4 ${borderClass}`} role="status">
      <p className="text-sm font-semibold text-ck-text">{preset?.title ?? message}</p>
      {preset?.body ? <p className="text-sm text-ck-text-secondary">{preset.body}</p> : null}
      {message && preset ? <p className="text-sm text-ck-text-secondary">{message}</p> : null}
    </Card>
  );
}
