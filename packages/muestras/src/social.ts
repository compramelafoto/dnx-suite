import { dateRangeText, formatArDayLong, isLastDays } from "./dates";
import { openingHasTime, openingWhenText } from "./opening";
import type { Box } from "./print";

/** Piezas para redes (etapa 5, D24–D29). Medidas en píxeles; la base de diseño es 1080 de ancho. */
export const SOCIAL_FORMATS = {
  POST: { width: 1080, height: 1350 },
  STORY: { width: 1080, height: 1920 },
  SQUARE: { width: 1080, height: 1080 },
  A6: { width: 1240, height: 1748 },
  A5: { width: 1748, height: 2480 },
} as const;
export type SocialFormat = keyof typeof SOCIAL_FORMATS;
export const SOCIAL_FORMAT_LABELS: Record<SocialFormat, string> = {
  POST: "Posteo (1080 × 1350)", STORY: "Historia (1080 × 1920)", SQUARE: "Cuadrado (1080 × 1080)",
  A6: "Para imprimir, A6 (10,5 × 14,8 cm)", A5: "Para imprimir, A5 (14,8 × 21 cm)",
};
export const SOCIAL_FORMAT_PARAMS: Record<string, SocialFormat> = { post: "POST", historia: "STORY", cuadrado: "SQUARE", a6: "A6", a5: "A5" };
const PARAM_DE_FORMATO: Record<SocialFormat, string> = { POST: "posteo", STORY: "historia", SQUARE: "cuadrado", A6: "a6", A5: "a5" };
export const PRINT_FORMATS = ["A6", "A5"] as const;
export const PRINT_SIZES_MM = { A6: { width: 105, height: 148 }, A5: { width: 148, height: 210 } } as const;
export const isPrintFormat = (f: SocialFormat): f is "A6" | "A5" => f === "A6" || f === "A5";

export const SOCIAL_VARIANTS = ["OPENING", "LAST_DAYS", "WORK", "INVITATION"] as const;
export type SocialVariant = (typeof SOCIAL_VARIANTS)[number];
export const SOCIAL_VARIANT_LABELS: Record<SocialVariant, string> = {
  OPENING: "Inaugura", LAST_DAYS: "Últimos días", WORK: "Obra destacada", INVITATION: "Invitación a la inauguración",
};
export const SOCIAL_VARIANT_PARAMS: Record<string, SocialVariant> = { inaugura: "OPENING", "ultimos-dias": "LAST_DAYS", obra: "WORK", invitacion: "INVITATION" };
const PARAM_DE_VARIANTE: Record<SocialVariant, string> = { OPENING: "inaugura", LAST_DAYS: "ultimos-dias", WORK: "obra", INVITATION: "invitacion" };

export type SocialActivity = {
  reviewStatus: string; type: string; isCancelled: boolean; isVirtualOnly: boolean;
  startsAt: Date; endsAt: Date; openingAt: Date | null; openingEndsAt: Date | null; worksCount: number;
  title: string; venueName: string | null; city: string | null; province: string | null;
};

/**
 * Las variantes que se pueden armar hoy. `onlineWorkCount`: cuántas obras expuestas se ven hoy
 * online según la sorpresa de la muestra (etapa 6, spec D39): "Obra destacada" es publicación
 * online, así que sin obras visibles no se ofrece. Sin el dato, cuenta todas las obras.
 */
export function availableSocialVariants(a: SocialActivity, now: Date, onlineWorkCount: number = a.worksCount): SocialVariant[] {
  if (a.reviewStatus !== "APPROVED" || a.type !== "MUESTRA" || a.isCancelled) return [];
  const t = now.getTime();
  const out: SocialVariant[] = [];
  if (a.openingAt) {
    // Sin hora, "Inaugura" vale todo ese día.
    const inicio = a.openingAt.getTime();
    if (t < (openingHasTime(a.openingAt) ? inicio : inicio + 24 * 3600_000)) out.push("OPENING");
  }
  if (t <= a.endsAt.getTime()) out.push("LAST_DAYS");
  if (onlineWorkCount > 0) out.push("WORK");
  if (!a.isVirtualOnly && openingHasTime(a.openingAt) && t < a.openingAt.getTime()) out.push("INVITATION");
  return out;
}

