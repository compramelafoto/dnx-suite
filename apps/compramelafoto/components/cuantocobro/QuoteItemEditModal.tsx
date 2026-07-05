"use client";

import QuoteItemEditor from "@/components/cuantocobro/QuoteItemEditor";
import AppModal from "@/components/ui/AppModal";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { QuoteLaborRates } from "@/lib/cuantocobro/hourly-rates";
import { PRODUCT_SERVICE_TYPE_LABELS } from "@/lib/cuantocobro/quote-access";
import type { CuantoCobroQuoteItem } from "@/lib/cuantocobro/types";
import type { CuantoCobroQuoteItemCalculated } from "@/lib/cuantocobro/quote-item-calculations";

type Props = {
  open: boolean;
  item: CuantoCobroQuoteItem | null;
  itemIndex: number;
  currency: string;
  laborRates: QuoteLaborRates | null;
  calculatedRow: CuantoCobroQuoteItemCalculated | null;
  onClose: () => void;
  onChange: (patch: Partial<CuantoCobroQuoteItem>) => void;
  onSaveTemplate: (name: string) => void;
  rememberTemplateValues?: boolean;
  onRememberTemplateValuesChange?: (value: boolean) => void;
};

export default function QuoteItemEditModal({
  open,
  item,
  itemIndex,
  currency,
  laborRates,
  calculatedRow,
  onClose,
  onChange,
  onSaveTemplate,
  rememberTemplateValues,
  onRememberTemplateValuesChange,
}: Props) {
  if (!item) return null;

  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, currency || "ARS");
  const displayName = item.name.trim() || `Producto o servicio ${itemIndex + 1}`;

  return (
    <AppModal
      open={open}
      onClose={onClose}

      maxWidthCapRem="48rem"
      title={displayName}
      description={
        <div className="cc-quote-item-modal__meta">
          <span className="cc-quote-item-modal__type-badge">
            {PRODUCT_SERVICE_TYPE_LABELS[item.itemType]}
          </span>
          {calculatedRow ? (
            <span className="cc-quote-item-modal__price-hint">
              Precio sugerido: <strong>{fmt(calculatedRow.suggestedPrice)}</strong>
            </span>
          ) : null}
        </div>
      }
      panelClassName="cc-quote-item-modal cc-page"
      contentClassName="!p-0 overflow-hidden"
      zIndexClass="z-[95]"
    >
      <div className="cc-quote-item-modal__scroll">
        <QuoteItemEditor
          item={item}
          currency={currency}
          laborRates={laborRates}
          onChange={onChange}
          onSaveTemplate={onSaveTemplate}
          rememberTemplateValues={rememberTemplateValues}
          onRememberTemplateValuesChange={onRememberTemplateValuesChange}
        />
      </div>
      <footer className="cc-quote-item-modal__footer">
        <CuantoCobroButton
          type="button"
          variant="primary"


          className="min-h-[44px] w-full sm:w-auto sm:min-w-[10rem]"
          onClick={onClose}
        >
          Listo
        </CuantoCobroButton>
      </footer>
    </AppModal>
  );
}
