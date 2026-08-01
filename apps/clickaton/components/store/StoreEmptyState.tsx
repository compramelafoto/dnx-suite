import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import { storePageContent } from "@/content/store";

/**
 * Estado vacío del storefront cuando no hay productos habilitados.
 */
export function StoreEmptyState() {
  const { empty } = storePageContent;

  return (
    <Card variant="outlined" className="border-dashed bg-ck-surface">
      <EditorialLabel tone="yellow">Tienda en preparación</EditorialLabel>
      <p className="ck-heading-lg mt-4 text-ck-text">{empty.title}</p>
      <p className="ck-body-sm mt-3 max-w-prose text-ck-text-muted">{empty.body}</p>

      <div
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {[0, 1, 2].map((slot) => (
          <div
            key={slot}
            className="flex min-h-[10rem] flex-col justify-between rounded-[var(--ck-radius-md)] border-2 border-dashed border-ck-gray-300 bg-ck-bg-alt p-4"
          >
            <div className="space-y-3">
              <div className="aspect-[4/5] w-full rounded-[var(--ck-radius-sm)] bg-ck-gray-200/80" />
              <div className="h-2.5 w-20 rounded-sm bg-ck-gray-200" />
              <div className="h-4 w-28 rounded-sm bg-ck-gray-100" />
            </div>
            <span className="ck-label mt-3 flex items-center gap-2 text-ck-text-muted">
              <FocusMark size="sm" />
              Próximamente
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
