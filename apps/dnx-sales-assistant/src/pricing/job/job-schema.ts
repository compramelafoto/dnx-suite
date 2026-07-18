import { z } from "zod";
import { PRICABLE_SERVICE_TYPES } from "../models.js";

const pricableServiceTypeSchema = z.enum(
  PRICABLE_SERVICE_TYPES as unknown as [string, ...string[]],
);

/**
 * Job de dry-run offline.
 * `configured: false` en examples — no usar accidentalmente.
 */
export const pricingDryRunJobSchema = z
  .object({
    configured: z.boolean(),
    serviceType: z.string().min(1),
    eventDate: z.string().optional(),
    city: z.string().optional(),
    durationHours: z.number().optional(),
  })
  .strict();

export type PricingDryRunJobRaw = z.infer<typeof pricingDryRunJobSchema>;

export type PricingDryRunJob = {
  configured: true;
  serviceType: (typeof PRICABLE_SERVICE_TYPES)[number];
  eventDate?: string;
  city?: string;
  durationHours: number;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePricingDryRunJob(
  raw: PricingDryRunJobRaw,
):
  | { status: "READY"; job: PricingDryRunJob }
  | { status: "NOT_CONFIGURED"; reasons: string[] }
  | { status: "INVALID"; reasons: string[] } {
  if (!raw.configured) {
    return {
      status: "NOT_CONFIGURED",
      reasons: ["configured=false — copiá a .local.json y marcá configured=true"],
    };
  }

  const reasons: string[] = [];

  if (raw.serviceType === "UNKNOWN") {
    return {
      status: "INVALID",
      reasons: ["serviceType UNKNOWN no es cotizable"],
    };
  }

  const serviceParsed = pricableServiceTypeSchema.safeParse(raw.serviceType);
  if (!serviceParsed.success) {
    reasons.push(`serviceType no reconocido: ${raw.serviceType}`);
  }

  if (raw.durationHours === undefined || raw.durationHours === null) {
    reasons.push("durationHours es obligatorio");
  } else if (!Number.isFinite(raw.durationHours) || raw.durationHours <= 0) {
    reasons.push("durationHours debe ser finito y > 0");
  }

  if (raw.city !== undefined && raw.city.trim() === "") {
    reasons.push("city no puede estar vacía");
  }

  if (raw.eventDate !== undefined && raw.eventDate !== "") {
    if (!ISO_DATE_RE.test(raw.eventDate)) {
      reasons.push("eventDate debe ser ISO YYYY-MM-DD cuando está presente");
    } else {
      const d = new Date(`${raw.eventDate}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) {
        reasons.push("eventDate no es una fecha válida");
      }
    }
  }

  if (reasons.length > 0 || !serviceParsed.success) {
    return { status: "INVALID", reasons };
  }

  return {
    status: "READY",
    job: {
      configured: true,
      serviceType: serviceParsed.data as PricingDryRunJob["serviceType"],
      eventDate: raw.eventDate,
      city: raw.city?.trim(),
      durationHours: raw.durationHours as number,
    },
  };
}
