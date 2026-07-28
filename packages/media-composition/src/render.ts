import { createHash } from "node:crypto";
import sharp from "sharp";
import { extractSquareCrop, resolveCropParams } from "./crop";
import { escapeXml, interpolateTemplate } from "./variables";
import {
  RENDERER_VERSION,
  type CompositionTemplate,
  type RenderOutput,
  type RenderRequest,
} from "./types";

function formatCityProvince(variables: RenderRequest["variables"]): string {
  const city = String(variables.city ?? "").trim();
  const province = String(variables.province ?? "").trim();
  if (city && province) return `${city}, ${province}`;
  return city || province || "";
}

async function preparePhoto(
  photo: Buffer | null | undefined,
  crop: RenderRequest["crop"],
  size: number,
): Promise<Buffer | null> {
  if (!photo) return null;
  const params = await resolveCropParams(photo, crop);
  return extractSquareCrop(photo, params, size);
}

async function circleMask(size: number): Promise<Buffer> {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>
  </svg>`;
  return Buffer.from(svg);
}

async function prepareLogo(
  logo: Buffer | null | undefined,
  width: number,
  height: number,
): Promise<Buffer | null> {
  if (!logo) return null;
  return sharp(logo)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function buildTextSvg(template: CompositionTemplate, variables: RenderRequest["variables"]): string {
  const vars = {
    ...variables,
    city:
      variables.city != null || variables.province != null
        ? formatCityProvince(variables)
        : variables.city,
    province: "",
  };

  const parts: string[] = [
    `<svg width="${template.width}" height="${template.height}" xmlns="http://www.w3.org/2000/svg">`,
  ];

  for (const block of template.blocks) {
    if (block.type === "rect") {
      const opacity = block.opacity ?? 1;
      parts.push(
        `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="${escapeXml(block.fill)}" opacity="${opacity}"/>`,
      );
      continue;
    }
    if (block.type !== "text") continue;
    const raw = interpolateTemplate(block.content, vars).trim();
    if (!raw) continue;
    const anchor =
      block.align === "left" ? "start" : block.align === "right" ? "end" : "middle";
    const x =
      block.align === "left"
        ? block.x
        : block.align === "right"
          ? block.x + block.width
          : block.x + block.width / 2;
    const weight = block.fontWeight === "bold" ? "700" : "400";
    const lines = raw.split("\n").slice(0, block.maxLines ?? 3);
    lines.forEach((line, i) => {
      const y = block.y + i * (block.fontSize * 1.25);
      parts.push(
        `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${block.fontSize}" font-weight="${weight}" fill="${escapeXml(block.color)}">${escapeXml(line)}</text>`,
      );
    });
  }

  parts.push("</svg>");
  return parts.join("");
}

/**
 * Renderiza una composición tipada → PNG + WEBP.
 * No publica; no escribe storage.
 */
export async function renderComposition(request: RenderRequest): Promise<RenderOutput> {
  const { template, assets } = request;
  let canvas = sharp({
    create: {
      width: template.width,
      height: template.height,
      channels: 3,
      background: template.background,
    },
  });

  if (assets.background) {
    const bg = await sharp(assets.background)
      .resize(template.width, template.height, { fit: "cover" })
      .toBuffer();
    canvas = sharp(bg);
  }

  const composites: sharp.OverlayOptions[] = [];

  for (const block of template.blocks) {
    if (block.type === "image" && block.assetKey === "photo") {
      const photo = await preparePhoto(assets.photo, request.crop, Math.max(block.width, block.height));
      if (!photo) continue;
      let layer = sharp(photo).resize(block.width, block.height, { fit: "cover" });
      if (block.shape === "circle") {
        const mask = await circleMask(block.width);
        layer = sharp(
          await layer
            .ensureAlpha()
            .composite([{ input: mask, blend: "dest-in" }])
            .png()
            .toBuffer(),
        );
        if (block.borderWidth && block.borderColor) {
          const ring = Buffer.from(`<svg width="${block.width}" height="${block.height}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${block.width / 2}" cy="${block.height / 2}" r="${block.width / 2 - block.borderWidth / 2}" fill="none" stroke="${block.borderColor}" stroke-width="${block.borderWidth}"/>
          </svg>`);
          const withRing = await layer
            .composite([{ input: ring, blend: "over" }])
            .png()
            .toBuffer();
          composites.push({ input: withRing, left: block.x, top: block.y });
          continue;
        }
      }
      composites.push({
        input: await layer.png().toBuffer(),
        left: block.x,
        top: block.y,
      });
    }

    if (block.type === "image" && block.assetKey === "logo") {
      const logo = await prepareLogo(assets.logo, block.width, block.height);
      if (logo) {
        composites.push({ input: logo, left: block.x, top: block.y });
      }
    }
  }

  const textSvg = buildTextSvg(template, request.variables);
  composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });

  const composed = await canvas.composite(composites).png().toBuffer();
  const png = composed;
  const webp = await sharp(composed).webp({ quality: 88 }).toBuffer();
  const contentHash = createHash("sha256").update(png).digest("hex");

  return {
    png,
    webp,
    width: template.width,
    height: template.height,
    templateId: template.id,
    templateVersion: template.version,
    rendererVersion: RENDERER_VERSION,
    contentHash,
  };
}

export function hashRenderInputs(parts: Array<string | Buffer | null | undefined>): string {
  const h = createHash("sha256");
  for (const p of parts) {
    if (p == null) h.update("null");
    else if (typeof p === "string") h.update(p);
    else h.update(p);
  }
  return h.digest("hex");
}
