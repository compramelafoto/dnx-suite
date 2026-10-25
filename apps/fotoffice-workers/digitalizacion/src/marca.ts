import sharp from "sharp";

export type BrandingMarca = { commercialName: string; logoUrl: string | null; whatsapp: string | null };

const ANCHO = 400;
const PAD = 22;
const FUENTE = `font-family="DejaVu Sans, Arial, sans-serif"`;
const LOGO_MAX_ANCHO = ANCHO - PAD * 2;
const LOGO_MAX_ALTO = 80;

const ICONO_TELEFONO =
  "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function recortar(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export async function cargarLogoHttp(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** PNG de la marca: "Digitalizado por:", logo (o nombre) y WhatsApp. */
export async function armarMarca(
  branding: BrandingMarca,
  cargarLogo: (url: string) => Promise<Buffer | null> = cargarLogoHttp,
): Promise<Buffer> {
  let logo: { input: Buffer; ancho: number; alto: number } | null = null;
  if (branding.logoUrl) {
    try {
      const bruto = await cargarLogo(branding.logoUrl);
      if (bruto) {
        const png = await sharp(bruto)
          .resize(LOGO_MAX_ANCHO, LOGO_MAX_ALTO, { fit: "inside", withoutEnlargement: false })
          .png()
          .toBuffer();
        const meta = await sharp(png).metadata();
        logo = { input: png, ancho: meta.width ?? LOGO_MAX_ANCHO, alto: meta.height ?? LOGO_MAX_ALTO };
      }
    } catch {
      logo = null;
    }
  }

  const whatsapp = branding.whatsapp?.trim() || null;
  const yTitulo = PAD + 14;
  const yContenido = PAD + 30;
  const altoContenido = logo ? logo.alto : 40;
  const yWhats = yContenido + altoContenido + 16;
  const alto = whatsapp ? yWhats + 36 + PAD : yContenido + altoContenido + PAD;

  const partes: string[] = [
    `<rect x="0" y="0" width="${ANCHO}" height="${alto}" rx="18" ry="18" fill="#000000" fill-opacity="0.62"/>`,
    `<text x="${PAD}" y="${yTitulo}" ${FUENTE} font-size="15" fill="#ffffff" fill-opacity="0.85">Digitalizado por:</text>`,
  ];
  if (!logo) {
    partes.push(
      `<text x="${PAD}" y="${yContenido + 30}" ${FUENTE} font-size="30" font-weight="bold" fill="#ffffff">${esc(recortar(branding.commercialName, 22))}</text>`,
    );
  }
  if (whatsapp) {
    const cy = yWhats + 18;
    partes.push(
      `<circle cx="${PAD + 18}" cy="${cy}" r="18" fill="#25D366"/>`,
      `<g transform="translate(${PAD + 18 - 11},${cy - 11}) scale(0.92)"><path d="${ICONO_TELEFONO}" fill="#ffffff"/></g>`,
      `<text x="${PAD + 46}" y="${cy + 8}" ${FUENTE} font-size="24" fill="#ffffff">${esc(recortar(whatsapp, 20))}</text>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}">${partes.join("")}</svg>`;

  const capas: sharp.OverlayOptions[] = [];
  if (logo) capas.push({ input: logo.input, left: PAD, top: yContenido });
  return sharp(Buffer.from(svg)).composite(capas).png().toBuffer();
}
