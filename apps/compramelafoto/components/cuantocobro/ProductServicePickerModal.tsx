"use client";

import AppModal from "@/components/ui/AppModal";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Select from "@/components/ui/Select";
import {
  PRODUCT_SERVICE_CATALOG,
  type ProductServiceCatalogOption,
} from "@/lib/cuantocobro/product-service-catalog";
import type { CuantoCobroProductServiceTemplate } from "@/lib/cuantocobro/types";
import {
  BookOpen,
  Camera,
  Clapperboard,
  Frame,
  Image,
  Plane,
  Plus,
  Printer,
  Receipt,
  Scissors,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

const CATALOG_ICONS: Record<string, LucideIcon> = {
  coverage: Camera,
  session: Users,
  editing: Scissors,
  photobook: BookOpen,
  prints: Printer,
  canvas: Frame,
  video: Clapperboard,
  drone: Plane,
  "second-photographer": UserPlus,
  makeup: Image,
  expenses: Receipt,
  other: Plus,
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (catalogId: string) => void;
  templates: CuantoCobroProductServiceTemplate[];
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (templateId: string) => void;
  onApplyTemplate: () => void;
  onDeleteSelectedTemplate: () => void;
};

function CatalogCard({
  option,
  onSelect,
}: {
  option: ProductServiceCatalogOption;
  onSelect: (catalogId: string) => void;
}) {
  const Icon = CATALOG_ICONS[option.id] ?? Plus;

  return (
    <button
      type="button"
      className="cc-product-picker-card"
      onClick={() => onSelect(option.id)}
    >
      <span className="cc-product-picker-card__icon" aria-hidden="true">
        <Icon strokeWidth={1.75} />
      </span>
      <span className="cc-product-picker-card__content">
        <span className="cc-product-picker-card__title">{option.title}</span>
        <span className="cc-product-picker-card__description">{option.description}</span>
      </span>
    </button>
  );
}

export default function ProductServicePickerModal({
  open,
  onClose,
  onSelect,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  onApplyTemplate,
  onDeleteSelectedTemplate,
}: Props) {
  const handleSelect = (catalogId: string) => {
    onSelect(catalogId);
    onClose();
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}

      maxWidthCapRem="48rem"
      title="Agregar producto o servicio"
      description="Elegí del catálogo o usá una plantilla guardada. Podés editar todo después."
      panelClassName="cc-product-picker-modal cc-page"
      contentClassName="!p-0 overflow-hidden"
      zIndexClass="z-[96]"
    >
      <div className="cc-product-picker-modal__scroll">
        <section
          className={`cc-quote-items__library cc-product-picker-modal__library${templates.length === 0 ? " cc-product-picker-modal__library--empty" : ""}`}
          aria-labelledby="cc-picker-library-title"
        >
          <h4 id="cc-picker-library-title" className="cc-quote-items__library-title m-0">
            Biblioteca
          </h4>
          {templates.length > 0 ? (
            <>
              <p className="cc-quote-items__library-hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
                Plantillas guardadas en este dispositivo. Al usarlas podés editar los valores sin afectar la plantilla.
              </p>
              <DsField label="Usar plantilla de la biblioteca" htmlFor="cc-picker-template" className="mt-3">
                <div className="cc-quote-item__template-row">
                  <Select
                    id="cc-picker-template"
                    className="min-h-[44px]"
                    value={selectedTemplateId}
                    onChange={(e) => onSelectedTemplateIdChange(e.target.value)}
                  >
                    <option value="">Seleccioná una plantilla…</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.lastUsedValues ? " · valores recordados" : ""}
                      </option>
                    ))}
                  </Select>
                  <CuantoCobroButton
                    type="button"
                    variant="primary"
                    className="min-h-[44px] shrink-0"
                    disabled={!selectedTemplateId}
                    onClick={onApplyTemplate}
                  >
                    Usar
                  </CuantoCobroButton>
                </div>
              </DsField>
              {selectedTemplateId ? (
                <CuantoCobroButton
                  type="button"
                  variant="secondary"
                  className="mt-2 min-h-[44px]"
                  onClick={onDeleteSelectedTemplate}
                >
                  Eliminar plantilla seleccionada
                </CuantoCobroButton>
              ) : null}
            </>
          ) : (
            <p className="cc-quote-items__library-hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
              Todavía no tenés plantillas guardadas. Al editar un producto o servicio podés marcar{" "}
              <strong>Recordar últimos valores</strong> para reutilizarlos en futuros presupuestos.
            </p>
          )}
        </section>

        <section aria-labelledby="cc-picker-catalog-title">
          <h4 id="cc-picker-catalog-title" className="cc-product-picker-modal__catalog-title m-0">
            Catálogo sugerido
          </h4>
          <p className="cc-product-picker-modal__catalog-hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
            Punto de partida rápido. Lo que elijas se agrega al presupuesto y podés personalizarlo.
          </p>
          <ul className="cc-product-picker-grid m-0 list-none p-0">
            {PRODUCT_SERVICE_CATALOG.map((option) => (
              <li key={option.id}>
                <CatalogCard option={option} onSelect={handleSelect} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppModal>
  );
}
