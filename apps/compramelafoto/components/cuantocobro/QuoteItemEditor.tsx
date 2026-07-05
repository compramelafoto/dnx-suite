"use client";

import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  calculateQuoteSummary,
  formatCuantoCobroCurrency,
  formatCuantoCobroHours,
} from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { QuoteLaborRates } from "@/lib/cuantocobro/hourly-rates";
import {
  QUOTE_ITEM_OWN_HOUR_FIELDS,
  QUOTE_ITEM_OWN_HOUR_HINTS,
  QUOTE_ITEM_OWN_HOUR_LABELS,
} from "@/lib/cuantocobro/quote-item-hours";
import {
  QUOTE_ITEM_OUTSOURCED_MARGIN_HINT,
  QUOTE_ITEM_OUTSOURCED_MARGIN_LABEL,
  QUOTE_ITEM_PHYSICAL_PRODUCT_MARGIN_HINT,
  QUOTE_ITEM_PHYSICAL_PRODUCT_MARGIN_LABEL,
} from "@/lib/cuantocobro/quote-items";
import { PRODUCT_SERVICE_TYPE_LABELS } from "@/lib/cuantocobro/quote-access";
import type { CuantoCobroQuoteItem, CuantoCobroQuoteItemType } from "@/lib/cuantocobro/types";
import { useState, type ReactNode } from "react";

