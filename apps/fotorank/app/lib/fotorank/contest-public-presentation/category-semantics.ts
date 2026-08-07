import type { LucideIcon } from "lucide-react";
import {
  Camera,
  IdCard,
  Plane,
  Smartphone,
  Layers,
} from "lucide-react";

export type CategorySemanticKind =
  | "amateur"
  | "professional"
  | "press"
  | "aerial"
  | "generic";

export type CategoryInfoBadgeTone = "device" | "docs" | "limit" | "modality" | "special";

export type CategoryInfoBadge = {
  key: string;
  label: string;
  tone: CategoryInfoBadgeTone;
  icon?: LucideIcon;
};

export type PublicCategoryInput = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxFiles: number;
};

export type CategoryPublicPresentation = {
  kind: CategorySemanticKind;
  icon: LucideIcon;
  /** Etiqueta principal de dispositivo/modalidad (si aplica). */
  primaryLabel: string | null;
  badges: CategoryInfoBadge[];
  /** Nota de requisito especial (sin datos privados). */
  requirementNote: string | null;
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function detectKind(slug: string, name: string): CategorySemanticKind {
  const s = normalize(slug);
  const n = normalize(name);
  if (s.includes("amateur") || n.includes("amateur") || n.includes("aficionado")) return "amateur";
  if (s.includes("profesional") || n.includes("profesional")) return "professional";
  if (s.includes("reportero") || n.includes("reportero") || n.includes("prensa")) return "press";
  if (s.includes("aerea") || s.includes("aereo") || s.includes("dron") || n.includes("aerea") || n.includes("dron")) {
    return "aerial";
  }
  return "generic";
}

/**
 * Presentación semántica de categoría a partir de datos reales.
 * No inventa requisitos: solo mapea patrones conocidos + maxFiles.
 */
export function resolveCategoryPresentation(category: PublicCategoryInput): CategoryPublicPresentation {
  const kind = detectKind(category.slug, category.name);
  const maxLabel =
    category.maxFiles === 1
      ? "1 fotografía"
      : `${category.maxFiles} fotografías`;

  const limitBadge: CategoryInfoBadge = {
    key: "max-files",
    label: `Máx. ${maxLabel}`,
    tone: "limit",
    icon: Camera,
  };

  switch (kind) {
    case "amateur":
      return {
        kind,
        icon: Smartphone,
        primaryLabel: "Celular o cámara",
        badges: [
          { key: "device", label: "Celular o cámara", tone: "device", icon: Smartphone },
          limitBadge,
        ],
        requirementNote: null,
      };
    case "professional":
      return {
        kind,
        icon: Camera,
        primaryLabel: "Solo cámara fotográfica",
        badges: [
          { key: "device", label: "Solo cámara fotográfica", tone: "device", icon: Camera },
          limitBadge,
        ],
        requirementNote: null,
      };
    case "press":
      return {
        kind,
        icon: IdCard,
        primaryLabel: "Requiere acreditación ARGRA",
        badges: [
          { key: "docs", label: "Acreditación ARGRA", tone: "docs", icon: IdCard },
          limitBadge,
          { key: "verify", label: "Sujeto a verificación", tone: "special" },
        ],
        requirementNote:
          "Es obligatorio declarar el número de socio ARGRA; la organización lo verifica. No se publica ese dato en la página del concurso.",
      };
    case "aerial":
      return {
        kind,
        icon: Plane,
        primaryLabel: "Realizada con dron",
        badges: [
          { key: "device", label: "Realizada con dron", tone: "device", icon: Plane },
          limitBadge,
          { key: "docs", label: "Documentación adicional posible", tone: "docs" },
        ],
        requirementNote:
          "La organización podrá solicitar información técnica o documentación adicional según las bases.",
      };
    default:
      return {
        kind: "generic",
        icon: Layers,
        primaryLabel: null,
        badges: [limitBadge],
        requirementNote: null,
      };
  }
}
