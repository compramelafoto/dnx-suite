import type { DeviceKind, EligibilityResult } from "./types";
import { SANTA_FE_CATEGORY_SLUGS } from "./types";

const PHONE_HINTS = ["iphone", "pixel", "samsung", "xiaomi", "huawei", "motorola", "redmi", "galaxy", "android"];
const CAMERA_HINTS = ["canon", "nikon", "sony", "fujifilm", "olympus", "panasonic", "leica", "pentax", "ricoh"];
const DRONE_HINTS = ["dji", "mavic", "air 2", "mini 3", "autel", "skydio", "parrot anafi"];

export function inferDeviceKindFromExif(input: {
  make: string | null;
  model: string | null;
  software: string | null;
}): DeviceKind {
  const blob = `${input.make ?? ""} ${input.model ?? ""} ${input.software ?? ""}`.toLowerCase();
  if (!blob.trim()) return "UNKNOWN";
  if (DRONE_HINTS.some((h) => blob.includes(h))) return "DRONE";
  if (PHONE_HINTS.some((h) => blob.includes(h))) return "SMARTPHONE";
  if (CAMERA_HINTS.some((h) => blob.includes(h))) {
    if (blob.includes("mirrorless") || blob.includes(" α") || blob.includes("eos r") || blob.includes("z 6") || blob.includes("z 7")) {
      return "MIRRORLESS";
    }
    return "DSLR";
  }
  return "UNKNOWN";
}

function isCameraFamily(kind: DeviceKind): boolean {
  return kind === "DSLR" || kind === "MIRRORLESS" || kind === "COMPACT_CAMERA" || kind === "BRIDGE_CAMERA" || kind === "OTHER_CAMERA";
}

function isPhoneFamily(kind: DeviceKind): boolean {
  return kind === "SMARTPHONE" || kind === "TABLET";
}

function resolveDeclaredKind(declared: DeviceKind | null | undefined, inferred: DeviceKind): DeviceKind {
  if (declared && declared !== "UNKNOWN") return declared;
  return inferred;
}

/**
 * Política central de dispositivo por categoría (Santa Fe en Foco).
 * No auto-recategoriza. Celular en Profesional → revisión/no elegible.
 */
