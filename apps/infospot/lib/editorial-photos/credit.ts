/**
 * Crédito editorial obligatorio (fotógrafo + empresa o plataforma).
 *
 * Formato automático con empresa: `Foto: {autor} - /{empresa}`
 * Sin empresa: `Foto: {autor} / ComprameLaFoto`
 */

export const PHOTO_CREDIT_COMPANY_SEPARATOR = " - /";

export const photographerCreditUserSelect = {
  id: true,
  name: true,
  email: true,
  companyName: true,
  instagram: true,
  website: true,
} as const;

export type PhotographerCreditUser = {
  id: number;
  name: string | null;
  email: string;
  companyName?: string | null;
  instagram?: string | null;
  website?: string | null;
};

export function photographerDisplayName(
  user: { name: string | null; email: string } | null | undefined,
): string | null {
  if (!user) return null;
  return user.name?.trim() || user.email?.trim() || null;
}

function sanitizeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Instagram tiene prioridad sobre el sitio web. */
export function resolvePhotographerCompanyHref(input: {
  instagram?: string | null;
  website?: string | null;
}): string | null {
  const ig = input.instagram?.trim();
  if (ig) {
    if (/^https?:\/\//i.test(ig)) return sanitizeHttpUrl(ig);
    const stripped = ig
      .replace(/^@/, "")
      .replace(/^(www\.)?instagram\.com\//i, "")
      .replace(/\/+$/, "")
      .split(/[/?#]/)[0];
    if (stripped && /^[A-Za-z0-9._]+$/.test(stripped)) {
      return `https://instagram.com/${stripped}`;
    }
  }

  const web = input.website?.trim();
  if (web) {
    if (/^https?:\/\//i.test(web)) return sanitizeHttpUrl(web);
    return sanitizeHttpUrl(`https://${web}`);
  }

  return null;
}

export function buildEditorialPhotoCredit(input: {
  photographerName: string | null | undefined;
  companyName?: string | null | undefined;
  platform?: string;
}): string {
  const name = input.photographerName?.trim() || "Fotógrafo";
  const company = input.companyName?.trim();
  if (company) {
    return `Foto: ${name}${PHOTO_CREDIT_COMPANY_SEPARATOR}${company}`;
  }
  const platform = input.platform?.trim() || "ComprameLaFoto";
  return `Foto: ${name} / ${platform}`;
}

export function parseEditorialPhotoCredit(credit: string): {
  beforeCompany: string;
  companyName: string | null;
} {
  const text = credit.trim();
  const idx = text.indexOf(PHOTO_CREDIT_COMPANY_SEPARATOR);
  if (idx === -1) {
    return { beforeCompany: text, companyName: null };
  }
  const companyName = text.slice(idx + PHOTO_CREDIT_COMPANY_SEPARATOR.length).trim() || null;
  return {
    beforeCompany: text.slice(0, idx + PHOTO_CREDIT_COMPANY_SEPARATOR.length),
    companyName,
  };
}

export function isLegacyAutoPhotoCredit(
  credit: string,
  photographerName: string,
): boolean {
  const name = photographerName.trim();
  const trimmed = credit.trim();
  return (
    trimmed === `Foto: ${name} / ComprameLaFoto` ||
    trimmed === `Foto: ${name} / Info Spot – ComprameLaFoto` ||
    trimmed === `Foto: ${name}`
  );
}

export function buildEditorialPhotoCopyright(
  photographerName: string | null | undefined,
): string {
  const name = photographerName?.trim() || "el autor";
  return `© ${name}. Uso editorial Info Spot.`;
}

export function resolvePhotographerCredit(user: PhotographerCreditUser | null | undefined): {
  photographerName: string | null;
  companyName: string | null;
  companyHref: string | null;
  credit: string;
  copyrightText: string;
} {
  const photographerName = photographerDisplayName(user);
  const companyName = user?.companyName?.trim() || null;
  const companyHref = user
    ? resolvePhotographerCompanyHref({
        instagram: user.instagram,
        website: user.website,
      })
    : null;
  return {
    photographerName,
    companyName,
    companyHref,
    credit: buildEditorialPhotoCredit({ photographerName, companyName }),
    copyrightText: buildEditorialPhotoCopyright(photographerName),
  };
}
