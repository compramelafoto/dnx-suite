/**
 * Esquema de plantilla estructurada: mismo JSON alimenta preview (HTML) y export PDF/PNG.
 * Origen visual: coordenadas en puntos PDF (1/72"), con Y desde el borde superior de la página.
 */

export type DiplomaTextAlign = "left" | "center" | "right";

export type DiplomaLayoutTextBlock = {
  id: string;
  type: "text";
  /** Desde borde izquierdo, pt */
  x: number;
  /** Desde borde superior, pt */
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fontSize: number;
  fontWeight?: "normal" | "bold";
  color: string;
  textAlign?: DiplomaTextAlign;
  /** Placeholders: {{recipientName}}, {{contestTitle}}, {{organizerName}}, {{categoryName}}, {{prizeLabel}}, {{diplomaCode}}, {{issuedDate}}, {{verificationUrl}} */
  content: string;
};

export type DiplomaLayoutQrBlock = {
  id: string;
  type: "qrcode";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
};

export type DiplomaLayoutBlock = DiplomaLayoutTextBlock | DiplomaLayoutQrBlock;

export type DiplomaLayoutJson = {
  version: number;
  blocks: DiplomaLayoutBlock[];
};

export function defaultDiplomaLayoutJson(): DiplomaLayoutJson {
  return {
    version: 1,
    blocks: [
      {
        id: "title",
        type: "text",
        x: 56,
        y: 72,
        width: 730,
        height: 48,
        fontSize: 26,
        fontWeight: "bold",
        color: "#d4af37",
        textAlign: "center",
        content: "{{contestTitle}}",
      },
      {
        id: "recipient",
        type: "text",
        x: 56,
        y: 200,
        width: 730,
        height: 40,
        fontSize: 22,
        fontWeight: "bold",
        color: "#fafafa",
        textAlign: "center",
        content: "{{recipientName}}",
      },
      {
        id: "organizer",
        type: "text",
        x: 56,
        y: 280,
        width: 730,
        height: 28,
        fontSize: 12,
        color: "#a1a1a1",
        textAlign: "center",
        content: "{{organizerName}}",
      },
      {
        id: "category",
        type: "text",
        x: 56,
        y: 320,
        width: 730,
        height: 24,
        fontSize: 11,
        color: "#a1a1a1",
        textAlign: "center",
        content: "{{categoryName}}",
      },
      {
        id: "prize",
        type: "text",
        x: 56,
        y: 352,
        width: 730,
        height: 24,
        fontSize: 11,
        color: "#d4af37",
        textAlign: "center",
        content: "{{prizeLabel}}",
      },
      {
        id: "code",
        type: "text",
        x: 56,
        y: 420,
        width: 730,
        height: 20,
        fontSize: 10,
        color: "#666666",
        textAlign: "center",
        content: "Código: {{diplomaCode}} · {{issuedDate}}",
      },
      {
        id: "qr",
        type: "qrcode",
        x: 702,
        y: 455,
        width: 96,
        height: 96,
      },
    ],
  };
}

export function parseDiplomaLayoutJson(raw: unknown): DiplomaLayoutJson {
  if (!raw || typeof raw !== "object") return defaultDiplomaLayoutJson();
  const v = raw as Record<string, unknown>;
  const blocksRaw = v.blocks;
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) return defaultDiplomaLayoutJson();
  const blocks: DiplomaLayoutBlock[] = [];
  for (const b of blocksRaw) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : `b-${blocks.length}`;
    const type = o.type === "qrcode" ? "qrcode" : o.type === "text" ? "text" : null;
    if (!type) continue;
    const x = Number(o.x);
    const y = Number(o.y);
    const width = Number(o.width);
    const height = Number(o.height);
    if (![x, y, width, height].every((n) => Number.isFinite(n))) continue;
    if (type === "qrcode") {
      blocks.push({
        id,
        type: "qrcode",
        x,
        y,
        width,
        height,
        rotation: Number.isFinite(Number(o.rotation)) ? Number(o.rotation) : undefined,
        opacity: Number.isFinite(Number(o.opacity)) ? Number(o.opacity) : undefined,
      });
      continue;
    }
    const fontSize = Number(o.fontSize);
    const content = typeof o.content === "string" ? o.content : "";
    if (!Number.isFinite(fontSize) || fontSize < 6) continue;
    const color = typeof o.color === "string" && o.color.startsWith("#") ? o.color : "#fafafa";
    const textAlign =
      o.textAlign === "center" || o.textAlign === "right" || o.textAlign === "left"
        ? o.textAlign
        : "left";
    const fontWeight = o.fontWeight === "bold" ? "bold" : "normal";
    blocks.push({
      id,
      type: "text",
      x,
      y,
      width,
      height,
      fontSize,
      fontWeight,
      color,
      textAlign,
      content,
      rotation: Number.isFinite(Number(o.rotation)) ? Number(o.rotation) : undefined,
      opacity: Number.isFinite(Number(o.opacity)) ? Number(o.opacity) : undefined,
    });
  }
  if (blocks.length === 0) return defaultDiplomaLayoutJson();
  return { version: typeof v.version === "number" ? v.version : 1, blocks };
}
