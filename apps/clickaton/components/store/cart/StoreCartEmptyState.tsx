import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import { routes } from "@/config/navigation";

export function StoreCartEmptyState() {
  return (
    <Card variant="outlined" className="border-dashed bg-ck-surface">
      <EditorialLabel tone="yellow">Carrito</EditorialLabel>
      <p className="ck-heading-lg mt-4 text-ck-text">Tu carrito está vacío.</p>
      <p className="ck-body-sm mt-3 max-w-prose text-ck-text-muted">
        Explorá los productos oficiales de Clickatón.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <FocusMark className="text-ck-yellow/50" aria-hidden />
        <Button href={routes.store} variant="primary">
          Ver productos
        </Button>
      </div>
    </Card>
  );
}