const DS_FORM_GRID = "ds-form-grid grid grid-cols-1 gap-4 sm:grid-cols-2";
const DS_FORM_GRID_NAME_QTY = "ds-form-grid grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_6.5rem]";

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="cc-quote-item__section">
      <header className="cc-quote-item__section-header">
        <h3 className="cc-quote-item__section-title m-0">{title}</h3>
        {description ? <p className="cc-quote-item__section-desc m-0">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export type QuoteItemEditorProps = {
  item: CuantoCobroQuoteItem;
  currency: string;
  laborRates: QuoteLaborRates | null;
  onChange: (patch: Partial<CuantoCobroQuoteItem>) => void;
  onSaveTemplate: (name: string) => void;
  rememberTemplateValues?: boolean;
  onRememberTemplateValuesChange?: (value: boolean) => void;
  showActions?: boolean;
};

export default function QuoteItemEditor({
  item,
  currency,
  laborRates,
  onChange,
  onSaveTemplate,
  rememberTemplateValues = true,
  onRememberTemplateValuesChange,
  showActions = true,
}: QuoteItemEditorProps) {
  const [templateName, setTemplateName] = useState("");
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, currency || "ARS");
  const row = laborRates ? calculateQuoteSummary([item], laborRates).items[0] : null;

  return (
    <div className="cc-quote-item__body ds-form-stack">
      <EditorSection title="Identificación">
        <div className={DS_FORM_GRID_NAME_QTY}>
          <DsField label="Nombre del producto o servicio" htmlFor={`cc-qi-name-${item.id}`}>
            <Input
              id={`cc-qi-name-${item.id}`}
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Ej: Cobertura de evento"
            />
          </DsField>
          <DsField label="Cant." htmlFor={`cc-qi-qty-${item.id}`}>
            <Input
              id={`cc-qi-qty-${item.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={item.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          </DsField>
        </div>

        <DsField label="Tipo de producto o servicio" htmlFor={`cc-qi-type-${item.id}`} className="mt-4">
          <Select
              id={`cc-qi-type-${item.id}`}
              value={item.itemType}
              onChange={(e) => onChange({ itemType: e.target.value as CuantoCobroQuoteItemType })}
            >
              {(Object.keys(PRODUCT_SERVICE_TYPE_LABELS) as CuantoCobroQuoteItemType[]).map((type) => (
                <option key={type} value={type}>
                  {PRODUCT_SERVICE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
        </DsField>

        <DsField
          label="Descripción comercial (opcional)"
          htmlFor={`cc-qi-desc-${item.id}`}
          className="mt-4"
        >
          <Textarea
            id={`cc-qi-desc-${item.id}`}
            rows={2}
            value={item.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Detalle visible para el cliente si mostrás el desglose"
          />
        </DsField>
      </EditorSection>

      {item.itemType === "own-service" && (
        <>
          <EditorSection title="Horas de producción">
            <div className="ds-info-panel cc-info-panel--accent">
              <p className="ds-info-panel__title m-0">¿Qué cargar acá?</p>
              <p className="ds-info-panel__body m-0 mt-2 text-sm leading-relaxed">
                Cargá el tiempo de <strong>producción</strong> de lo que estás cotizando: cobertura, postproducción
              (edición, selección y exportación), traslado y entrega de material.
              </p>
              <p className="ds-info-panel__body m-0 mt-2 text-sm leading-relaxed">
                <strong>No incluyas</strong> ventas, reuniones, coordinación general ni facturación — esas horas van
                en el paso <strong>Cliente</strong> y se cuentan una sola vez por presupuesto.
              </p>
            </div>
            <div className={`cc-quote-item__hours ${DS_FORM_GRID} mt-4`}>
              {QUOTE_ITEM_OWN_HOUR_FIELDS.map((field) => (
                <DsField
                  key={field}
                  label={QUOTE_ITEM_OWN_HOUR_LABELS[field]}
                  htmlFor={`cc-qi-${field}-${item.id}`}
                  hint={QUOTE_ITEM_OWN_HOUR_HINTS[field]}
                  className="cc-quote-item__hour-field"
                >
                  <Input
                    id={`cc-qi-${field}-${item.id}`}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="0"
                    className="cc-quote-item__hour-input"
                    value={item[field]}
                    onChange={(e) => onChange({ [field]: e.target.value } as Partial<CuantoCobroQuoteItem>)}
                  />
                </DsField>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Costos adicionales" description="Opcional. Sumá gastos directos o disparos estimados.">
            <div className={DS_FORM_GRID}>
              <DsField label="Costo directo" htmlFor={`cc-qi-direct-${item.id}`}>
                <CuantoCobroPriceInput
                  id={`cc-qi-direct-${item.id}`}
                  value={item.directCost}
                  onValueChange={(value) => onChange({ directCost: value })}
                />
              </DsField>
              <DsField label="Disparos estimados" htmlFor={`cc-qi-shots-${item.id}`}>
                <Input
                  id={`cc-qi-shots-${item.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={item.estimatedShots}
                  onChange={(e) => onChange({ estimatedShots: e.target.value })}
                />
              </DsField>
            </div>
          </EditorSection>
        </>
      )}

      {item.itemType === "physical-product" && (
        <EditorSection title="Producto físico">
          <DsField label="Costo proveedor / laboratorio" htmlFor={`cc-qi-supplier-${item.id}`}>
            <CuantoCobroPriceInput
              id={`cc-qi-supplier-${item.id}`}
              value={item.supplierCost}
              onValueChange={(value) => onChange({ supplierCost: value })}
            />
          </DsField>
          <div className={`cc-quote-item__hours ${DS_FORM_GRID} mt-4`}>
            <DsField
              label="Horas de diseño"
              htmlFor={`cc-qi-prod-${item.id}`}
              hint="Diseño y armado de este producto; se valora con tu costo hora."
            >
              <Input
                id={`cc-qi-prod-${item.id}`}
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="0"
                value={item.productionHours}
                onChange={(e) => onChange({ productionHours: e.target.value })}
              />
            </DsField>
            <DsField label="Horas de revisión" htmlFor={`cc-qi-review-${item.id}`}>
              <Input
                id={`cc-qi-review-${item.id}`}
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="0"
                value={item.reviewHours}
                onChange={(e) => onChange({ reviewHours: e.target.value })}
              />
            </DsField>
            <DsField label="Horas de corrección" htmlFor={`cc-qi-correction-${item.id}`}>
              <Input
                id={`cc-qi-correction-${item.id}`}
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="0"
                value={item.correctionHours}
                onChange={(e) => onChange({ correctionHours: e.target.value })}
              />
            </DsField>
          </div>
          <div className={`${DS_FORM_GRID} mt-4`}>
            <DsField label="Costo de embalaje" htmlFor={`cc-qi-packaging-${item.id}`}>
              <CuantoCobroPriceInput
                id={`cc-qi-packaging-${item.id}`}
                value={item.packagingCost}
                onValueChange={(value) => onChange({ packagingCost: value })}
              />
            </DsField>
            <DsField label="Costo de envío" htmlFor={`cc-qi-shipping-${item.id}`}>
              <CuantoCobroPriceInput
                id={`cc-qi-shipping-${item.id}`}
                value={item.shippingCost}
                onValueChange={(value) => onChange({ shippingCost: value })}
              />
            </DsField>
          </div>
          <DsField
            label={QUOTE_ITEM_PHYSICAL_PRODUCT_MARGIN_LABEL}
            htmlFor={`cc-qi-margin-${item.id}`}
            hint={QUOTE_ITEM_PHYSICAL_PRODUCT_MARGIN_HINT}
            className="mt-4 sm:max-w-[12rem]"
          >
            <Input
              id={`cc-qi-margin-${item.id}`}
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Ej: 30"
              value={item.desiredMarginPercent}
              onChange={(e) => onChange({ desiredMarginPercent: e.target.value })}
            />
          </DsField>
        </EditorSection>
      )}

      {item.itemType === "outsourced" && (
        <EditorSection title="Trabajo tercerizado">
          <div className={DS_FORM_GRID}>
          <DsField label="Costo del tercero" htmlFor={`cc-qi-out-${item.id}`}>
            <CuantoCobroPriceInput
              id={`cc-qi-out-${item.id}`}
              value={item.outsourcedLaborCost}
              onValueChange={(value) => onChange({ outsourcedLaborCost: value })}
            />
          </DsField>
          <DsField
            label="Horas de gestión / coordinación"
            htmlFor={`cc-qi-mgmt-${item.id}`}
            hint="Coordinación de este tercero puntual; la gestión general del cliente va en el paso Cliente."
          >
            <Input
              id={`cc-qi-mgmt-${item.id}`}
              type="number"
              min={0}
              inputMode="decimal"
              value={item.managementHours}
              onChange={(e) => onChange({ managementHours: e.target.value })}
            />
            </DsField>
          </div>
          <DsField
            label={QUOTE_ITEM_OUTSOURCED_MARGIN_LABEL}
            htmlFor={`cc-qi-margin-${item.id}`}
            hint={QUOTE_ITEM_OUTSOURCED_MARGIN_HINT}
            className="mt-4 sm:max-w-[12rem]"
          >
            <Input
              id={`cc-qi-margin-${item.id}`}
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Ej: 20"
              value={item.desiredMarginPercent}
              onChange={(e) => onChange({ desiredMarginPercent: e.target.value })}
            />
          </DsField>
        </EditorSection>
      )}

      {item.itemType === "expense" && (
        <EditorSection title="Gasto / viático">
          <DsField label="Costo" htmlFor={`cc-qi-expense-${item.id}`}>
            <CuantoCobroPriceInput
              id={`cc-qi-expense-${item.id}`}
              value={item.expenseCost}
              onValueChange={(value) => onChange({ expenseCost: value })}
            />
          </DsField>
        </EditorSection>
      )}

      <EditorSection title="Resultado">
        {row ? (
          <div className="cc-quote-item__calc" role="status">
            <dl className="cc-quote-item__calc-list">
              <div>
                <dt>Costo base</dt>
                <dd>{fmt(row.baseCost)}</dd>
              </div>
              {row.ownHours > 0 ? (
                <div>
                  <dt>Horas propias</dt>
                  <dd>{formatCuantoCobroHours(row.ownHours)}</dd>
                </div>
              ) : null}
              {row.marginAmount > 0 ? (
                <div>
                  <dt>
                    {item.itemType === "physical-product"
                      ? "Ganancia"
                      : item.itemType === "outsourced"
                        ? "Margen comercial"
                        : "Margen"}
                  </dt>
                  <dd>{fmt(row.marginAmount)}</dd>
                </div>
              ) : null}
              <div className="cc-quote-item__calc-highlight">
                <dt>Precio sugerido</dt>
                <dd>{fmt(row.suggestedPrice)}</dd>
              </div>
            </dl>
            {item.itemType === "own-service" ? (
              <p className="cc-quote-item__calc-note m-0 mt-3 text-sm text-[var(--cc-color-muted)]">
                Tu rentabilidad como servicio propio se refleja en el costo hora y en el precio recomendado del
                presupuesto.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="ds-info-panel cc-info-panel--accent" role="status">
            <p className="ds-info-panel__body m-0 text-sm">
              Completá tu perfil para calcular el precio con tu Valor Hora Hombre.
            </p>
          </div>
        )}
      </EditorSection>

      {showActions ? (
        <EditorSection
          title="Biblioteca"
          description="Opcional. Guardá este ítem como plantilla reutilizable."
        >
          {item.libraryTemplateId && onRememberTemplateValuesChange ? (
            <label className="cc-quote-item__remember flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="cc-quote-item__remember-input h-5 w-5 shrink-0 accent-[var(--cc-color-primary,#2d6a4f)]"
                checked={rememberTemplateValues}
                onChange={(e) => onRememberTemplateValuesChange(e.target.checked)}
              />
              <span className="text-sm text-[var(--cc-color-dark)]">
                Recordar estos valores para la próxima vez
              </span>
            </label>
          ) : null}

          <div className={`cc-quote-item__template${item.libraryTemplateId ? " mt-4" : ""}`}>
            <DsField label="Guardar como nueva plantilla" htmlFor={`cc-qi-template-${item.id}`}>
              <div className="cc-quote-item__template-row">
                <Input
                  id={`cc-qi-template-${item.id}`}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nombre de la nueva plantilla"
                />
                <CuantoCobroButton
                  type="button"
                  variant="outline"

                  className="min-h-[44px] shrink-0"
                  disabled={!templateName.trim() || !item.name.trim()}
                  onClick={() => {
                    onSaveTemplate(templateName);
                    setTemplateName("");
                  }}
                >
                  Guardar nueva
                </CuantoCobroButton>
              </div>
            </DsField>
          </div>
        </EditorSection>
      ) : null}
    </div>
  );
}