export function recommendedVariant(a: SocialActivity, now: Date, onlineWorkCount: number = a.worksCount): SocialVariant | null {
  const v = availableSocialVariants(a, now, onlineWorkCount);
  if (v.includes("OPENING")) return "OPENING";
  if (v.includes("LAST_DAYS") && isLastDays(a, now)) return "LAST_DAYS";
  return v.includes("WORK") ? "WORK" : v[0] ?? null;
}

export function isFormatAllowed(v: SocialVariant, f: SocialFormat): boolean {
  return isPrintFormat(f) ? v === "INVITATION" : true;
}

export const STORY_SAFE_PX = 250;
const FRACCION_FOTO: Record<SocialFormat, number> = { POST: 0.56, STORY: 0.52, SQUARE: 0.5, A6: 0.55, A5: 0.55 };

export type SocialLayout = {
  width: number; height: number; scale: number; padding: number;
  photo: Box; band: Box; textLeft: number; textTop: number; textBottom: number; textWidth: number;
  qr: Box | null; kickerSize: number; titleSizes: number[]; detailSize: number; footerSize: number; gap: number;
};

export function socialLayout(format: SocialFormat, variant: SocialVariant): SocialLayout {
  const { width, height } = SOCIAL_FORMATS[format];
  const s = width / 1080;
  const r = (n: number) => Math.round(n * s);
  const padding = r(72);
  const fotoAlto = Math.round(height * FRACCION_FOTO[format]);
  const photo = { x: 0, y: 0, width, height: fotoAlto };
  const band = { x: 0, y: fotoAlto, width, height: height - fotoAlto };
  const seguro = format === "STORY" ? STORY_SAFE_PX : 0;
  const textTop = Math.max(band.y + padding, seguro);
  const textBottom = Math.min(height - padding, height - seguro);
  const qrLado = variant === "INVITATION" ? r(230) : 0;
  const qr = qrLado ? { x: width - padding - qrLado, y: textBottom - qrLado, width: qrLado, height: qrLado } : null;
  return {
    width, height, scale: s, padding, photo, band, textLeft: padding, textTop, textBottom,
    textWidth: width - 2 * padding - (qr ? qrLado + r(40) : 0), qr,
    kickerSize: r(34), titleSizes: [84, 72, 62, 54, 46].map(r), detailSize: r(32), footerSize: r(26), gap: r(20),
  };
}

export type SocialTexts = { kicker: string; title: string; details: string[]; footer: string };

/** NFC, sin controles ni símbolos fuera de Latin-1 / Latin Extended-A / puntuación general (emojis). */
export function cleanSocialText(s: string, max: number): string {
  return Array.from(s.normalize("NFC"))
    .filter((c) => { const n = c.codePointAt(0)!; return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0x17f) || (n >= 0x2010 && n <= 0x203a) || n === 0x20ac; })
    .join("").replace(/\s+/g, " ").trim().slice(0, max);
}

const lugar = (a: SocialActivity) => [a.venueName, a.city].filter(Boolean).join(", ");

export function socialTexts(v: SocialVariant, a: SocialActivity, work: { title: string; authorName: string; year: number | null } | null): SocialTexts {
  const footer = "muestrasfotograficas.com";
  const titulo = cleanSocialText(a.title, 120);
  switch (v) {
    case "OPENING":
      return { kicker: "Inaugura", title: titulo, details: [openingWhenText(a.openingAt!, a.openingEndsAt), lugar(a)].filter(Boolean), footer };
    case "LAST_DAYS":
      return { kicker: "Últimos días", title: titulo, details: [`Hasta el ${formatArDayLong(a.endsAt)}`, lugar(a)].filter(Boolean), footer };
    case "WORK":
      return {
        kicker: "Obra destacada", title: cleanSocialText(work?.title ?? "", 120),
        details: [[work?.authorName, work?.year].filter(Boolean).join(", "), `En «${titulo}»`, [dateRangeText(a.startsAt, a.endsAt), lugar(a)].filter(Boolean).join(", ")].filter(Boolean),
        footer,
      };
    case "INVITATION":
      return {
        kicker: "Te invitamos a la inauguración", title: titulo,
        details: [openingWhenText(a.openingAt!, a.openingEndsAt), lugar(a), "Confirmá tu asistencia con el QR"].filter(Boolean), footer,
      };
  }
}

export function socialFileName(slug: string, v: SocialVariant, f: SocialFormat): string {
  return `muestra-${slug}-${PARAM_DE_VARIANTE[v]}-${PARAM_DE_FORMATO[f]}.${isPrintFormat(f) ? "pdf" : "jpg"}`;
}
