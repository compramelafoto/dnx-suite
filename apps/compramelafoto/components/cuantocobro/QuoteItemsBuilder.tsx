"use client";

import JobShutterWearSummary from "@/components/cuantocobro/JobShutterWearSummary";
import ProductServicePickerModal from "@/components/cuantocobro/ProductServicePickerModal";
import QuoteItemEditModal from "@/components/cuantocobro/QuoteItemEditModal";
import {
  calculateQuoteSummary,
  formatCuantoCobroCurrency,
  formatCuantoCobroHours,
} from "@/lib/cuantocobro/calculate-cuanto-cobro";
import { getQuoteLaborRates } from "@/lib/cuantocobro/hourly-rates";
import { buildCameraWearPolicy } from "@/lib/cuantocobro/camera-wear-policy";
import { normalizeQuoteHoursForCalculation } from "@/lib/cuantocobro/normalize-quote-hours";
import {
  createQuoteItemFromCatalogOption,
  formatProductServiceListLabel,
} from "@/lib/cuantocobro/product-service-catalog";
import {
  createQuoteItemFromProductServiceTemplate,
  deleteProductServiceTemplate,
  loadProductServiceTemplates,
  recordProductServiceTemplateUsage,
  saveProductServiceTemplates,
  upsertProductServiceTemplate,
} from "@/lib/cuantocobro/product-service-templates";
import { PRODUCT_SERVICE_TYPE_LABELS } from "@/lib/cuantocobro/quote-access";
import {
  getConceptListMeta,
  isConceptSetupIncomplete,
} from "@/lib/cuantocobro/quote-item-list-meta";
import { duplicateQuoteItem } from "@/lib/cuantocobro/quote-items";
import type {
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
  CuantoCobroQuoteItem,
} from "@/lib/cuantocobro/types";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
  onQuoteChange: <K extends keyof CuantoCobroQuoteInput>(key: K, value: CuantoCobroQuoteInput[K]) => void;
};

function updateConcepts(
  concepts: CuantoCobroQuoteItem[],
  conceptId: string,
  patch: Partial<CuantoCobroQuoteItem>,
): CuantoCobroQuoteItem[] {
  return concepts.map((concept) => (concept.id === conceptId ? { ...concept, ...patch } : concept));
}

