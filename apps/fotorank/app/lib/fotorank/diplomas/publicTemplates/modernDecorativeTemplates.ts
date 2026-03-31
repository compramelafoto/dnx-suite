import type { DiplomaLayoutBlock } from "../layoutSchema";
import { H, W, medalPlaque, ribbonBehind } from "./builders";
import { layout, line, qr, rect, txt } from "./helpers";
import type { RawPublicTemplate } from "./publicTemplateTypes";

/** Pie con variables dinámicas + QR (compatible PDF: sin rotación). */
function mdFooter(
  p: string,
  codeY: number,
  qrX: number,
  qrY: number,
  qrS: number,
  textColor: string,
  align: "left" | "center" | "right" = "center"
): DiplomaLayoutBlock[] {
  const x = align === "left" ? 56 : align === "right" ? 56 : 48;
  const w = align === "center" ? W - 96 : W - 120;
  return [
    txt(`${p}-code`, x, codeY, w, 20, "{{diplomaCode}} · {{issuedDate}}", {
      fontSize: 9,
      fontFamily: "inter",
      color: textColor,
      textAlign: align,
    }),
    txt(`${p}-v`, x, codeY + 18, w, 16, "{{verificationUrl}}", {
      fontSize: 7,
      fontFamily: "inter",
      color: textColor,
      textAlign: align,
      opacity: 0.88,
    }),
    qr(`${p}-q`, qrX, qrY, qrS),
  ];
}

/**
 * Familia **modern-decorative**: composiciones contemporáneas con bandas, bloques,
 * acentos y tipografía mixta. Todas usan los campos merge estándar.
 */
