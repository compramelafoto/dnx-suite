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
  product_created: { title: "Producto creado", tone: "success" },
  product_updated: { title: "Producto actualizado", tone: "success" },
  product_activated: { title: "Producto reactivado", tone: "success" },
  product_deactivated: { title: "Producto desactivado", tone: "success" },
  variant_created: { title: "Variante creada", tone: "success" },
  variant_updated: { title: "Variante actualizada", tone: "success" },
  variant_activated: { title: "Variante reactivada", tone: "success" },
  variant_deactivated: { title: "Variante desactivada", tone: "success" },
  stock_adjusted: { title: "Stock ajustado", tone: "success" },
  ticket_created: { title: "Entrada creada", tone: "success" },
  ticket_updated: { title: "Entrada actualizada", tone: "success" },
  ticket_activated: { title: "Entrada reactivada", tone: "success" },
  ticket_deactivated: { title: "Entrada desactivada", tone: "success" },
  ticket_item_added: { title: "Producto agregado al kit", tone: "success" },
  ticket_item_updated: { title: "Composición actualizada", tone: "success" },
  ticket_item_removed: { title: "Producto quitado del kit", tone: "success" },
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
