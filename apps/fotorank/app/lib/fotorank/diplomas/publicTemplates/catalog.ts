import { H, stdDynamicStack, W } from "./builders";
import { extraPublicTemplateRaws } from "./catalog-additions";
import { layout, line, qr, rect, txt } from "./helpers";
import { modernDecorativePublicTemplateRaws } from "./modernDecorativeTemplates";
import type {
  PublicTemplateBundle,
  PublicTemplateFamily,
  PublicTemplateMeta,
  PublicTemplateStyleTag,
  RawPublicTemplate,
} from "./publicTemplateTypes";

export type {
  PublicTemplateBundle,
  PublicTemplateFamily,
  PublicTemplateMeta,
  PublicTemplateStyleTag,
} from "./publicTemplateTypes";

function inferFamily(tags: PublicTemplateStyleTag[]): PublicTemplateFamily {
  if (tags.includes("decorativo")) return "modern-decorative";
  if (tags.includes("moderno")) return "moderno";
  if (tags.includes("gala") || tags.includes("negro-dorado") || tags.includes("premium")) return "premium";
  if (tags.includes("vintage") || tags.includes("clasico") || tags.includes("ornamental")) return "clasico";
  if (tags.includes("workshop")) return "workshop";
  if (tags.includes("participacion")) return "participacion";
  if (tags.includes("fotografia")) return "fotografia";
  if (tags.includes("corporativo")) return "corporativo";
  if (tags.includes("minimal") || tags.includes("neutro") || tags.includes("internacional")) return "minimal";
  if (tags.includes("artistico") || tags.includes("editorial")) return "artistico";
  if (tags.includes("academico") || tags.includes("institucional") || tags.includes("azul")) return "institucional";
  return "moderno";
}

function enrichMeta(b: RawPublicTemplate): PublicTemplateBundle {
  const { slug, family, keywords, ...rest } = b;
  return {
    ...rest,
    slug: slug ?? rest.id,
    family: family ?? inferFamily(rest.styleTags),
    keywords: keywords ?? [],
  };
}

type RawBundle = Omit<PublicTemplateBundle, "slug" | "family" | "keywords"> & {
  slug?: string;
  family?: PublicTemplateFamily;
  keywords?: string[];
};

