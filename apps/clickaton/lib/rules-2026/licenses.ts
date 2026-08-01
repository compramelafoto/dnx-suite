import { ARGENTINA_2026_RULES } from "@/config/editions/argentina-2026";

export type LicenseKind = "PROMOTIONAL_LICENSE" | "COMMERCIAL_LICENSE";

export function promotionalLicenseForSubmission(acceptedAt: Date): {
  kind: "PROMOTIONAL_LICENSE";
  exclusivity: "LICENSE_NON_EXCLUSIVE";
  copyrightTransfer: false;
  duration: "INDEFINITE";
  acceptedAt: Date;
} {
  return {
    kind: "PROMOTIONAL_LICENSE",
    exclusivity: "LICENSE_NON_EXCLUSIVE",
    copyrightTransfer: false,
    duration: "INDEFINITE",
    acceptedAt,
  };
}

export function commercialLicenseForFinalist(input: {
  selectedAt: Date;
  now?: Date;
}): {
  kind: "COMMERCIAL_LICENSE";
  exclusivity: "LICENSE_NON_EXCLUSIVE";
  copyrightTransfer: false;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  allowsNewSales: boolean;
  allowsFulfillmentOfPaidOrders: boolean;
} {
  const startsAt = new Date(ARGENTINA_2026_RULES.commercialLicense.startsAtIso);
  const endsAt = new Date(ARGENTINA_2026_RULES.commercialLicense.endsAtIso);
  const now = input.now ?? new Date();
  const isActive = now.getTime() <= endsAt.getTime();
  return {
    kind: "COMMERCIAL_LICENSE",
    exclusivity: "LICENSE_NON_EXCLUSIVE",
    copyrightTransfer: false,
    startsAt,
    endsAt,
    isActive,
    allowsNewSales: isActive && now.getTime() >= startsAt.getTime(),
    allowsFulfillmentOfPaidOrders: true,
  };
}

export function shouldUnpublishForNewSales(licenseEndsAt: Date, now: Date): boolean {
  return now.getTime() > licenseEndsAt.getTime();
}
