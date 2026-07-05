import type { PhotographerRadiusSearchCenter } from "@/lib/admin/photographer-radius-search";

export function photographerWhatsappHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const clean = raw.replace(/\D/g, "");
  if (clean.length < 8) return null;
  const withPrefix = clean.startsWith("54") ? clean : `54${clean.replace(/^0+/, "")}`;
  return `https://wa.me/${withPrefix}`;
}

export function photographerInstagramHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  return `https://instagram.com/${trimmed}`;
}

export function photographerInstagramLabel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "") || trimmed;
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function formatPhotographerWorkLocationParts(p: {
  address?: string | null;
  city?: string | null;
  province?: string | null;
}): { addressLine: string | null; cityLine: string | null } {
  const addressLine = p.address?.trim() || null;
  const cityLine = [p.city?.trim(), p.province?.trim()].filter(Boolean).join(", ") || null;
  return { addressLine, cityLine };
}

export function formatPhotographerWorkLocation(p: {
  address?: string | null;
  city?: string | null;
  province?: string | null;
}): string {
  const { addressLine, cityLine } = formatPhotographerWorkLocationParts(p);
  if (addressLine && cityLine) return `${addressLine} — ${cityLine}`;
  return addressLine || cityLine || "—";
}

export type PhotographerRadiusResultRow = {
  id: number;
  name: string | null;
  email: string;
  companyName: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  whatsapp: string | null;
  instagram: string | null;
  distanceKm: number;
};

export function formatPhotographerRadiusResultsForClipboard(
  search: PhotographerRadiusSearchCenter & { radiusKm: number },
  results: PhotographerRadiusResultRow[]
): string {
  const lines: string[] = [
    "Fotógrafos cerca — ComprameLaFoto (admin)",
    `Ubicación: ${search.label}`,
    `Radio: ${search.radiusKm} km`,
    `Encontrados: ${results.length}`,
    "",
  ];

  if (results.length === 0) {
    lines.push("No hay fotógrafos con ubicación en este radio.");
    return lines.join("\n");
  }

  for (const [index, p] of results.entries()) {
    const name = p.name || p.companyName || "Sin nombre";
    const location = formatPhotographerWorkLocation(p);
    const waUrl = photographerWhatsappHref(p.whatsapp);
    const igUrl = photographerInstagramHref(p.instagram);
    const igLabel = photographerInstagramLabel(p.instagram);

    lines.push(`${index + 1}. ${name}`);
    lines.push(`   Email: ${p.email}`);
    if (location) lines.push(`   Ubicación: ${location}`);
    if (p.whatsapp) {
      lines.push(waUrl ? `   WhatsApp: ${p.whatsapp} — ${waUrl}` : `   WhatsApp: ${p.whatsapp}`);
    }
    if (p.instagram) {
      lines.push(
        igUrl
          ? `   Instagram: ${igLabel ?? p.instagram} — ${igUrl}`
          : `   Instagram: ${p.instagram}`
      );
    }
    lines.push(`   Distancia: ${p.distanceKm} km`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
