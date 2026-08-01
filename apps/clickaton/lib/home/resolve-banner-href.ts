import { marathonPath, marathonRegistrationPath } from "@/config/navigation";

type EditionLink = {
  slug: string;
  registrationEnabled?: boolean | null;
  isPublished?: boolean | null;
};

/** Resuelve el href final de un banner admin. */
export function resolveHomeBannerHref(input: {
  linkType: "EDITION" | "INTERNAL" | "EXTERNAL";
  href?: string | null;
  edition?: EditionLink | null;
  canRegister?: boolean;
}): string {
  if (input.linkType === "EDITION" && input.edition?.slug) {
    return input.canRegister
      ? marathonRegistrationPath(input.edition.slug)
      : marathonPath(input.edition.slug);
  }
  return (input.href ?? "/").trim() || "/";
}
