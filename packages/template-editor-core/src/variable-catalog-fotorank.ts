/**
 * Datos de muestra de FotoRank: con qué se ve un diploma o una imagen de ganador mientras se
 * diseña, antes de tener un premiado real.
 *
 * Las claves son las del plugin de variables (`@repo/template-engine`, `plugins/fotorank`). Sin
 * esto el producto caía en los datos de muestra de escuela y el lienzo mostraba todas las
 * variables del diploma en blanco.
 *
 * Las dos imágenes son dibujos en SVG y no fotos: alcanzan para ver dónde cae la obra y el logo,
 * no pesan, y no hay que pedirle a nadie una foto de concurso para mostrar un ejemplo.
 */

const OBRA_DE_MUESTRA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6c27a"/>
      <stop offset="0.55" stop-color="#e07a5f"/>
      <stop offset="1" stop-color="#3d405b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#cielo)"/>
  <circle cx="820" cy="430" r="90" fill="#fde2b8" opacity="0.9"/>
  <path d="M0 560 L220 430 L400 520 L620 380 L860 540 L1040 450 L1200 520 L1200 800 L0 800 Z" fill="#2b2d42"/>
  <path d="M0 640 L300 560 L560 650 L820 580 L1200 660 L1200 800 L0 800 Z" fill="#1b1c2e"/>
</svg>`;

const LOGO_DE_MUESTRA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <circle cx="200" cy="200" r="180" fill="none" stroke="#d4af37" stroke-width="16"/>
  <circle cx="200" cy="200" r="70" fill="#d4af37"/>
  <text x="200" y="335" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#d4af37">LOGO</text>
</svg>`;

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const FOTORANK_SAMPLE_ENTRY_IMAGE_DATA_URL = svgDataUrl(OBRA_DE_MUESTRA_SVG);
export const FOTORANK_SAMPLE_LOGO_DATA_URL = svgDataUrl(LOGO_DE_MUESTRA_SVG);

export function createFotorankExampleData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    recipientName: "Lucía Fernández",
    entryTitle: "Amanecer en el Paraná",
    entryImage: FOTORANK_SAMPLE_ENTRY_IMAGE_DATA_URL,
    prizeLabel: "Primer premio",
    categoryName: "Paisaje",
    contestTitle: "Santa Fe en Foco 2026",
    organizerName: "Sociedad de Fotógrafos Profesionales de Rosario",
    organizerLogo: FOTORANK_SAMPLE_LOGO_DATA_URL,
    issuedDate: "2026-11-20",
    diplomaCode: "FR-EJEMPLO-00184",
    verificationUrl: "https://fotorank.com/diplomas/verificar/ejemplo",
    ...overrides,
  };
}