export function evaluateSantaFeCategoryDeviceEligibility(input: {
  categorySlug: string;
  declaredDeviceKind: DeviceKind | null | undefined;
  exifMake: string | null;
  exifModel: string | null;
  software: string | null;
}): EligibilityResult {
  const slug = input.categorySlug.trim().toLowerCase();
  const inferred = inferDeviceKindFromExif({
    make: input.exifMake,
    model: input.exifModel,
    software: input.software,
  });
  const kind = resolveDeclaredKind(input.declaredDeviceKind, inferred);
  const evidence = {
    declared: input.declaredDeviceKind ?? null,
    inferred,
    resolved: kind,
    categorySlug: slug,
  };

  if (kind === "AI_GENERATED") {
    return {
      decision: "NOT_ELIGIBLE",
      reasonCode: "MANUAL_REVIEW_REQUIRED",
      publicMessage: "Las imágenes íntegramente generadas con IA no están permitidas.",
      internalMessage: "AI_GENERATED device",
      evidence,
    };
  }

  const isProfessional =
    slug === SANTA_FE_CATEGORY_SLUGS.professional || slug === "profesional" || slug.includes("profesional");
  const isAmateur =
    slug === SANTA_FE_CATEGORY_SLUGS.amateur || slug === "amateur" || slug.includes("amateur");
  const isReporter =
    slug === SANTA_FE_CATEGORY_SLUGS.reporter || slug.includes("reportero");
  const isAerial =
    slug === SANTA_FE_CATEGORY_SLUGS.aerial || slug.includes("aerea") || slug.includes("aérea") || slug.includes("dron");

  if (isAerial) {
    if (kind === "DRONE") {
      return {
        decision: "ELIGIBLE",
        reasonCode: "AMATEUR_DEVICE_ALLOWED",
        publicMessage: "Dispositivo dron admitido para Fotografía Aérea.",
        internalMessage: "aerial drone ok",
        evidence,
      };
    }
    if (kind === "UNKNOWN") {
      return {
        decision: "MANUAL_REVIEW_REQUIRED",
        reasonCode: "DEVICE_UNKNOWN",
        publicMessage: "No pudimos identificar el dron. La organización revisará la obra.",
        internalMessage: "aerial unknown device",
        evidence,
      };
    }
    return {
      decision: "NOT_ELIGIBLE",
      reasonCode: "AERIAL_DRONE_REQUIRED",
      publicMessage: "En Fotografía Aérea la obra debe haberse realizado con dron.",
      internalMessage: "aerial non-drone",
      evidence,
    };
  }

  if (isProfessional || isReporter) {
    if (isPhoneFamily(kind)) {
      return {
        decision: "MANUAL_REVIEW_REQUIRED",
        reasonCode: "PROFESSIONAL_PHONE_NOT_ALLOWED",
        publicMessage:
          "En esta categoría no se admiten fotografías tomadas con teléfono celular. La obra quedará en revisión.",
        internalMessage: "professional/reporter phone",
        evidence,
      };
    }
    if (kind === "DRONE") {
      return {
        decision: "NOT_ELIGIBLE",
        reasonCode: "PROFESSIONAL_DRONE_NOT_ALLOWED",
        publicMessage: "Las fotografías con dron corresponden a la categoría Fotografía Aérea.",
        internalMessage: "professional/reporter drone",
        evidence,
      };
    }
    if (isCameraFamily(kind)) {
      return {
        decision: "ELIGIBLE",
        reasonCode: "AMATEUR_DEVICE_ALLOWED",
        publicMessage: "Cámara fotográfica admitida.",
        internalMessage: "camera family ok",
        evidence,
      };
    }
    return {
      decision: "MANUAL_REVIEW_REQUIRED",
      reasonCode: kind === "UNKNOWN" ? "DEVICE_UNKNOWN" : "EXIF_MISSING",
      publicMessage: "No pudimos verificar el dispositivo. Declará marca y modelo; la organización revisará.",
      internalMessage: "professional/reporter unknown",
      evidence,
    };
  }

  if (isAmateur) {
    if (kind === "DRONE") {
      return {
        decision: "NOT_ELIGIBLE",
        reasonCode: "AMATEUR_DRONE_NOT_ALLOWED",
        publicMessage: "Las fotografías con dron corresponden a la categoría Fotografía Aérea.",
        internalMessage: "amateur drone",
        evidence,
      };
    }
    if (isPhoneFamily(kind) || isCameraFamily(kind)) {
      return {
        decision: "ELIGIBLE",
        reasonCode: "AMATEUR_DEVICE_ALLOWED",
        publicMessage: "Dispositivo admitido para Fotógrafo Amateur.",
        internalMessage: "amateur device ok",
        evidence,
      };
    }
    return {
      decision: "MANUAL_REVIEW_REQUIRED",
      reasonCode: "DEVICE_UNKNOWN",
      publicMessage: "Dispositivo no identificado. La organización podrá revisar la obra.",
      internalMessage: "amateur unknown",
      evidence,
    };
  }

  // Categorías genéricas / abiertas
  if (kind === "UNKNOWN") {
    return {
      decision: "MANUAL_REVIEW_REQUIRED",
      reasonCode: "DEVICE_UNKNOWN",
      publicMessage: "Dispositivo no verificado.",
      internalMessage: "open unknown",
      evidence,
    };
  }
  return {
    decision: "ELIGIBLE",
    reasonCode: "AMATEUR_DEVICE_ALLOWED",
    publicMessage: "Dispositivo admitido.",
    internalMessage: "open ok",
    evidence,
  };
}