export const modernDecorativePublicTemplateRaws: RawPublicTemplate[] = [
  /* —— Moderno elegante —— */
  {
    id: "pub-md-ivory-wave",
    name: "Marfil — ondas",
    description:
      "Crema cálido con bandas horizontales suaves y jerarquía serif + sans; ideal para constancias elegantes.",
    styleTags: ["decorativo", "moderno", "beige", "neutro", "reconocimiento"],
    accentColor: "#c4a574",
    backgroundColor: "#faf7f2",
    keywords: ["moderno", "decorativo", "elegante", "workshop", "horizontal", "participación"],
    family: "modern-decorative",
    recommendedUse: "Participación, reconocimiento, talleres con tono premium suave",
    paletteHint: "Marfil, arena, acento bronce",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdiv";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-w1`, 0, 0, W, 72, { fillColor: "#e8dcc8", opacity: 0.45, layerName: "Banda 1" }),
        rect(`${p}-w2`, 0, 56, W, 48, { fillColor: "#d4c4a8", opacity: 0.28, layerName: "Banda 2" }),
        rect(`${p}-w3`, 0, 92, W, 32, { fillColor: "#c4a574", opacity: 0.15, layerName: "Banda 3" }),
        line(`${p}-rule`, 120, 168, W - 240, 1, "#c4a574", 1),
        txt(`${p}-sub`, 48, 118, W - 96, 22, "CERTIFICADO DE PARTICIPACIÓN", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 152, W - 96, 44, "{{contestTitle}}", {
          fontSize: 21,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#292524",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 218, W - 96, 52, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#1c1917",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 288, W - 96, 28, "Obra / proyecto: {{entryTitle}}", {
          fontSize: 12,
          fontFamily: "lora",
          color: "#57534e",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 332, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#a16207",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 372, W - 96, 36, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 698, 420, 88, "#57534e"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-ash-editorial",
    name: "Gris ceniza — editorial",
    description: "Franja vertical fría y tipografía editorial asimétrica; sensación revista contemporánea.",
    styleTags: ["decorativo", "editorial", "minimal", "neutro", "creativo"],
    accentColor: "#0ea5e9",
    backgroundColor: "#f8fafc",
    keywords: ["editorial", "moderno", "decorativo", "horizontal", "congreso"],
    family: "modern-decorative",
    recommendedUse: "Jornadas, congresos, certificados con aire editorial",
    paletteHint: "Gris frío, blanco, acento cian",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdas";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-bar`, 0, 0, 44, H, { fillColor: "#0f172a", layerName: "Barra lateral" }),
        rect(`${p}-acc`, 44, 0, 6, H, { fillColor: "#0ea5e9", layerName: "Acento" }),
        txt(`${p}-k`, 72, 48, W - 120, 20, "RECONOCIMIENTO", {
          fontSize: 9,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#64748b",
          textAlign: "left",
        }),
        txt(`${p}-ct`, 72, 88, W - 120, 48, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#0f172a",
          textAlign: "left",
        }),
        txt(`${p}-r`, 72, 168, W - 120, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#020617",
          textAlign: "left",
        }),
        txt(`${p}-e`, 72, 248, W - 120, 32, "{{entryTitle}}", {
          fontSize: 13,
          fontFamily: "sourceSerif4",
          color: "#475569",
          textAlign: "left",
        }),
        txt(`${p}-pr`, 72, 300, W - 120, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#0284c7",
          textAlign: "left",
        }),
        txt(`${p}-m`, 72, 352, W - 120, 40, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#64748b",
          textAlign: "left",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#64748b", "left"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-silk-ledger",
    name: "Seda — libro mayor",
    description: "Crema y filetes finos en esquinas; combinación Libre Baskerville + Inter, tono sofisticado.",
    styleTags: ["decorativo", "clasico", "beige", "reconocimiento", "premium"],
    accentColor: "#92400e",
    backgroundColor: "#fdfcfa",
    keywords: ["elegante", "decorativo", "constancia", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Menciones, diplomas de mérito con presencia clásica renovada",
    paletteHint: "Blanco roto, marrón rojizo",
    formalityLevel: "alto",
    layout: (() => {
      const p = "mdsl";
      const m = 40;
      const blocks: DiplomaLayoutBlock[] = [
        line(`${p}-t`, m, m, W - m * 2, 1, "#92400e", 1),
        line(`${p}-b`, m, H - m, W - m * 2, 1, "#92400e", 1),
        line(`${p}-l`, m, m, 1, H - m * 2, "#92400e", 1),
        line(`${p}-r`, W - m, m, 1, H - m * 2, "#92400e", 1),
        rect(`${p}-c1`, m + 8, m + 8, 20, 20, { fillColor: "#92400e", opacity: 0.2 }),
        rect(`${p}-c2`, W - m - 28, m + 8, 20, 20, { fillColor: "#92400e", opacity: 0.2 }),
        txt(`${p}-sub`, 64, 100, W - 128, 22, "DIPLOMA", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "cinzel",
          color: "#92400e",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 64, 136, W - 128, 44, "{{contestTitle}}", {
          fontSize: 20,
          fontWeight: "bold",
          fontFamily: "libreBaskerville",
          color: "#1c1917",
          textAlign: "center",
        }),
        txt(`${p}-r`, 64, 208, W - 128, 52, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          fontFamily: "libreBaskerville",
          color: "#292524",
          textAlign: "center",
        }),
        txt(`${p}-e`, 64, 284, W - 128, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "merriweather",
          color: "#57534e",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 64, 328, W - 128, 26, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "cinzel",
          color: "#b45309",
          textAlign: "center",
        }),
        txt(`${p}-m`, 64, 376, W - 128, 36, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 702, 420, 88, "#78716c"),
      ];
      return layout(blocks);
    })(),
  },
  /* —— Moderno colorido —— */
  {
    id: "pub-md-coral-pulse",
    name: "Coral — pulso",
    description: "Bloque cálido lateral y tipografía firme; energía para workshops y cursos vivos.",
    styleTags: ["decorativo", "colorido", "creativo", "workshop", "moderno"],
    accentColor: "#f43f5e",
    backgroundColor: "#fff1f2",
    keywords: ["colorido", "taller", "workshop", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Workshops, masterclasses relajadas, participación destacada",
    paletteHint: "Rosa coral, crema",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdco";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-side`, 0, 0, 220, H, { fillColor: "#fda4af", opacity: 0.35, layerName: "Panel coral" }),
        rect(`${p}-dot`, 180, 120, 120, 120, { fillColor: "#f43f5e", opacity: 0.12, layerName: "Mancha" }),
        txt(`${p}-k`, 240, 56, W - 280, 22, "CONSTANCIA DE ASISTENCIA", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#be123c",
          textAlign: "left",
        }),
        txt(`${p}-ct`, 240, 100, W - 280, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#881337",
          textAlign: "left",
        }),
        txt(`${p}-r`, 240, 176, W - 280, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#4c0519",
          textAlign: "left",
        }),
        txt(`${p}-e`, 240, 252, W - 280, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "inter",
          color: "#9f1239",
          textAlign: "left",
        }),
        txt(`${p}-pr`, 240, 300, W - 280, 26, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#e11d48",
          textAlign: "left",
        }),
        txt(`${p}-m`, 240, 348, W - 280, 40, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#9f1239",
          textAlign: "left",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#881337", "left"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-teal-flow",
    name: "Turquesa — flujo",
    description: "Franjas horizontales en degradado simulado y acento turquesa; fresco y formativo.",
    styleTags: ["decorativo", "colorido", "workshop", "moderno", "reconocimiento"],
    accentColor: "#0d9488",
    backgroundColor: "#f0fdfa",
    keywords: ["turquesa", "curso", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Seminarios, formación técnica, constancias de taller",
    paletteHint: "Menta, turquesa, blanco",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdtf";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-s1`, 0, 48, W, 28, { fillColor: "#5eead4", opacity: 0.35 }),
        rect(`${p}-s2`, 0, 88, W, 24, { fillColor: "#2dd4bf", opacity: 0.25 }),
        rect(`${p}-s3`, 0, 120, W, 18, { fillColor: "#14b8a6", opacity: 0.18 }),
        txt(`${p}-ct`, 48, 180, W - 96, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#134e4a",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 248, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#042f2e",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 320, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "sourceSerif4",
          color: "#115e59",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 364, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#0d9488",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 408, W - 96, 36, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#0f766e",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 702, 420, 88, "#115e59"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-citrus-pop",
    name: "Cítrico — pop",
    description: "Amarillo limón y violeta profundo; contraste alto para festivales y eventos creativos.",
    styleTags: ["decorativo", "colorido", "creativo", "premio", "fotografia"],
    accentColor: "#7c3aed",
    backgroundColor: "#fefce8",
    keywords: ["festival", "creativo", "decorativo", "horizontal", "premio"],
    family: "modern-decorative",
    recommendedUse: "Festivales, premios jóvenes, menciones con carácter",
    paletteHint: "Amarillo limón, violeta",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdcp";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-top`, 0, 0, W, 56, { fillColor: "#facc15", opacity: 0.55 }),
        rect(`${p}-corner`, W - 160, 80, 160, 160, { fillColor: "#7c3aed", opacity: 0.08 }),
        txt(`${p}-k`, 48, 72, W - 96, 24, "MENCIÓN ESPECIAL", {
          fontSize: 11,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#5b21b6",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 116, W - 96, 44, "{{contestTitle}}", {
          fontSize: 21,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#4c1d95",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 192, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#3b0764",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 268, W - 96, 28, "Obra: {{entryTitle}}", {
          fontSize: 12,
          fontFamily: "lora",
          color: "#6d28d9",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 312, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 13,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#ca8a04",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 360, W - 96, 36, "{{organizerName}} · {{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#5b21b6",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 698, 420, 88, "#6d28d9"),
      ];
      return layout(blocks);
    })(),
  },
  /* —— Moderno premium oscuro —— */
  {
    id: "pub-md-onyx-gilt",
    name: "Ónix — pan de oro",
    description: "Negro profundo, filetes dorados y placa tipo medalla; premios y galardones serios.",
    styleTags: ["decorativo", "oscuro", "negro-dorado", "premium", "premio", "gala"],
    accentColor: "#d4af37",
    backgroundColor: "#0a0a0a",
    keywords: ["premium", "oscuro", "oro", "premio", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Primer premio, gran premio, reconocimientos institucionales nocturnos",
    paletteHint: "Negro, oro",
    formalityLevel: "alto",
    layout: (() => {
      const p = "mdox";
      const blocks: DiplomaLayoutBlock[] = [
        line(`${p}-g1`, 48, 64, W - 96, 1, "#d4af37", 1),
        line(`${p}-g2`, 48, H - 64, W - 96, 1, "#d4af37", 1),
        ...ribbonBehind(p, 96, 40, "#d4af37", 0.08),
        ...medalPlaque(p, W / 2, 168, 48, "#d4af37", "#171717"),
        txt(`${p}-ct`, 48, 240, W - 96, 40, "{{contestTitle}}", {
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "cinzel",
          color: "#e7e5e4",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 292, W - 96, 36, "{{prizeLabel}}", {
          fontSize: 20,
          fontWeight: "bold",
          fontFamily: "cinzel",
          color: "#fcd34d",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 344, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "cormorantGaramond",
          color: "#fafaf9",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 412, W - 96, 26, "{{entryTitle}}", {
          fontSize: 11,
          fontFamily: "lora",
          color: "#a8a29e",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 452, W - 96, 32, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 698, 420, 88, "#a8a29e"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-navy-silver",
    name: "Azul noche — plata",
    description: "Azul petróleo con acentos plateados y sans condensada; gala contemporánea.",
    styleTags: ["decorativo", "oscuro", "azul", "premium", "gala"],
    accentColor: "#94a3b8",
    backgroundColor: "#0f172a",
    keywords: ["azul", "plateado", "gala", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Ceremonias nocturnas, premios corporativos creativos",
    paletteHint: "Azul oscuro, plata",
    formalityLevel: "alto",
    layout: (() => {
      const p = "mdnv";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-shine`, 0, 0, W, 4, { fillColor: "#cbd5e1", opacity: 0.4 }),
        line(`${p}-rule`, 120, 200, W - 240, 1, "#64748b", 1),
        txt(`${p}-k`, 48, 72, W - 96, 24, "ACTO DE RECONOCIMIENTO", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#94a3b8",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 112, W - 96, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#f1f5f9",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 224, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#e2e8f0",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 296, W - 96, 32, "{{prizeLabel}}", {
          fontSize: 14,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#cbd5e1",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 344, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "sourceSerif4",
          color: "#94a3b8",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 392, W - 96, 36, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#64748b",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 696, 420, 88, "#64748b"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-ember-award",
    name: "Ámbar — galardón",
    description: "Rojo vino oscuro con brillo ámbar; placa central y énfasis en el premio del jurado.",
    styleTags: ["decorativo", "oscuro", "premio", "fotografia", "reconocimiento"],
    accentColor: "#fbbf24",
    backgroundColor: "#1c0a0a",
    keywords: ["jurado", "premio", "fotografía", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Premio del jurado, mención especial en salón fotográfico",
    paletteHint: "Burdeos oscuro, ámbar",
    formalityLevel: "alto",
    layout: (() => {
      const p = "mdem";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-glow`, 0, 88, W, 3, { fillColor: "#f59e0b", opacity: 0.5 }),
        ...medalPlaque(p, W / 2, 176, 56, "#fbbf24", "#292524"),
        txt(`${p}-k`, 48, 96, W - 96, 22, "PREMIO DEL JURADO", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#fbbf24",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 248, W - 96, 40, "{{contestTitle}}", {
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "cormorantGaramond",
          color: "#fecaca",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 300, W - 96, 36, "{{prizeLabel}}", {
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "cinzel",
          color: "#fcd34d",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 352, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#fff7ed",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 420, W - 96, 28, "Serie u obra: {{entryTitle}}", {
          fontSize: 12,
          fontFamily: "lora",
          color: "#fca5a5",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 464, W - 96, 32, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#b91c1c",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#a8a29e"),
      ];
      return layout(blocks);
    })(),
  },
  /* —— Editorial creativo —— */
  {
    id: "pub-md-offset-grid",
    name: "Rejilla — desplazada",
    description: "Título y nombre en columnas desfasadas; piezas tipo cartel de concurso de arte.",
    styleTags: ["decorativo", "editorial", "artistico", "creativo", "fotografia"],
    accentColor: "#ea580c",
    backgroundColor: "#fafaf9",
    keywords: ["editorial", "concurso", "arte", "fotografía", "decorativo"],
    family: "modern-decorative",
    recommendedUse: "Concursos de fotografía, bienales, exposiciones seleccionadas",
    paletteHint: "Neutro, naranja quemado",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdog";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-blk`, 48, 48, 320, 14, { fillColor: "#ea580c", opacity: 0.85 }),
        txt(`${p}-k`, 56, 48, 300, 14, "OBRA SELECCIONADA", {
          fontSize: 9,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#ffffff",
          textAlign: "left",
        }),
        txt(`${p}-ct`, 48, 100, 420, 80, "{{contestTitle}}", {
          fontSize: 26,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#1c1917",
          textAlign: "left",
        }),
        txt(`${p}-e`, 48, 200, 520, 72, "{{entryTitle}}", {
          fontSize: 20,
          fontWeight: "bold",
          fontFamily: "cormorantGaramond",
          color: "#9a3412",
          textAlign: "left",
        }),
        txt(`${p}-lab`, 520, 100, 280, 22, "AUTOR / AUTORA", {
          fontSize: 9,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "right",
        }),
        txt(`${p}-r`, 400, 128, 390, 60, "{{recipientName}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#292524",
          textAlign: "right",
        }),
        txt(`${p}-pr`, 400, 220, 390, 32, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#ea580c",
          textAlign: "right",
        }),
        txt(`${p}-m`, 48, 320, 742, 48, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#57534e",
          textAlign: "left",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#57534e", "right"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-magazine-spread",
    name: "Revista — doble página",
    description: "Tipografía grande para el nombre y rótulo pequeño; sensación editorial de moda o foto.",
    styleTags: ["decorativo", "editorial", "fotografia", "minimal", "creativo"],
    accentColor: "#18181b",
    backgroundColor: "#ffffff",
    keywords: ["editorial", "revista", "fotografía", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Autor destacado, portfolios, premios con nombre protagonista",
    paletteHint: "Blanco, negro",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdmg";
      const blocks: DiplomaLayoutBlock[] = [
        line(`${p}-v`, 400, 48, 2, 420, "#e4e4e7", 2),
        txt(`${p}-k`, 48, 56, 320, 24, "{{contestTitle}}", {
          fontSize: 11,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#71717a",
          textAlign: "left",
        }),
        txt(`${p}-r`, 48, 120, 320, 100, "{{recipientName}}", {
          fontSize: 36,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#09090b",
          textAlign: "left",
        }),
        txt(`${p}-pr`, 48, 248, 320, 32, "{{prizeLabel}}", {
          fontSize: 13,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#18181b",
          textAlign: "left",
        }),
        txt(`${p}-e`, 420, 120, 374, 100, "{{entryTitle}}", {
          fontSize: 16,
          fontFamily: "lora",
          color: "#3f3f46",
          textAlign: "left",
        }),
        txt(`${p}-m`, 420, 260, 374, 48, "{{categoryName}}\n{{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#71717a",
          textAlign: "left",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#71717a", "left"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-salon-frame",
    name: "Salón — marco abierto",
    description: "Énfasis en categoría y título de obra; pensado para salones y menciones fotográficas.",
    styleTags: ["decorativo", "fotografia", "premio", "reconocimiento", "editorial"],
    accentColor: "#0d9488",
    backgroundColor: "#fafafa",
    keywords: ["salón", "fotografía", "obra", "mención", "decorativo"],
    family: "modern-decorative",
    recommendedUse: "Participación en salón, obra seleccionada, categoría",
    paletteHint: "Gris claro, verde azulado",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdsf";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-tag`, 48, 52, 200, 36, { fillColor: "#0d9488", layerName: "Etiqueta" }),
        txt(`${p}-tg`, 52, 60, 192, 22, "{{categoryName}}", {
          fontSize: 11,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#ffffff",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 120, W - 96, 56, "{{entryTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "cormorantGaramond",
          color: "#134e4a",
          textAlign: "center",
        }),
        txt(`${p}-k2`, 48, 192, W - 96, 24, "{{contestTitle}}", {
          fontSize: 12,
          fontFamily: "inter",
          color: "#57534e",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 240, W - 96, 52, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#1c1917",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 312, W - 96, 32, "{{prizeLabel}}", {
          fontSize: 13,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#0f766e",
          textAlign: "center",
        }),
        txt(`${p}-o`, 48, 364, W - 96, 28, "{{organizerName}}", {
          fontSize: 10,
          fontFamily: "merriweather",
          color: "#57534e",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 702, 420, 88, "#57534e"),
      ];
      return layout(blocks);
    })(),
  },
  /* —— Geométrico / abstracto —— */
  {
    id: "pub-md-geo-stride",
    name: "Geo — zancada",
    description: "Bloques escalonados en tonos anaranjados; dinamismo sin recargar.",
    styleTags: ["decorativo", "geometrico", "colorido", "creativo", "moderno"],
    accentColor: "#ea580c",
    backgroundColor: "#fffbeb",
    keywords: ["geométrico", "bloques", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Eventos creativos, premios jóvenes, menciones energéticas",
    paletteHint: "Crema, naranja, ámbar",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdgs";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-b1`, 0, 100, 260, 22, { fillColor: "#fed7aa", opacity: 0.95 }),
        rect(`${p}-b2`, 100, 140, 280, 22, { fillColor: "#fdba74", opacity: 0.9 }),
        rect(`${p}-b3`, 200, 180, 300, 22, { fillColor: "#fb923c", opacity: 0.75 }),
        rect(`${p}-b4`, 320, 220, 320, 22, { fillColor: "#ea580c", opacity: 0.45 }),
        txt(`${p}-ct`, 48, 56, W - 96, 40, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#7c2d12",
          textAlign: "left",
        }),
        txt(`${p}-r`, 48, 268, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#431407",
          textAlign: "left",
        }),
        txt(`${p}-e`, 48, 340, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "inter",
          color: "#9a3412",
          textAlign: "left",
        }),
        txt(`${p}-pr`, 48, 384, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#c2410c",
          textAlign: "left",
        }),
        txt(`${p}-m`, 48, 432, W - 96, 36, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "left",
        }),
        ...mdFooter(p, 520, 698, 420, 88, "#78716c", "left"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-geo-mosaic",
    name: "Geo — mosaico",
    description: "Cuadrícula abstracta discreta en la cabecera; orden y diseño contemporáneo.",
    styleTags: ["decorativo", "geometrico", "minimal", "moderno", "corporativo"],
    accentColor: "#2563eb",
    backgroundColor: "#f8fafc",
    keywords: ["geométrico", "mosaico", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Instituciones modernas, congresos tech, certificados corporativos creativos",
    paletteHint: "Gris azulado, azul",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdgm";
      const cells: DiplomaLayoutBlock[] = [];
      let i = 0;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          const on = (row + col) % 3 === 0;
          cells.push(
            rect(`${p}-c${i++}`, 48 + col * 94, 40 + row * 18, 86, 14, {
              fillColor: on ? "#2563eb" : "#e2e8f0",
              opacity: on ? 0.35 : 0.5,
            })
          );
        }
      }
      const blocks: DiplomaLayoutBlock[] = [
        ...cells,
        txt(`${p}-ct`, 48, 120, W - 96, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#0f172a",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 192, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#020617",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 268, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "sourceSerif4",
          color: "#475569",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 312, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#2563eb",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 360, W - 96, 36, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#64748b",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 702, 420, 88, "#64748b"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-geo-wedge",
    name: "Geo — cuña",
    description: "Triángulos de color en esquinas (rectángulos superpuestos); composición limpia y actual.",
    styleTags: ["decorativo", "geometrico", "creativo", "moderno"],
    accentColor: "#db2777",
    backgroundColor: "#fdf2f8",
    keywords: ["geométrico", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Certificados con personalidad, sin marco clásico",
    paletteHint: "Rosa suave, magenta",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdgw";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-w1`, 0, 0, 280, 200, { fillColor: "#fbcfe8", opacity: 0.45 }),
        rect(`${p}-w2`, W - 240, H - 200, 240, 200, { fillColor: "#f9a8d4", opacity: 0.35 }),
        line(`${p}-diag`, 0, 200, 200, 2, "#db2777", 2),
        txt(`${p}-ct`, 48, 220, W - 96, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#831843",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 288, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#500724",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 360, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "lora",
          color: "#9d174d",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 404, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#db2777",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 448, W - 96, 36, "{{organizerName}} · {{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#9d174d",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 698, 420, 88, "#9d174d"),
      ];
      return layout(blocks);
    })(),
  },
  /* —— Soft / orgánico —— */
  {
    id: "pub-md-soft-peach",
    name: "Suave — melocotón",
    description: "Pastel melocotón con blobs rectangulares suaves; amigable para talleres humanos.",
    styleTags: ["decorativo", "soft", "participacion", "workshop", "beige"],
    accentColor: "#f97316",
    backgroundColor: "#fff7ed",
    keywords: ["pastel", "suave", "workshop", "participación", "decorativo"],
    family: "modern-decorative",
    recommendedUse: "Participación, bienestar creativo, grupos reducidos",
    paletteHint: "Melocotón, crema",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdpe";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-b1`, 420, 60, 200, 140, { fillColor: "#fdba74", opacity: 0.22 }),
        rect(`${p}-b2`, 80, 320, 240, 100, { fillColor: "#fb923c", opacity: 0.15 }),
        txt(`${p}-k`, 48, 72, W - 96, 24, "CERTIFICADO DE PARTICIPACIÓN", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#c2410c",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 112, W - 96, 44, "{{contestTitle}}", {
          fontSize: 21,
          fontWeight: "bold",
          fontFamily: "lora",
          color: "#7c2d12",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 184, W - 96, 52, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#431407",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 256, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "merriweather",
          color: "#9a3412",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 300, W - 96, 26, "{{prizeLabel}}", {
          fontSize: 11,
          fontFamily: "inter",
          color: "#ea580c",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 344, W - 96, 36, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 702, 420, 88, "#78716c"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-soft-sage",
    name: "Suave — salvia",
    description: "Verde menta muy suave; constancia de asistencia con calma visual.",
    styleTags: ["decorativo", "soft", "participacion", "minimal", "reconocimiento"],
    accentColor: "#16a34a",
    backgroundColor: "#f7fee7",
    keywords: ["pastel", "verde", "constancia", "decorativo"],
    family: "modern-decorative",
    recommendedUse: "Talleres al aire libre, fotografía natural, grupos inclusivos",
    paletteHint: "Lima suave, verde",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdsg";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-blob`, 0, H - 180, W, 180, { fillColor: "#bbf7d0", opacity: 0.35 }),
        txt(`${p}-k`, 48, 64, W - 96, 24, "CONSTANCIA DE ASISTENCIA", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#166534",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 108, W - 96, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "sourceSerif4",
          color: "#14532d",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 180, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#052e16",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 252, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "lora",
          color: "#15803d",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 296, W - 96, 26, "{{prizeLabel}}", {
          fontSize: 11,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#16a34a",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 340, W - 96, 36, "{{organizerName}} · {{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#365314",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 702, 420, 88, "#365314"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-soft-lavender",
    name: "Suave — lavanda",
    description: "Lila muy tenue y serif fina; workshops íntimos y masterclasses.",
    styleTags: ["decorativo", "soft", "workshop", "creativo", "reconocimiento"],
    accentColor: "#7c3aed",
    backgroundColor: "#faf5ff",
    keywords: ["lavanda", "masterclass", "workshop", "decorativo"],
    family: "modern-decorative",
    recommendedUse: "Masterclass de retrato, edición, iluminación",
    paletteHint: "Lila pálido, violeta",
    formalityLevel: "bajo",
    layout: (() => {
      const p = "mdlv";
      const blocks: DiplomaLayoutBlock[] = [
        ...ribbonBehind(p, 168, 36, "#a78bfa", 0.2),
        txt(`${p}-k`, 48, 96, W - 96, 24, "WORKSHOP CERTIFICADO", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#6d28d9",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 136, W - 96, 44, "{{contestTitle}}", {
          fontSize: 21,
          fontWeight: "bold",
          fontFamily: "cormorantGaramond",
          color: "#4c1d95",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 204, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "playfairDisplay",
          color: "#3b0764",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 276, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "lora",
          color: "#6d28d9",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 320, W - 96, 26, "{{prizeLabel}}", {
          fontSize: 11,
          fontFamily: "inter",
          color: "#7c3aed",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 364, W - 96, 36, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#7e22ce",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 698, 420, 88, "#6d28d9"),
      ];
      return layout(blocks);
    })(),
  },
  /* —— Fotografía / foco extra —— */
  {
    id: "pub-md-lens-ribbon",
    name: "Óptica — cinta",
    description: "Franja tipo obturador y rótulo ‘festival’; pensado para certámenes y festivales fotográficos.",
    styleTags: ["decorativo", "fotografia", "premio", "creativo", "horizontal"],
    accentColor: "#facc15",
    backgroundColor: "#18181b",
    keywords: ["festival", "fotografía", "obturador", "decorativo", "horizontal"],
    family: "modern-decorative",
    recommendedUse: "Festival fotográfico, jornada documental, expo itinerante",
    paletteHint: "Negro, amarillo ámbar",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mdlr";
      const strips: DiplomaLayoutBlock[] = [];
      for (let i = 0; i < 6; i++) {
        strips.push(rect(`${p}-s${i}`, 48 + i * 125, 52, 115, 24, { fillColor: "#27272a" }));
        strips.push(rect(`${p}-t${i}`, 56 + i * 125, 56, 99, 16, { fillColor: "#facc15", opacity: 0.85 }));
      }
      const blocks: DiplomaLayoutBlock[] = [
        ...strips,
        txt(`${p}-k`, 48, 112, W - 96, 24, "FESTIVAL / CERTAMEN FOTOGRÁFICO", {
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#a1a1aa",
          textAlign: "center",
        }),
        txt(`${p}-ct`, 48, 152, W - 96, 44, "{{contestTitle}}", {
          fontSize: 22,
          fontWeight: "bold",
          fontFamily: "outfit",
          color: "#fafafa",
          textAlign: "center",
        }),
        txt(`${p}-r`, 48, 224, W - 96, 52, "{{recipientName}}", {
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "dmSans",
          color: "#fef08a",
          textAlign: "center",
        }),
        txt(`${p}-e`, 48, 296, W - 96, 28, "{{entryTitle}}", {
          fontSize: 12,
          fontFamily: "sourceSerif4",
          color: "#d4d4d8",
          textAlign: "center",
        }),
        txt(`${p}-pr`, 48, 340, W - 96, 28, "{{prizeLabel}}", {
          fontSize: 13,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#facc15",
          textAlign: "center",
        }),
        txt(`${p}-m`, 48, 388, W - 96, 36, "{{categoryName}} · {{organizerName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#71717a",
          textAlign: "center",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#a1a1aa"),
      ];
      return layout(blocks);
    })(),
  },
  {
    id: "pub-md-doc-journey",
    name: "Documental — travesía",
    description: "Tipografía de viaje y bloque de color tierra; jornadas de fotografía documental.",
    styleTags: ["decorativo", "fotografia", "editorial", "reconocimiento", "institucional"],
    accentColor: "#92400e",
    backgroundColor: "#fef3c7",
    keywords: ["documental", "reportaje", "jornada", "fotografía", "decorativo"],
    family: "modern-decorative",
    recommendedUse: "Jornadas de fotografía documental, encuentros narrativos",
    paletteHint: "Arena, marrón tierra",
    formalityLevel: "medio",
    layout: (() => {
      const p = "mddj";
      const blocks: DiplomaLayoutBlock[] = [
        rect(`${p}-side`, 0, 0, 52, H, { fillColor: "#92400e", opacity: 0.9 }),
        txt(`${p}-v`, 8, 200, 36, 200, "FOTO · DOC", {
          fontSize: 9,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#fef3c7",
          textAlign: "center",
        }),
        txt(`${p}-k`, 88, 64, W - 140, 28, "JORNADA DE FOTOGRAFÍA DOCUMENTAL", {
          fontSize: 11,
          fontWeight: "bold",
          fontFamily: "inter",
          color: "#78350f",
          textAlign: "left",
        }),
        txt(`${p}-ct`, 88, 108, W - 140, 48, "{{contestTitle}}", {
          fontSize: 24,
          fontWeight: "bold",
          fontFamily: "libreBaskerville",
          color: "#422006",
          textAlign: "left",
        }),
        txt(`${p}-r`, 88, 188, W - 140, 52, "{{recipientName}}", {
          fontSize: 26,
          fontWeight: "bold",
          fontFamily: "merriweather",
          color: "#431407",
          textAlign: "left",
        }),
        txt(`${p}-e`, 88, 264, W - 140, 36, "Proyecto / serie: {{entryTitle}}", {
          fontSize: 13,
          fontFamily: "lora",
          color: "#92400e",
          textAlign: "left",
        }),
        txt(`${p}-pr`, 88, 320, W - 140, 28, "{{prizeLabel}}", {
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "cinzel",
          color: "#b45309",
          textAlign: "left",
        }),
        txt(`${p}-m`, 88, 372, W - 140, 40, "{{organizerName}}\n{{categoryName}}", {
          fontSize: 10,
          fontFamily: "inter",
          color: "#78716c",
          textAlign: "left",
        }),
        ...mdFooter(p, 520, 688, 420, 88, "#57534e", "left"),
      ];
      return layout(blocks);
    })(),
  },
];
