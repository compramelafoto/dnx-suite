export type TemplateV2BlockType =
  | "BACKGROUND"
  | "PHOTO"
  | "TEXT"
  | "VARIABLE_TEXT"
  | "IMAGE"
  | "SHAPE"
  | "QR";

export type TemplateV2Canvas = {
  width: number;
  height: number;
  background?: string;
  dpi?: number;
  bleedMm?: number;
  safeAreaMm?: number;
};

export type TemplateV2BlockLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity?: number;
  locked?: boolean;
  visible: boolean;
};

export type TemplateV2Block = {
  id: string;
  type: TemplateV2BlockType;
  /** Hoja dentro de la versión (0 = primera). */
  pageIndex?: number;
  name?: string | null;
  layout: TemplateV2BlockLayout;
  configJson: Record<string, unknown>;
};

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function normalizeBlockConfig(type: TemplateV2BlockType, input: unknown): Record<string, unknown> {
  const cfg = asObject(input);
  if (type === "TEXT") {
    const contentObj = asObject(cfg.content);
    const typography = asObject(cfg.typography);
    return {
      content:
        typeof contentObj.value === "string"
          ? contentObj.value
          : typeof cfg.content === "string"
            ? cfg.content
            : "",
      fontFamily:
        typeof cfg.fontFamily === "string"
          ? cfg.fontFamily
          : typeof typography.fontFamily === "string"
            ? typography.fontFamily
            : "Helvetica",
      fontSize:
        typeof cfg.fontSize === "number"
          ? cfg.fontSize
          : typeof typography.fontSize === "number"
            ? typography.fontSize
            : 20,
      fontWeight:
        typeof cfg.fontWeight === "number"
          ? cfg.fontWeight
          : typeof typography.fontWeight === "number"
            ? typography.fontWeight
            : 400,
      lineHeight:
        typeof cfg.lineHeight === "number"
          ? cfg.lineHeight
          : typeof typography.lineHeight === "number"
            ? typography.lineHeight
            : 1.2,
      letterSpacing:
        typeof cfg.letterSpacing === "number"
          ? cfg.letterSpacing
          : typeof typography.letterSpacing === "number"
            ? typography.letterSpacing
            : 0,
      textAlign:
        typeof cfg.textAlign === "string"
          ? cfg.textAlign
          : typeof cfg.align === "string"
            ? cfg.align
            : "CENTER",
      color: typeof cfg.color === "string" ? cfg.color : "#111111",
      fontItalic: cfg.fontItalic === true,
      underline: cfg.underline === true,
      textTransform:
        cfg.textTransform === "uppercase" ||
        cfg.textTransform === "lowercase" ||
        cfg.textTransform === "capitalize"
          ? cfg.textTransform
          : "none",
    };
  }

  if (type === "VARIABLE_TEXT") {
    return {
      variableKey: typeof cfg.variableKey === "string" ? cfg.variableKey : "",
      fallback:
        typeof cfg.fallback === "string"
          ? cfg.fallback
          : typeof cfg.content === "string"
            ? cfg.content
            : "",
      fontFamily: typeof cfg.fontFamily === "string" ? cfg.fontFamily : "Helvetica",
      fontSize: typeof cfg.fontSize === "number" ? cfg.fontSize : 20,
      fontWeight: typeof cfg.fontWeight === "number" ? cfg.fontWeight : 400,
      lineHeight: typeof cfg.lineHeight === "number" ? cfg.lineHeight : 1.2,
      letterSpacing: typeof cfg.letterSpacing === "number" ? cfg.letterSpacing : 0,
      textAlign: typeof cfg.textAlign === "string" ? cfg.textAlign : "CENTER",
      color: typeof cfg.color === "string" ? cfg.color : "#111111",
      fontItalic: cfg.fontItalic === true,
      underline: cfg.underline === true,
      textTransform:
        cfg.textTransform === "uppercase" ||
        cfg.textTransform === "lowercase" ||
        cfg.textTransform === "capitalize"
          ? cfg.textTransform
          : "none",
    };
  }

  if (type === "IMAGE") {
    const source = asObject(cfg.source);
    const pm = typeof cfg.photoMode === "string" ? cfg.photoMode : "free";
    const photoMode = pm === "single" || pm === "group" || pm === "free" ? pm : "free";
    const ms = typeof cfg.maskShape === "string" ? cfg.maskShape : "rect";
    const maskShape = ms === "rect" || ms === "circle" || ms === "ellipse" ? ms : "rect";
    return {
      src:
        typeof cfg.src === "string"
          ? cfg.src
          : typeof source.src === "string"
            ? source.src
            : typeof source.url === "string"
              ? source.url
              : "",
      fit: "cover",
      borderRadius: typeof cfg.borderRadius === "number" ? cfg.borderRadius : 0,
      photoMode,
      maskShape,
      source,
    };
  }

  if (type === "SHAPE") {
    const vr = typeof cfg.variant === "string" ? cfg.variant : "rectangle";
    const variant =
      vr === "rectangle" || vr === "circle" || vr === "ellipse" ? vr : "rectangle";
    return {
      variant,
      fill: typeof cfg.fill === "string" ? cfg.fill : "#e5e7eb",
      stroke: typeof cfg.stroke === "string" ? cfg.stroke : "#94a3b8",
      strokeWidth: typeof cfg.strokeWidth === "number" ? cfg.strokeWidth : 0,
      radius: typeof cfg.radius === "number" ? cfg.radius : 0,
    };
  }

  if (type === "QR") {
    /*
     * El QR codifica una de dos cosas, y quien diseña elige cuál:
     *
     * - `VARIABLE`: el valor sale de un dato del destinatario y cambia con cada pieza. Es el
     *   caso del carnet, donde cada socio lleva su propia URL de verificación.
     * - `FIXED`: una dirección escrita a mano, igual para todos. Sirve para mandar al sitio de
     *   la institución, a un formulario o a donde el owner quiera.
     *
     * `errorCorrection` en M y una zona quieta de 4 módulos son los valores que ya usa el
     * carnet: menos margen y el lector falla contra un fondo claro.
     */
    const modoCrudo = typeof cfg.mode === "string" ? cfg.mode : "VARIABLE";
    const mode = modoCrudo === "FIXED" ? "FIXED" : "VARIABLE";
    const ec = typeof cfg.errorCorrection === "string" ? cfg.errorCorrection : "M";
    return {
      mode,
      /** Solo se usa con `mode: "FIXED"`. */
      value: typeof cfg.value === "string" ? cfg.value : "",
      variableKey: typeof cfg.variableKey === "string" ? cfg.variableKey : "",
      errorCorrection: ["L", "M", "Q", "H"].includes(ec) ? ec : "M",
      quietZoneModules:
        typeof cfg.quietZoneModules === "number" ? cfg.quietZoneModules : 4,
      foreground: typeof cfg.foreground === "string" ? cfg.foreground : "#000000",
      background: typeof cfg.background === "string" ? cfg.background : "#ffffff",
    };
  }

  if (type === "BACKGROUND") {
    return {
      backgroundColor: typeof cfg.backgroundColor === "string" ? cfg.backgroundColor : "#ffffff",
      src: typeof cfg.src === "string" ? cfg.src : "",
      fit: "cover",
    };
  }

  return cfg;
}

