import { resolvePreviewFontFamily } from "./font-resolver";
import {
  escapeCssUrl,
  sanitizeCssColor,
} from "./html-escape";

export function buildPreviewDocumentCss(args: {
  width: number;
  height: number;
}): string {
  const { width, height } = args;
  return `
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
}
* { box-sizing: border-box; }
#stage {
  position: relative;
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
  background: #ffffff;
}
.block {
  position: absolute;
  overflow: hidden;
  transform-origin: center center;
}
.block-text {
  white-space: pre-wrap;
  word-break: break-word;
  display: flex;
  align-items: flex-start;
}
.block-img, .block-bg-img {
  width: 100%;
  height: 100%;
  display: block;
}
.block-shape {
  width: 100%;
  height: 100%;
}
`.trim();
}

export function layoutStyle(layout: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
}): string {
  const rot = layout.rotation ?? 0;
  const opacity = layout.opacity ?? 1;
  const z = layout.zIndex ?? 0;
  return [
    `left:${layout.x}px`,
    `top:${layout.y}px`,
    `width:${layout.width}px`,
    `height:${layout.height}px`,
    `opacity:${opacity}`,
    `z-index:${z}`,
    rot ? `transform:rotate(${rot}deg)` : "",
  ]
    .filter(Boolean)
    .join(";");
}

export function typographyStyle(config: Record<string, unknown>): string {
  const font = resolvePreviewFontFamily(config.fontFamily);
  const size = Number(config.fontSize) || 20;
  const weight = Number(config.fontWeight) || 400;
  const lh = Number(config.lineHeight) || 1.2;
  const ls = Number(config.letterSpacing) || 0;
  const alignRaw = String(config.textAlign ?? "CENTER").toLowerCase();
  const align =
    alignRaw === "left" || alignRaw === "right" || alignRaw === "center"
      ? alignRaw
      : "center";
  const color = sanitizeCssColor(config.color, "#111111");
  const italic = config.fontItalic === true ? "italic" : "normal";
  const underline = config.underline === true ? "underline" : "none";
  const justify =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  return [
    `font-family:${font.cssFamily}`,
    `font-size:${size}px`,
    `font-weight:${weight}`,
    `line-height:${lh}`,
    `letter-spacing:${ls}px`,
    `color:${color}`,
    `font-style:${italic}`,
    `text-decoration:${underline}`,
    `text-align:${align}`,
    `justify-content:${justify}`,
  ].join(";");
}

export function objectFitStyle(fit: unknown): string {
  const f = fit === "contain" ? "contain" : "cover";
  return `object-fit:${f};object-position:center;`;
}

export function imageMaskStyle(mask: unknown, radius: unknown): string {
  const r = Number(radius) || 0;
  if (mask === "circle" || mask === "ellipse") {
    return `border-radius:50%;`;
  }
  return r > 0 ? `border-radius:${r}px;` : "";
}

export function backgroundImageStyle(src: string, fit: unknown): string {
  const f = fit === "contain" ? "contain" : "cover";
  return `background-image:url("${escapeCssUrl(src)}");background-size:${f};background-position:center;background-repeat:no-repeat;`;
}
