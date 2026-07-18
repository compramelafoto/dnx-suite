import type {
  PreparedPricingConcept,
  PricingConfigurationIssue,
  PricingJobInput,
} from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { amountToCompatibleString, hoursToCompatibleString } from "./amount-strings.js";
import type { CompatibleQuoteItem, CompatibleQuoteItemType } from "./compatible-models.js";

const TYPE_MAP: Record<PreparedPricingConcept["type"], CompatibleQuoteItemType> = {
  OWN_SERVICE: "own-service",
  PRODUCT: "physical-product",
  OUTSOURCED: "outsourced",
  EXPENSE: "expense",
};

function emptyItem(partial: Partial<CompatibleQuoteItem> & Pick<CompatibleQuoteItem, "id" | "name" | "itemType">): CompatibleQuoteItem {
  return {
    id: partial.id,
    name: partial.name,
    description: partial.description ?? "",
    quantity: partial.quantity ?? "1",
    itemType: partial.itemType,
    coverageHours: partial.coverageHours ?? "",
    editingHours: partial.editingHours ?? "",
    selectionHours: "",
    deliveryHours: partial.deliveryHours ?? "",
    travelHours: partial.travelHours ?? "",
    administrationHours: "",
    salesHours: "",
    directCost: partial.directCost ?? "",
    estimatedShots: partial.estimatedShots ?? "",
    supplierCost: partial.supplierCost ?? "",
    productionHours: partial.productionHours ?? "",
    reviewHours: "",
    correctionHours: "",
    packagingCost: "",
    shippingCost: "",
    outsourcedLaborCost: partial.outsourcedLaborCost ?? "",
    managementHours: partial.managementHours ?? "",
    expenseCost: partial.expenseCost ?? "",
    desiredMarginPercent: partial.desiredMarginPercent ?? "",
  };
}

export type MapConceptsResult =
  | { status: "OK"; concepts: CompatibleQuoteItem[]; warnings: PricingConfigurationIssue[] }
  | { status: "INVALID"; issues: PricingConfigurationIssue[] };

/**
 * Conceptos preparados → líneas del quote.
 * No aplica márgenes ni tarifas; solo transporta montos/horas configurados.
 */
export function mapPreparedConceptsToCompatibleItems(
  job: PricingJobInput,
): MapConceptsResult {
  const warnings: PricingConfigurationIssue[] = [];
  const issues: PricingConfigurationIssue[] = [];
  const concepts: CompatibleQuoteItem[] = [];

  let ownServiceIndex = 0;

  for (const concept of job.plannedConcepts) {
    if (concept.calculationMode === "MANUAL") {
      issues.push(
        issue(
          PricingIssueCode.ADAPTER_CONCEPT_UNMAPPABLE,
          `concepts.${concept.id}`,
          "ERROR",
          "Concepto MANUAL no se puede mapear automáticamente.",
        ),
      );
      continue;
    }

    const itemType = TYPE_MAP[concept.type];
    if (!itemType) {
      issues.push(
        issue(
          PricingIssueCode.ADAPTER_CONCEPT_UNMAPPABLE,
          `concepts.${concept.id}`,
          "ERROR",
          "Tipo de concepto no mapeable.",
        ),
      );
      continue;
    }

    const qty = amountToCompatibleString(concept.quantity);
    const margin = amountToCompatibleString(concept.marginPercent);
    const direct = amountToCompatibleString(concept.directCost);

    switch (concept.type) {
      case "OWN_SERVICE": {
        const isPrimary = ownServiceIndex === 0;
        ownServiceIndex += 1;
        concepts.push(
          emptyItem({
            id: concept.id,
            name: concept.label,
            itemType: "own-service",
            quantity: qty || "1",
            coverageHours: hoursToCompatibleString(
              isPrimary ? job.coverageHours : concept.hours,
            ),
            editingHours: hoursToCompatibleString(
              isPrimary ? job.editingHours : undefined,
            ),
            directCost: direct,
            desiredMarginPercent: margin,
            estimatedShots: concept.includeEquipmentWear ? "" : "",
          }),
        );
        break;
      }
      case "PRODUCT":
        concepts.push(
          emptyItem({
            id: concept.id,
            name: concept.label,
            itemType: "physical-product",
            quantity: qty || "1",
            supplierCost: direct,
            productionHours: hoursToCompatibleString(concept.hours),
            desiredMarginPercent: margin,
          }),
        );
        break;
      case "OUTSOURCED":
        concepts.push(
          emptyItem({
            id: concept.id,
            name: concept.label,
            itemType: "outsourced",
            quantity: qty || "1",
            outsourcedLaborCost: direct,
            managementHours: hoursToCompatibleString(concept.hours),
            desiredMarginPercent: margin,
          }),
        );
        break;
      case "EXPENSE":
        concepts.push(
          emptyItem({
            id: concept.id,
            name: concept.label,
            itemType: "expense",
            quantity: qty || "1",
            expenseCost: direct || hoursToCompatibleString(concept.hours),
          }),
        );
        break;
      default:
        issues.push(
          issue(
            PricingIssueCode.ADAPTER_CONCEPT_UNMAPPABLE,
            `concepts.${concept.id}`,
            "ERROR",
            "Concepto imposible de mapear.",
          ),
        );
    }
  }

  if (concepts.length === 0 && issues.length === 0) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_REQUIRED_FIELD_MISSING,
        "concepts",
        "ERROR",
        "No hay conceptos mapeables.",
      ),
    );
  }

  if (issues.length > 0) {
    return { status: "INVALID", issues };
  }

  return { status: "OK", concepts, warnings };
}
