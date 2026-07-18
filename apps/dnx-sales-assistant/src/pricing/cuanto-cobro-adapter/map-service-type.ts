import type { PhotographyServiceType } from "../../quote-request/models.js";
import type { CompatibleJobTypeValue } from "./compatible-models.js";

export type ServiceTypeMapResult =
  | {
      status: "OK";
      jobType: CompatibleJobTypeValue;
      /** true si varios servicios DNX colapsan en la misma categoría del motor. */
      genericCollapse: boolean;
    }
  | { status: "UNSUPPORTED"; reason: string };

/**
 * Mapeo PhotographyServiceType → jobType del motor (valores de consulta CLF).
 * jobType es string libre en el orquestador; usamos los valores estables del catálogo.
 */
const SERVICE_TO_JOB_TYPE: Record<
  Exclude<PhotographyServiceType, "UNKNOWN">,
  { jobType: CompatibleJobTypeValue; genericCollapse: boolean }
> = {
  WEDDING: { jobType: "boda", genericCollapse: false },
  FIFTEENTH_BIRTHDAY: { jobType: "evento", genericCollapse: true },
  BIRTHDAY: { jobType: "evento", genericCollapse: true },
  CORPORATE_EVENT: { jobType: "evento", genericCollapse: true },
  SOCIAL_EVENT: { jobType: "evento", genericCollapse: true },
  SPORTS_EVENT: { jobType: "evento", genericCollapse: true },
  PORTRAIT_SESSION: { jobType: "retrato", genericCollapse: false },
  FAMILY_SESSION: { jobType: "retrato", genericCollapse: true },
  PRODUCT_PHOTOGRAPHY: { jobType: "producto", genericCollapse: false },
  SCHOOL_PHOTOGRAPHY: { jobType: "escolar", genericCollapse: false },
  OTHER: { jobType: "otro", genericCollapse: false },
};

export function mapServiceTypeToJobType(
  serviceType: PhotographyServiceType | undefined,
): ServiceTypeMapResult {
  if (!serviceType || serviceType === "UNKNOWN") {
    return { status: "UNSUPPORTED", reason: "SERVICE_TYPE_UNKNOWN_OR_MISSING" };
  }
  const mapped = SERVICE_TO_JOB_TYPE[serviceType];
  return {
    status: "OK",
    jobType: mapped.jobType,
    genericCollapse: mapped.genericCollapse,
  };
}

export function listServiceTypeJobTypeMatrix(): Array<{
  serviceType: Exclude<PhotographyServiceType, "UNKNOWN">;
  jobType: CompatibleJobTypeValue;
  genericCollapse: boolean;
}> {
  return (
    Object.entries(SERVICE_TO_JOB_TYPE) as Array<
      [
        Exclude<PhotographyServiceType, "UNKNOWN">,
        { jobType: CompatibleJobTypeValue; genericCollapse: boolean },
      ]
    >
  ).map(([serviceType, value]) => ({
    serviceType,
    jobType: value.jobType,
    genericCollapse: value.genericCollapse,
  }));
}
