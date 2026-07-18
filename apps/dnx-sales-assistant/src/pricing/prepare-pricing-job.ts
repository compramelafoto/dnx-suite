import type { QuoteRequestDraft } from "../quote-request/models.js";
import type {
  PreparedPricingConcept,
  PreparedPricingJobResult,
  PricingJobInput,
  PricingServiceTemplate,
} from "./models.js";

function resolvePlannedConcepts(
  template: PricingServiceTemplate,
  coverageHours: number,
): PreparedPricingConcept[] {
  return template.concepts.map((c) => {
    let hours = c.hours;
    if (c.calculationMode === "PER_COVERAGE_HOUR" && c.hoursPerCoverageHour !== undefined) {
      hours = coverageHours * c.hoursPerCoverageHour;
    }
    return {
      id: c.id,
      label: c.label,
      type: c.type,
      calculationMode: c.calculationMode,
      quantity: c.quantity ?? 1,
      hours,
      hoursPerCoverageHour: c.hoursPerCoverageHour,
      directCost: c.directCost,
      marginPercent: c.marginPercent,
      includeEquipmentWear: c.includeEquipmentWear,
    };
  });
}

/**
 * Mapeo preliminar draft conversacional + plantilla → job de pricing.
 * No calcula costos ni precios. No importa ComprameLaFoto.
 */
export function preparePricingJob(
  draft: QuoteRequestDraft,
  template: PricingServiceTemplate,
): PreparedPricingJobResult {
  const warnings: string[] = [];

  if (!draft.serviceType || draft.serviceType === "UNKNOWN") {
    return {
      status: "UNSUPPORTED",
      reason: "SERVICE_TYPE_UNKNOWN_OR_MISSING",
      warnings,
    };
  }

  if (template.serviceType !== draft.serviceType) {
    return {
      status: "UNSUPPORTED",
      reason: "TEMPLATE_SERVICE_TYPE_MISMATCH",
      warnings,
    };
  }

  if (!template.configured || template.templateVersion === "unconfigured") {
    return {
      status: "INCOMPLETE",
      missingFields: ["TEMPLATE_NOT_CONFIGURED"],
      warnings,
    };
  }

  if (draft.durationHours === undefined || draft.durationHours === null) {
    return {
      status: "INCOMPLETE",
      missingFields: ["DURATION_HOURS"],
      warnings,
    };
  }

  const duration = draft.durationHours;
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      status: "INCOMPLETE",
      missingFields: ["DURATION_HOURS_INVALID"],
      warnings,
    };
  }

  const { minimumHours, maximumHours } = template.coverage;
  if (duration < minimumHours) {
    return {
      status: "INCOMPLETE",
      missingFields: ["DURATION_BELOW_MINIMUM"],
      warnings: [
        ...warnings,
        "La duración está por debajo del mínimo de la plantilla; no se corrige automáticamente.",
      ],
    };
  }

  if (duration > maximumHours) {
    return {
      status: "INCOMPLETE",
      missingFields: ["DURATION_ABOVE_MAXIMUM"],
      warnings: [
        ...warnings,
        "La duración supera el máximo de la plantilla; requiere revisión humana.",
      ],
    };
  }

  if (template.editing.mode === "MANUAL") {
    return {
      status: "INCOMPLETE",
      missingFields: ["EDITING_MANUAL_PENDING"],
      warnings: [
        ...warnings,
        "La edición está en modo MANUAL; no se inventan horas de edición.",
      ],
    };
  }

  let editingHours: number | undefined;
  let editingResolution: PricingJobInput["editingResolution"] = "NONE";

  if (template.editing.mode === "FIXED_HOURS") {
    if (
      template.editing.fixedHours === undefined ||
      !Number.isFinite(template.editing.fixedHours) ||
      template.editing.fixedHours < 0
    ) {
      return {
        status: "INCOMPLETE",
        missingFields: ["EDITING_FIXED_HOURS_MISSING"],
        warnings,
      };
    }
    editingHours = template.editing.fixedHours;
    editingResolution = "FIXED_HOURS";
  } else if (template.editing.mode === "HOURS_PER_COVERAGE_HOUR") {
    if (
      template.editing.hoursPerCoverageHour === undefined ||
      !Number.isFinite(template.editing.hoursPerCoverageHour) ||
      template.editing.hoursPerCoverageHour <= 0
    ) {
      return {
        status: "INCOMPLETE",
        missingFields: ["EDITING_MULTIPLIER_MISSING"],
        warnings,
      };
    }
    editingHours = duration * template.editing.hoursPerCoverageHour;
    editingResolution = "HOURS_PER_COVERAGE_HOUR";
  } else {
    editingResolution = "NONE";
  }

  const unconfiguredConcepts = template.concepts.filter((c) => !c.configured);
  if (unconfiguredConcepts.length > 0) {
    warnings.push(
      `${unconfiguredConcepts.length} concepto(s) de plantilla aún no configurados; no se usan montos.`,
    );
  }

  if (template.concepts.some((c) => c.calculationMode === "MANUAL" && c.configured)) {
    return {
      status: "INCOMPLETE",
      missingFields: ["CONCEPT_MANUAL_PENDING"],
      warnings: [
        ...warnings,
        "Hay conceptos MANUAL configurados que bloquean automatización.",
      ],
    };
  }

  return {
    status: "READY",
    templateVersion: template.templateVersion,
    warnings,
    job: {
      serviceType: draft.serviceType,
      eventDate: draft.eventDate,
      city: draft.city,
      durationHours: duration,
      coverageHours: duration,
      editingHours,
      editingResolution,
      generalClientHours: { ...template.generalClientHours },
      plannedConcepts: resolvePlannedConcepts(template, duration),
    },
  };
}