export function getResolvedVariableText(
  cfg: Record<string, unknown>,
  resolvedVariables?: Record<string, unknown>
): string {
  const variableKey = typeof cfg.variableKey === "string" ? cfg.variableKey : "";
  const fallback = typeof cfg.fallback === "string" ? cfg.fallback : "";
  if (!variableKey) return fallback || "{{variable}}";
  const dynamicRaw = resolvedVariables?.[variableKey];
  if (dynamicRaw !== undefined && dynamicRaw !== null && String(dynamicRaw).trim() !== "") {
    return String(dynamicRaw);
  }
  return fallback || `{{${variableKey}}}`;
}

/** Construye valor CSS font-family; si ya hay comas, se respeta el stack guardado. */
export function formatFontFamilyCss(nameOrStack: string): string {
  const t = nameOrStack.trim();
  if (!t) return "sans-serif";
  if (t.includes(",")) return t;
  const safe = t.replace(/\\/g, "").replace(/"/g, '\\"');
  return `"${safe}", sans-serif`;
}

export function getTextVisualConfig(cfg: Record<string, unknown>) {
  const textAlignRaw = String(cfg.textAlign ?? "CENTER").toLowerCase();
  const textAlign = textAlignRaw === "left" || textAlignRaw === "right" ? textAlignRaw : "center";
  const fontItalic = cfg.fontItalic === true;
  const underline = cfg.underline === true;
  return {
    content: String(cfg.content ?? ""),
    color: String(cfg.color ?? "#111111"),
    fontFamily: String(cfg.fontFamily ?? "Helvetica"),
    fontFamilyCss: formatFontFamilyCss(String(cfg.fontFamily ?? "Helvetica")),
    fontSize: Number(cfg.fontSize ?? 20),
    fontWeight: Number(cfg.fontWeight ?? 400),
    fontStyle: fontItalic ? ("italic" as const) : ("normal" as const),
    textDecoration: underline ? ("underline" as const) : ("none" as const),
    lineHeight: Number(cfg.lineHeight ?? 1.2),
    letterSpacing: Number(cfg.letterSpacing ?? 0),
    textAlign: textAlign as "left" | "center" | "right",
    /*
     * El navegador convierte con `text-transform`, y el módulo de impresión convierte el texto
     * ya resuelto. Los dos llegan al mismo resultado, así que el lienzo muestra lo que se va a
     * imprimir.
     */
    textTransform:
      cfg.textTransform === "uppercase" ||
      cfg.textTransform === "lowercase" ||
      cfg.textTransform === "capitalize"
        ? (cfg.textTransform as "uppercase" | "lowercase" | "capitalize")
        : ("none" as const),
  };
}

export function toRenderableBlocks(blocks: TemplateV2Block[]): TemplateV2Block[] {
  return blocks
    .filter((b) => b.layout.visible)
    .sort((a, b) => a.layout.zIndex - b.layout.zIndex)
    .map((b) => ({
      ...b,
      configJson: normalizeBlockConfig(b.type, b.configJson),
    }));
}