export default function QuoteItemsBuilder({ profile, quote, onQuoteChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [rememberTemplateValues, setRememberTemplateValues] = useState(true);
  const [templates, setTemplates] = useState(() => loadProductServiceTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    saveProductServiceTemplates(templates);
  }, [templates]);

  const laborRates = useMemo(() => getQuoteLaborRates(profile), [profile]);
  const cameraWearPolicy = useMemo(() => buildCameraWearPolicy(profile), [profile]);
  const summary = useMemo(() => {
    if (!laborRates) return null;
    const { quote: normalizedQuote } = normalizeQuoteHoursForCalculation(quote);
    return calculateQuoteSummary(normalizedQuote.concepts, laborRates, cameraWearPolicy);
  }, [quote, laborRates, cameraWearPolicy]);
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, profile.currency || "ARS");

  const setConcepts = (concepts: CuantoCobroQuoteInput["concepts"]) => onQuoteChange("concepts", concepts);

  const editingIndex = editingConceptId ? quote.concepts.findIndex((concept) => concept.id === editingConceptId) : -1;
  const editingConcept = editingIndex >= 0 ? quote.concepts[editingIndex] : null;
  const editingRow = editingIndex >= 0 ? summary?.items[editingIndex] ?? null : null;

  const openEditor = (conceptId: string) => {
    setRememberTemplateValues(true);
    setEditingConceptId(conceptId);
  };

  const finishEditor = () => {
    if (editingConcept?.libraryTemplateId && rememberTemplateValues) {
      setTemplates((current) =>
        recordProductServiceTemplateUsage(current, editingConcept.libraryTemplateId!, editingConcept),
      );
    }
    setEditingConceptId(null);
    setRememberTemplateValues(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setSelectedTemplateId("");
  };

  const addFromCatalog = (catalogId: string) => {
    const concept = createQuoteItemFromCatalogOption(catalogId);
    setConcepts([...quote.concepts, concept]);
    setEditingConceptId(concept.id);
    closePicker();
  };

  const applyTemplate = () => {
    const template = templates.find((row) => row.id === selectedTemplateId);
    if (!template) return;
    const concept = createQuoteItemFromProductServiceTemplate(template);
    setConcepts([...quote.concepts, concept]);
    setEditingConceptId(concept.id);
    closePicker();
  };

  const handleDuplicateConcept = (conceptId: string) => {
    const index = quote.concepts.findIndex((concept) => concept.id === conceptId);
    if (index < 0) return;
    const copy = duplicateQuoteItem(quote.concepts[index]);
    const next = [...quote.concepts];
    next.splice(index + 1, 0, copy);
    setConcepts(next);
  };

  const handleRemoveConcept = (conceptId: string) => {
    setConcepts(quote.concepts.filter((concept) => concept.id !== conceptId));
    if (editingConceptId === conceptId) {
      setEditingConceptId(null);
      setRememberTemplateValues(true);
    }
  };

  return (
    <div className="ds-stack-section cc-quote-items">
      <section className="cc-quote-items__intro" aria-labelledby="cc-quote-items-intro-title">
        <h4 id="cc-quote-items-intro-title" className="cc-quote-items__intro-title m-0">
          ¿Qué le vas a vender al cliente?
        </h4>
        <p className="cc-quote-items__intro-hint m-0 mt-2 text-sm text-[var(--cc-color-muted)]">
          Agregá productos o servicios con horas propias, costos y margen. Podés guardarlos en tu biblioteca para
          reutilizarlos en otros presupuestos.
        </p>
      </section>

      <section className="cc-quote-items__list-section" aria-labelledby="cc-quote-items-list-title">
        <div className="cc-quote-items__list-header">
          <div className="cc-quote-items__list-header-main">
            <h4 id="cc-quote-items-list-title" className="cc-quote-items__list-title m-0">
              Productos y servicios
            </h4>
            {quote.concepts.length > 0 ? (
              <span className="cc-quote-items__list-count">{quote.concepts.length}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="cc-quote-items__add-icon-btn"
            title="Agregar producto o servicio"
            aria-label="Agregar producto o servicio"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="cc-quote-items__add-icon-btn__icon" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        {quote.concepts.length === 0 ? (
          <div className="cc-quote-items__empty">
            <DsEmptyState title="Sin productos ni servicios" variant="tight">
              <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                Agregá cobertura, fotolibro, viáticos u otras líneas. Podés guardar plantillas en tu biblioteca para
                reutilizarlas.
              </p>
              <div className="ds-empty-state__actions mt-4">
                <CuantoCobroButton
                  type="button"
                  variant="primary"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => setPickerOpen(true)}
                >
                  Agregar producto o servicio
                </CuantoCobroButton>
              </div>
            </DsEmptyState>
          </div>
        ) : (
          <ul className="cc-quote-items-list m-0 p-0 list-none">
            {quote.concepts.map((concept, index) => {
              const row = summary?.items[index];
              const incomplete = isConceptSetupIncomplete(concept);
              const displayName = formatProductServiceListLabel(index, concept.name);
              const typeLabel = PRODUCT_SERVICE_TYPE_LABELS[concept.itemType];

              return (
                <li key={concept.id}>
                  <div
                    className={`cc-quote-item-row-shell${incomplete ? " cc-quote-item-row-shell--incomplete" : ""}`}
                  >
                    <button
                      type="button"
                      className="cc-quote-item-row__open"
                      onClick={() => openEditor(concept.id)}
                      aria-label={`Editar ${displayName}`}
                    >
                      <span className="cc-quote-item-row__index" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="cc-quote-item-row__content">
                        <span className="cc-quote-item-row__name-row">
                          <span className="cc-quote-item-row__name">{displayName}</span>
                          <span className="cc-quote-item-row__type">{typeLabel}</span>
                          {incomplete ? (
                            <span className="cc-quote-item-row__badge">Completar</span>
                          ) : null}
                        </span>
                        <span className="cc-quote-item-row__meta">{getConceptListMeta(concept, row)}</span>
                      </span>
                      <span className="cc-quote-item-row__aside">
                        <span className="cc-quote-item-row__price">{row ? fmt(row.suggestedPrice) : "—"}</span>
                        <ChevronRight className="cc-quote-item-row__chevron" strokeWidth={2} aria-hidden="true" />
                      </span>
                    </button>
                    <div className="cc-quote-item-row__tools">
                      <button
                        type="button"
                        className="cc-quote-item-row__icon-btn"
                        aria-label={`Duplicar ${displayName}`}
                        onClick={() => handleDuplicateConcept(concept.id)}
                      >
                        <Copy className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cc-quote-item-row__icon-btn cc-quote-item-row__icon-btn--danger"
                        aria-label={`Eliminar ${displayName}`}
                        onClick={() => handleRemoveConcept(concept.id)}
                      >
                        <Trash2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProductServicePickerModal
        open={pickerOpen}
        onClose={closePicker}
        onSelect={addFromCatalog}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectedTemplateIdChange={setSelectedTemplateId}
        onApplyTemplate={applyTemplate}
        onDeleteSelectedTemplate={() => {
          setTemplates(deleteProductServiceTemplate(templates, selectedTemplateId));
          setSelectedTemplateId("");
        }}
      />

      <QuoteItemEditModal
        open={editingConceptId !== null && editingConcept !== null}
        item={editingConcept}
        itemIndex={editingIndex}
        currency={profile.currency}
        laborRates={laborRates}
        calculatedRow={editingRow}
        onClose={finishEditor}
        onChange={(patch) => {
          if (!editingConceptId) return;
          setConcepts(updateConcepts(quote.concepts, editingConceptId, patch));
        }}
        onSaveTemplate={(name) => {
          if (!editingConcept) return;
          setTemplates(upsertProductServiceTemplate(templates, editingConcept, name));
        }}
        rememberTemplateValues={rememberTemplateValues}
        onRememberTemplateValuesChange={setRememberTemplateValues}
      />

      {summary ? (
        <div className="cc-quote-items__totals" role="status">
          <h4 className="cc-quote-items__totals-title m-0">Resumen de productos y servicios</h4>
          <dl className="cc-quote-items__totals-list">
            <div>
              <dt>Servicios propios</dt>
              <dd>{fmt(summary.subtotalOwnService)}</dd>
            </div>
            <div>
              <dt>Productos físicos</dt>
              <dd>{fmt(summary.subtotalPhysicalProduct)}</dd>
            </div>
            <div>
              <dt>Tercerizados</dt>
              <dd>{fmt(summary.subtotalOutsourced)}</dd>
            </div>
            <div>
              <dt>Gastos / viáticos</dt>
              <dd>{fmt(summary.subtotalExpense)}</dd>
            </div>
            <div>
              <dt>Total horas propias</dt>
              <dd>{formatCuantoCobroHours(summary.totalOwnHours)}</dd>
            </div>
            <div>
              <dt>Ganancia / margen estimado</dt>
              <dd>{fmt(summary.totalMarginAmount)}</dd>
            </div>
            <div className="cc-quote-items__totals-highlight">
              <dt>Total sugerido</dt>
              <dd>{fmt(summary.totalSuggestedPrice)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <JobShutterWearSummary profile={profile} quote={quote} />
    </div>
  );
}
