import type { PricingConfigurationIssue, PricingJobInput } from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { hoursToCompatibleString } from "./amount-strings.js";
import {
  SYNTHETIC_CLIENT_NAME,
  type CuantoCobroCompatibleQuote,
} from "./compatible-models.js";
import { mapPreparedConceptsToCompatibleItems } from "./map-concepts.js";
import { mapServiceTypeToJobType } from "./map-service-type.js";

export type MapJobResult =
  | { status: "OK"; quote: CuantoCobroCompatibleQuote; warnings: PricingConfigurationIssue[] }
  | { status: "UNSUPPORTED"; reason: string; issues: PricingConfigurationIssue[] }
  | { status: "INVALID"; issues: PricingConfigurationIssue[] };

/**
 * PricingJobInput preparado → quote compatible.
 * Cliente sintético; chosenPrice vacío; sin pagos inventados.
 */
export function mapPreparedPricingJobToCompatibleQuote(
  job: PricingJobInput,
): MapJobResult {
  const warnings: PricingConfigurationIssue[] = [];
  const serviceMap = mapServiceTypeToJobType(job.serviceType);

  if (serviceMap.status === "UNSUPPORTED") {
    return {
      status: "UNSUPPORTED",
      reason: serviceMap.reason,
      issues: [
        issue(
          PricingIssueCode.ADAPTER_UNSUPPORTED_SERVICE,
          "serviceType",
          "ERROR",
          "Servicio no soportado por el adaptador.",
        ),
      ],
    };
  }

  if (serviceMap.genericCollapse) {
    warnings.push(
      issue(
        PricingIssueCode.ADAPTER_GENERIC_JOB_TYPE,
        "client.jobType",
        "WARNING",
        `Servicio ${job.serviceType} se mapea a jobType genérico "${serviceMap.jobType}" (pérdida de precisión).`,
      ),
    );
  }

  warnings.push(
    issue(
      PricingIssueCode.ADAPTER_SYNTHETIC_CLIENT_NAME,
      "client.name",
      "WARNING",
      "Se usa nombre de cliente sintético técnico; no mostrar al cliente final.",
    ),
  );

  warnings.push(
    issue(
      PricingIssueCode.ADAPTER_METADATA_NOT_PRICED,
      "metadata",
      "WARNING",
      "Fecha y ciudad se conservan como metadata; no generan viáticos ni recargos.",
    ),
  );

  if (job.editingResolution === "PENDING_MANUAL") {
    return {
      status: "INVALID",
      issues: [
        issue(
          PricingIssueCode.ADAPTER_JOB_NOT_READY,
          "editingResolution",
          "ERROR",
          "Edición MANUAL pendiente; no se mapea el quote.",
        ),
      ],
    };
  }

  const conceptsResult = mapPreparedConceptsToCompatibleItems(job);
  if (conceptsResult.status === "INVALID") {
    return { status: "INVALID", issues: conceptsResult.issues };
  }
  warnings.push(...conceptsResult.warnings);

  const g = job.generalClientHours;
  const quote: CuantoCobroCompatibleQuote = {
    client: {
      name: SYNTHETIC_CLIENT_NAME,
      company: "",
      email: "",
      phone: "",
      jobDate: job.eventDate ?? "",
      jobLocation: job.city ?? "",
      jobLatitude: "",
      jobLongitude: "",
      jobType: serviceMap.jobType,
      hours: {
        salesHours: hoursToCompatibleString(g.sales),
        meetingsHours: hoursToCompatibleString(g.meetings),
        generalPrepHours: hoursToCompatibleString(g.preparation),
        coordinationHours: hoursToCompatibleString(g.coordination),
        billingHours: hoursToCompatibleString(g.billing),
        followUpHours: hoursToCompatibleString(g.followUp),
        administrativeDeliveryHours: hoursToCompatibleString(g.deliveryAdministration),
      },
    },
    concepts: conceptsResult.concepts,
    internalNotes: [
      "adapter:dnx-sales-assistant",
      `serviceType=${job.serviceType}`,
      job.eventDate ? `eventDate=${job.eventDate}` : null,
      job.city ? `city=${job.city}` : null,
      `durationHours=${job.durationHours}`,
      `editingResolution=${job.editingResolution}`,
    ]
      .filter(Boolean)
      .join("; "),
    commercialDisplayMode: "detailed",
    commercialNote: "",
    chosenPrice: "",
    paymentOptions: {
      cashEnabled: true,
      cashDiscountPercent: "",
      cashCommercialNote: "",
      installmentPlans: [],
    },
    status: "draft",
  };

  return { status: "OK", quote, warnings };
}