const CATALOG_RAW: RawBundle[] = [
  {
    id: "pub-clasico-institucional",
    name: "Clásico institucional",
    description: "Marco ornamental, jerarquía centrada, tono ceremonial.",
    styleTags: ["clasico", "beige", "ornamental", "institucional", "fotografia"],
    accentColor: "#b8860b",
    backgroundColor: "#f7f3eb",
    keywords: ["salón", "institución", "diploma", "elegante"],
    layout: (() => {
      const p = "pc1";
      return stdDynamicStack(p, {
        titleY: 88,
        recipientY: 200,
        entryY: 268,
        orgY: 400,
        catY: 332,
        prizeY: 300,
        codeY: 468,
        qrX: 702,
        qrY: 455,
        qrS: 88,
        titleSize: 22,
        recipientSize: 26,
        titleColor: "#1a1a1a",
        bodyColor: "#4a4a4a",
        accentColor: "#b8860b",
        subtitle: "CERTIFICADO INSTITUCIONAL",
        frame: "rich",
        fontPreset: "classicPrint",
      });
    })(),
  },
  {
    id: "pub-minimal-moderno",
    name: "Minimal moderno",
    description: "Mucho aire, tipografía clara, sin adornos.",
    styleTags: ["minimal", "internacional", "neutro"],
    accentColor: "#111827",
    backgroundColor: "#ffffff",
    layout: (() => {
      const p = "pm2";
      const blocks = [
        line(`${p}-l1`, 120, 120, W - 240, 1, "#e5e7eb", 1),
        txt(`${p}-t`, 80, 140, W - 160, 36, "{{contestTitle}}", {
          fontSize: 20,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#111827",
          textAlign: "center",
        }),
        txt(`${p}-r`, 80, 240, W - 160, 40, "{{recipientName}}", {
          fontSize: 24,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#111827",
          textAlign: "center",
        }),
        txt(`${p}-e`, 80, 300, W - 160, 24, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "inter",
          color: "#6b7280",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 80, 340, W - 160, 22, "{{prizeLabel}}", {
          fontSize: 11,
          fontFamily: "inter",
          color: "#111827",
          textAlign: "center",
        }),
        txt(`${p}-c`, 80, 380, W - 160, 20, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#9ca3af",
          textAlign: "center",
        }),
        txt(`${p}-d`, 80, 430, W - 160, 18, "{{issuedDate}} · {{diplomaCode}}", {
          fontSize: 9,
          fontFamily: "inter",
          color: "#9ca3af",
          textAlign: "center",
        }),
        qr(`${p}-q`, 720, 480, 72),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-premium-oscuro",
    name: "Premium oscuro",
    description: "Fondo profundo, acentos dorados.",
    styleTags: ["oscuro", "negro-dorado", "gala"],
    accentColor: "#d4af37",
    backgroundColor: "#0a0a0a",
    layout: stdDynamicStack("ppo", {
      titleY: 72,
      recipientY: 190,
      entryY: 258,
      orgY: 392,
      catY: 324,
      prizeY: 288,
      codeY: 460,
      qrX: 698,
      qrY: 448,
      qrS: 96,
      titleSize: 24,
      recipientSize: 28,
      titleColor: "#d4af37",
      bodyColor: "#a1a1a1",
      accentColor: "#d4af37",
      subtitle: "DIPLOMA DE RECONOCIMIENTO",
      frame: "simple",
      fontPreset: "galaSerif",
    }),
  },
  {
    id: "pub-academico-formal",
    name: "Académico formal",
    description: "Tono solemne, bloque superior institucional.",
    styleTags: ["academico", "azul", "clasico"],
    accentColor: "#c9a227",
    backgroundColor: "#f4f6fb",
    layout: (() => {
      const p = "paf";
      const blocks = [
        rect(`${p}-band`, 0, 0, W, 72, { fillColor: "#1e3a5f", layerName: "Banda" }),
        txt(`${p}-inst`, 40, 22, W - 80, 28, "{{organizerName}}", {
          fontSize: 11,
          color: "#e2e8f0",
          textAlign: "center",
          layerName: "Organizador cabecera",
        }),
        txt(`${p}-ct`, 56, 110, W - 112, 40, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#1e3a5f",
          textAlign: "center",
        }),
        txt(`${p}-rec`, 56, 200, W - 112, 48, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          color: "#0f172a",
          textAlign: "center",
        }),
        txt(`${p}-en`, 56, 270, W - 112, 26, "{{entryTitle}}", {
          fontSize: 12,
          color: "#475569",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 56, 318, W - 112, 24, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          color: "#c9a227",
          textAlign: "center",
        }),
        txt(`${p}-cat`, 56, 360, W - 112, 20, "{{categoryName}}", {
          fontSize: 11,
          color: "#64748b",
          textAlign: "center",
        }),
        txt(`${p}-code`, 56, 430, W - 112, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#94a3b8",
          textAlign: "center",
        }),
        txt(`${p}-vu`, 56, 452, W - 112, 14, "{{verificationUrl}}", {
          fontSize: 7,
          color: "#94a3b8",
          textAlign: "center",
        }),
        qr(`${p}-q`, 700, 460, 88),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-artistico",
    name: "Certificado artístico",
    description: "Composición abierta con líneas suaves.",
    styleTags: ["artistico", "editorial"],
    accentColor: "#c084fc",
    backgroundColor: "#faf5ff",
    layout: (() => {
      const p = "par";
      const blocks = [
        line(`${p}-l`, 48, 400, 200, 2, "#e9d5ff", 2),
        line(`${p}-l2`, W - 248, 180, 200, 2, "#e9d5ff", 2),
        txt(`${p}-t`, 56, 100, W - 112, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#581c87",
          textAlign: "left",
        }),
        txt(`${p}-r`, 56, 200, 420, 56, "{{recipientName}}", {
          fontSize: 30,
          fontWeight: "bold",
          color: "#4c1d95",
          textAlign: "left",
        }),
        txt(`${p}-e`, 56, 290, 500, 28, "{{entryTitle}}", {
          fontSize: 13,
          color: "#6b21a8",
          textAlign: "left",
        }),
        txt(`${p}-p`, 56, 340, 500, 24, "{{prizeLabel}}", {
          fontSize: 12,
          color: "#a855f7",
          textAlign: "left",
        }),
        txt(`${p}-rest`, 56, 400, 500, 80, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 11,
          color: "#7e22ce",
          textAlign: "left",
        }),
        txt(`${p}-cd`, 56, 500, W - 112, 20, "{{diplomaCode}} · {{issuedDate}} · {{verificationUrl}}", {
          fontSize: 8,
          color: "#9333ea",
          textAlign: "left",
        }),
        qr(`${p}-q`, 680, 420, 92),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-corporativo",
    name: "Sobrio corporativo",
    description: "Gris claro, acento azul, lectura rápida.",
    styleTags: ["corporativo", "minimal", "internacional"],
    accentColor: "#2563eb",
    backgroundColor: "#f1f5f9",
    layout: (() => {
      const p = "pco";
      const blocks = [
        rect(`${p}-stripe`, 0, H - 48, W, 48, { fillColor: "#2563eb", opacity: 0.15 }),
        txt(`${p}-t`, 64, 96, W - 128, 36, "{{contestTitle}}", {
          fontSize: 20,
          fontWeight: "bold",
          color: "#0f172a",
          textAlign: "left",
        }),
        txt(`${p}-r`, 64, 180, W - 128, 36, "{{recipientName}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#1e293b",
          textAlign: "left",
        }),
        txt(`${p}-e`, 64, 240, W - 128, 24, "{{entryTitle}}", {
          fontSize: 12,
          color: "#475569",
          textAlign: "left",
        }),
        txt(`${p}-p`, 64, 280, W - 128, 22, "{{prizeLabel}}", {
          fontSize: 11,
          fontWeight: "bold",
          color: "#2563eb",
          textAlign: "left",
        }),
        txt(`${p}-m`, 64, 330, W - 128, 40, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#64748b",
          textAlign: "left",
        }),
        txt(`${p}-d`, 64, 420, W - 128, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#94a3b8",
          textAlign: "left",
        }),
        qr(`${p}-q`, 700, 460, 84),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-gala-premio",
    name: "Premiación / gala",
    description: "Alto contraste, sensación escénica.",
    styleTags: ["gala", "oscuro", "premio"],
    accentColor: "#fbbf24",
    backgroundColor: "#030712",
    layout: (() => {
      const p = "pga";
      const blocks = [
        line(`${p}-shine`, 0, 120, W, 3, "#fbbf24", 2),
        txt(`${p}-t`, 48, 140, W - 96, 48, "{{contestTitle}}", {
          fontSize: 26,
          fontWeight: "bold",
          color: "#fef3c7",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 230, W - 96, 40, "{{prizeLabel}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#fbbf24",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 300, W - 96, 44, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 370, W - 96, 26, "{{entryTitle}}", {
          fontSize: 12,
          color: "#d1d5db",
          textAlign: "center",
        }),
        txt(`${p}-o`, 48, 420, W - 96, 24, "{{organizerName}} · {{categoryName}}", {
          fontSize: 10,
          color: "#9ca3af",
          textAlign: "center",
        }),
        txt(`${p}-d`, 48, 470, W - 96, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#6b7280",
          textAlign: "center",
        }),
        qr(`${p}-q`, 688, 440, 96),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-vintage",
    name: "Vintage diploma",
    description: "Tonos sepia, marco doble suave.",
    styleTags: ["vintage", "beige", "clasico"],
    accentColor: "#8b5a2b",
    backgroundColor: "#ede4d3",
    layout: (() => {
      const p = "pvi";
      const blocks = [
        rect(`${p}-o`, 40, 40, W - 80, H - 80, {
          fillColor: "transparent",
          strokeColor: "#a67c52",
          strokeWidth: 2,
        }),
        rect(`${p}-i`, 56, 56, W - 112, H - 112, {
          fillColor: "transparent",
          strokeColor: "#c4a574",
          strokeWidth: 1,
        }),
        txt(`${p}-t`, 80, 100, W - 160, 40, "{{contestTitle}}", {
          fontSize: 20,
          fontWeight: "bold",
          color: "#3d2914",
          textAlign: "center",
        }),
        txt(`${p}-r`, 80, 200, W - 160, 44, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          color: "#5c3d1e",
          textAlign: "center",
        }),
        txt(`${p}-e`, 80, 280, W - 160, 26, "{{entryTitle}}", {
          fontSize: 12,
          color: "#6b4f2a",
          textAlign: "center",
        }),
        txt(`${p}-p`, 80, 330, W - 160, 24, "{{prizeLabel}}", {
          fontSize: 11,
          color: "#8b5a2b",
          textAlign: "center",
        }),
        txt(`${p}-m`, 80, 380, W - 160, 36, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          color: "#7a5c3a",
          textAlign: "center",
        }),
        txt(`${p}-d`, 80, 460, W - 160, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#8a7654",
          textAlign: "center",
        }),
        qr(`${p}-q`, 702, 450, 88),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-editorial-moderno",
    name: "Editorial moderno",
    description: "Columna de título y cuerpo alineado a la izquierda.",
    styleTags: ["editorial", "minimal", "horizontal"],
    accentColor: "#0f172a",
    backgroundColor: "#ffffff",
    layout: (() => {
      const p = "pem";
      const blocks = [
        txt(`${p}-k`, 48, 64, 280, 200, "DIPLOMA", {
          fontSize: 42,
          fontWeight: "bold",
          color: "#cbd5e1",
          textAlign: "left",
        }),
        rect(`${p}-side`, 48, 48, 4, 500, { fillColor: "#0f172a" }),
        txt(`${p}-ct`, 120, 80, W - 168, 36, "{{contestTitle}}", {
          fontSize: 18,
          fontWeight: "bold",
          color: "#0f172a",
          textAlign: "left",
        }),
        txt(`${p}-r`, 120, 160, W - 168, 44, "{{recipientName}}", {
          fontSize: 24,
          fontWeight: "bold",
          color: "#020617",
          textAlign: "left",
        }),
        txt(`${p}-e`, 120, 240, W - 168, 28, "{{entryTitle}}", {
          fontSize: 12,
          color: "#475569",
          textAlign: "left",
        }),
        txt(`${p}-p`, 120, 290, W - 168, 24, "{{prizeLabel}}", {
          fontSize: 11,
          color: "#0f172a",
          textAlign: "left",
        }),
        txt(`${p}-m`, 120, 340, W - 168, 40, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#64748b",
          textAlign: "left",
        }),
        txt(`${p}-d`, 120, 430, W - 168, 18, "{{diplomaCode}} · {{issuedDate}} · {{verificationUrl}}", {
          fontSize: 8,
          color: "#94a3b8",
          textAlign: "left",
        }),
        qr(`${p}-q`, 680, 420, 88),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-marco-ornamental",
    name: "Marco ornamental fino",
    description: "Doble línea y esquinas marcadas.",
    styleTags: ["ornamental", "clasico", "blanco-dorado"],
    accentColor: "#b45309",
    backgroundColor: "#fffbeb",
    layout: (() => {
      const p = "pmo";
      const blocks = [
        rect(`${p}-o`, 28, 28, W - 56, H - 56, {
          fillColor: "transparent",
          strokeColor: "#d97706",
          strokeWidth: 2,
        }),
        rect(`${p}-i`, 44, 44, W - 88, H - 88, {
          fillColor: "transparent",
          strokeColor: "#fbbf24",
          strokeWidth: 1,
        }),
        txt(`${p}-t`, 72, 100, W - 144, 40, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#78350f",
          textAlign: "center",
        }),
        txt(`${p}-r`, 72, 200, W - 144, 44, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          color: "#451a03",
          textAlign: "center",
        }),
        txt(`${p}-e`, 72, 280, W - 144, 26, "{{entryTitle}}", {
          fontSize: 12,
          color: "#92400e",
          textAlign: "center",
        }),
        txt(`${p}-p`, 72, 330, W - 144, 24, "{{prizeLabel}}", {
          fontSize: 12,
          color: "#b45309",
          textAlign: "center",
        }),
        txt(`${p}-m`, 72, 380, W - 144, 36, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#a16207",
          textAlign: "center",
        }),
        txt(`${p}-d`, 72, 460, W - 144, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#b45309",
          textAlign: "center",
        }),
        qr(`${p}-q`, 698, 448, 92),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-internacional-clean",
    name: "Internacional clean",
    description: "Blanco puro, azul marino, mucho espacio.",
    styleTags: ["internacional", "minimal", "azul"],
    accentColor: "#1d4ed8",
    backgroundColor: "#ffffff",
    layout: (() => {
      const p = "pic";
      const blocks = [
        line(`${p}-top`, 80, 96, W - 160, 2, "#1d4ed8", 2),
        txt(`${p}-t`, 80, 120, W - 160, 36, "{{contestTitle}}", {
          fontSize: 20,
          fontWeight: "bold",
          color: "#1e3a8a",
          textAlign: "center",
        }),
        txt(`${p}-r`, 80, 210, W - 160, 40, "{{recipientName}}", {
          fontSize: 24,
          fontWeight: "bold",
          color: "#172554",
          textAlign: "center",
        }),
        txt(`${p}-e`, 80, 280, W - 160, 26, "{{entryTitle}}", {
          fontSize: 12,
          color: "#475569",
          textAlign: "center",
        }),
        txt(`${p}-p`, 80, 330, W - 160, 22, "{{prizeLabel}}", {
          fontSize: 11,
          color: "#1d4ed8",
          textAlign: "center",
        }),
        txt(`${p}-m`, 80, 380, W - 160, 32, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#64748b",
          textAlign: "center",
        }),
        txt(`${p}-d`, 80, 450, W - 160, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#94a3b8",
          textAlign: "center",
        }),
        qr(`${p}-q`, 708, 458, 80),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-vertical-formal",
    name: "Vertical formal",
    description: "Bloque izquierdo con rótulos, contenido al centro.",
    styleTags: ["vertical", "academico", "corporativo"],
    accentColor: "#334155",
    backgroundColor: "#f8fafc",
    layout: (() => {
      const p = "pvf";
      const blocks = [
        rect(`${p}-col`, 48, 48, 200, H - 96, { fillColor: "#f1f5f9", strokeColor: "#e2e8f0", strokeWidth: 1 }),
        txt(`${p}-lb`, 64, 120, 168, 120, "ORGANIZADOR\nPREMIO\nCATEGORÍA", {
          fontSize: 9,
          color: "#64748b",
          textAlign: "left",
        }),
        txt(`${p}-ct`, 280, 100, W - 320, 40, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#0f172a",
          textAlign: "left",
        }),
        txt(`${p}-r`, 280, 200, W - 320, 48, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          color: "#020617",
          textAlign: "left",
        }),
        txt(`${p}-e`, 280, 290, W - 320, 28, "{{entryTitle}}", {
          fontSize: 12,
          color: "#475569",
          textAlign: "left",
        }),
        txt(`${p}-p`, 280, 340, W - 320, 24, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          color: "#334155",
          textAlign: "left",
        }),
        txt(`${p}-m`, 280, 390, W - 320, 40, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          color: "#64748b",
          textAlign: "left",
        }),
        txt(`${p}-d`, 280, 470, W - 320, 20, "{{diplomaCode}} · {{issuedDate}} · {{verificationUrl}}", {
          fontSize: 8,
          color: "#94a3b8",
          textAlign: "left",
        }),
        qr(`${p}-q`, 680, 420, 88),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-horizontal-premium",
    name: "Horizontal premium",
    description: "Banda superior dorada y título destacado.",
    styleTags: ["horizontal", "blanco-dorado", "gala"],
    accentColor: "#ca8a04",
    backgroundColor: "#fffef7",
    layout: (() => {
      const p = "php";
      const blocks = [
        rect(`${p}-band`, 0, 0, W, 100, { fillColor: "#fef3c7" }),
        line(`${p}-u`, 0, 100, W, 2, "#ca8a04", 2),
        txt(`${p}-t`, 48, 32, W - 96, 44, "{{contestTitle}}", {
          fontSize: 24,
          fontWeight: "bold",
          color: "#713f12",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 180, W - 96, 48, "{{recipientName}}", {
          fontSize: 30,
          fontWeight: "bold",
          color: "#422006",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 270, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          color: "#a16207",
          textAlign: "center",
        }),
        txt(`${p}-p`, 48, 320, W - 96, 26, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          color: "#ca8a04",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 380, W - 96, 32, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          color: "#92400e",
          textAlign: "center",
        }),
        txt(`${p}-d`, 48, 450, W - 96, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#a16207",
          textAlign: "center",
        }),
        qr(`${p}-q`, 698, 430, 92),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-foco-nombre",
    name: "Jerarquía: nombre",
    description: "El nombre del premiado domina el centro.",
    styleTags: ["nombre", "minimal"],
    accentColor: "#eab308",
    backgroundColor: "#09090b",
    layout: (() => {
      const p = "pfn";
      const blocks = [
        txt(`${p}-r`, 48, 200, W - 96, 72, "{{recipientName}}", {
          fontSize: 40,
          fontWeight: "bold",
          color: "#fafafa",
          textAlign: "center",
        }),
        txt(`${p}-t`, 48, 120, W - 96, 32, "{{contestTitle}}", {
          fontSize: 14,
          color: "#a1a1aa",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 310, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          color: "#d4d4d8",
          textAlign: "center",
        }),
        txt(`${p}-p`, 48, 360, W - 96, 24, "{{prizeLabel}}", {
          fontSize: 12,
          color: "#eab308",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 410, W - 96, 28, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#71717a",
          textAlign: "center",
        }),
        txt(`${p}-d`, 48, 480, W - 96, 18, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#52525b",
          textAlign: "center",
        }),
        qr(`${p}-q`, 702, 440, 88),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-foco-premio",
    name: "Jerarquía: premio",
    description: "Premio y categoría en primer plano.",
    styleTags: ["premio", "gala"],
    accentColor: "#f59e0b",
    backgroundColor: "#18181b",
    layout: (() => {
      const p = "pfp";
      const blocks = [
        txt(`${p}-p`, 48, 140, W - 96, 56, "{{prizeLabel}}", {
          fontSize: 28,
          fontWeight: "bold",
          color: "#fbbf24",
          textAlign: "center",
        }),
        txt(`${p}-c`, 48, 220, W - 96, 28, "{{categoryName}}", {
          fontSize: 14,
          color: "#e4e4e7",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 290, W - 96, 40, "{{recipientName}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#fafafa",
          textAlign: "center",
        }),
        txt(`${p}-t`, 48, 360, W - 96, 28, "{{contestTitle}}", {
          fontSize: 12,
          color: "#a1a1aa",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 410, W - 96, 24, "{{entryTitle}}", {
          fontSize: 11,
          color: "#a1a1aa",
          textAlign: "center",
        }),
        txt(`${p}-o`, 48, 460, W - 96, 20, "{{organizerName}}", {
          fontSize: 10,
          color: "#71717a",
          textAlign: "center",
        }),
        txt(`${p}-d`, 48, 500, W - 96, 16, "{{diplomaCode}} · {{issuedDate}} · {{verificationUrl}}", {
          fontSize: 8,
          color: "#52525b",
          textAlign: "center",
        }),
        qr(`${p}-q`, 688, 400, 96),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-blanco-dorado",
    name: "Blanco y dorado",
    description: "Elegancia clásica en claro.",
    styleTags: ["blanco-dorado", "clasico", "ornamental"],
    accentColor: "#d4af37",
    backgroundColor: "#fffffe",
    layout: stdDynamicStack("pbd", {
      titleY: 80,
      recipientY: 200,
      entryY: 270,
      orgY: 400,
      catY: 340,
      prizeY: 300,
      codeY: 470,
      qrX: 700,
      qrY: 455,
      qrS: 90,
      titleSize: 22,
      recipientSize: 28,
      titleColor: "#1c1917",
      bodyColor: "#57534e",
      accentColor: "#d4af37",
      subtitle: "RECONOCIMIENTO OFICIAL",
      frame: "rich",
      fontPreset: "classicPrint",
    }),
  },
  {
    id: "pub-negro-dorado",
    name: "Negro y dorado",
    description: "Contraste dramático tipo galardón.",
    styleTags: ["negro-dorado", "oscuro", "gala"],
    accentColor: "#e7c35f",
    backgroundColor: "#000000",
    layout: stdDynamicStack("pnd", {
      titleY: 76,
      recipientY: 196,
      entryY: 266,
      orgY: 396,
      catY: 336,
      prizeY: 296,
      codeY: 468,
      qrX: 696,
      qrY: 452,
      qrS: 96,
      titleSize: 24,
      recipientSize: 30,
      titleColor: "#e7c35f",
      bodyColor: "#a3a3a3",
      accentColor: "#e7c35f",
      subtitle: "DIPLOMA DE EXCELENCIA",
      frame: "simple",
      fontPreset: "galaSerif",
    }),
  },
  {
    id: "pub-azul-institucional",
    name: "Azul institucional",
    description: "Ideal para entidades educativas y certámenes.",
    styleTags: ["azul", "academico", "corporativo"],
    accentColor: "#93c5fd",
    backgroundColor: "#172554",
    layout: (() => {
      const p = "pai";
      const blocks = [
        rect(`${p}-head`, 0, 0, W, 88, { fillColor: "#1e3a8a" }),
        txt(`${p}-t`, 48, 120, W - 96, 40, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#e0e7ff",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 210, W - 96, 44, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 290, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          color: "#c7d2fe",
          textAlign: "center",
        }),
        txt(`${p}-p`, 48, 340, W - 96, 24, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          color: "#93c5fd",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 390, W - 96, 32, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#a5b4fc",
          textAlign: "center",
        }),
        txt(`${p}-d`, 48, 460, W - 96, 18, "{{diplomaCode}} · {{issuedDate}} · {{verificationUrl}}", {
          fontSize: 8,
          color: "#818cf8",
          textAlign: "center",
        }),
        qr(`${p}-q`, 698, 430, 92),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-beige-clasico",
    name: "Beige clásico",
    description: "Calidez papel antiguo, lectura suave.",
    styleTags: ["beige", "vintage", "clasico"],
    accentColor: "#78716c",
    backgroundColor: "#f5f0e6",
    layout: stdDynamicStack("pbc", {
      titleY: 92,
      recipientY: 204,
      entryY: 274,
      orgY: 404,
      catY: 344,
      prizeY: 304,
      codeY: 472,
      qrX: 704,
      qrY: 458,
      qrS: 86,
      titleSize: 21,
      recipientSize: 25,
      titleColor: "#292524",
      bodyColor: "#78716c",
      accentColor: "#a16207",
      subtitle: "CONSTANCIA DE PARTICIPACIÓN",
      frame: "rich",
      fontPreset: "editorial",
    }),
  },
  {
    id: "pub-neutra-editable",
    name: "Neutra altamente editable",
    description: "Base limpia para personalizar sin ruido visual.",
    styleTags: ["neutro", "minimal", "internacional"],
    accentColor: "#71717a",
    backgroundColor: "#ececee",
    layout: (() => {
      const p = "pne";
      const blocks = [
        txt(`${p}-t`, 64, 100, W - 128, 32, "{{contestTitle}}", {
          fontSize: 18,
          fontWeight: "bold",
          color: "#27272a",
          textAlign: "center",
        }),
        txt(`${p}-r`, 64, 180, W - 128, 36, "{{recipientName}}", {
          fontSize: 22,
          fontWeight: "bold",
          color: "#18181b",
          textAlign: "center",
        }),
        txt(`${p}-e`, 64, 250, W - 128, 26, "{{entryTitle}}", {
          fontSize: 12,
          color: "#52525b",
          textAlign: "center",
        }),
        txt(`${p}-p`, 64, 300, W - 128, 22, "{{prizeLabel}}", {
          fontSize: 11,
          color: "#3f3f46",
          textAlign: "center",
        }),
        txt(`${p}-m`, 64, 350, W - 128, 36, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          color: "#71717a",
          textAlign: "center",
        }),
        txt(`${p}-d`, 64, 430, W - 128, 20, "{{diplomaCode}} · {{issuedDate}}", {
          fontSize: 9,
          color: "#a1a1aa",
          textAlign: "center",
        }),
        txt(`${p}-v`, 64, 460, W - 128, 14, "{{verificationUrl}}", {
          fontSize: 7,
          color: "#a1a1aa",
          textAlign: "center",
        }),
        qr(`${p}-q`, 708, 460, 80),
      ];
      return layout(blocks);
    })(),
  },
  ...extraPublicTemplateRaws,
  ...modernDecorativePublicTemplateRaws,
];

const CATALOG: PublicTemplateBundle[] = CATALOG_RAW.map((r) => enrichMeta(r));

export const PUBLIC_DIPLOMA_TEMPLATE_LIST: readonly PublicTemplateMeta[] = CATALOG.map(
  ({
    id,
    slug,
    name,
    description,
    family,
    keywords,
    styleTags,
    accentColor,
    recommendedUse,
    paletteHint,
    formalityLevel,
  }) => ({
    id,
    slug,
    name,
    description,
    family,
    keywords,
    styleTags,
    accentColor,
    ...(recommendedUse != null ? { recommendedUse } : {}),
    ...(paletteHint != null ? { paletteHint } : {}),
    ...(formalityLevel != null ? { formalityLevel } : {}),
  })
);

export function getPublicTemplateBundle(id: string): PublicTemplateBundle | null {
  return CATALOG.find((t) => t.id === id) ?? null;
}

export function listPublicTemplatesFiltered(
  styleTag?: PublicTemplateStyleTag,
  family?: PublicTemplateFamily,
  searchQuery?: string
): PublicTemplateBundle[] {
  let list = [...CATALOG];
  if (styleTag) {
    list = list.filter((t) => t.styleTags.includes(styleTag));
  }
  if (family) {
    list = list.filter((t) => t.family === family);
  }
  const q = searchQuery?.trim().toLowerCase();
  if (q) {
    list = list.filter((t) => {
      const hay = `${t.name} ${t.description} ${t.keywords.join(" ")} ${t.styleTags.join(" ")} ${t.family} ${t.recommendedUse ?? ""} ${t.paletteHint ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return list;
}
