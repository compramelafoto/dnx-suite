/**
 * Miniaturas del catálogo por silueta física (product shot vertical, fondo claro).
 * Ver public/camofduty/lenses/CREDITS.txt
 */

const LENS_THUMBNAILS: Record<string, string> = {
  // Gran angular extremo — corto y bulboso (Samyang 14mm)
  "14f28": "/camofduty/lenses/ultra-wide.jpg",
  // Gran angular luminoso — perfil ancho con parasol (Tokina 16-28)
  "20f18": "/camofduty/lenses/wide-prime.jpg",
  "24f18": "/camofduty/lenses/wide-prime.jpg",
  // Angular clásico — algo más largo que el gran angular (Canon 17-40)
  "28f2": "/camofduty/lenses/wide-normal.jpg",
  "35f18": "/camofduty/lenses/wide-normal.jpg",
  // Normal estándar (Canon 50mm f/1.8)
  "50f18": "/camofduty/lenses/normal-prime.jpg",
  // Retrato corto (Canon 85mm con parasol)
  "85f18": "/camofduty/lenses/portrait-prime.jpg",
  // Macro — tubo largo con anillo de enfoque (Canon 100mm macro)
  "100macro28": "/camofduty/lenses/macro-prime.jpg",
  // Tele medio — más largo que el 85 (Canon 70-200)
  "135f18": "/camofduty/lenses/tele-zoom.jpg",
  // Tele largo — cilindro alargado (Canon 300mm f/4L)
  "200f28": "/camofduty/lenses/tele-prime.jpg",
  // Zoom angular profesional (Tokina 16-28)
  "1635f28": "/camofduty/lenses/zoom-wide.jpg",
  // Zoom estándar (Canon 24-70)
  "2470f28": "/camofduty/lenses/zoom-standard.jpg",
  // Zoom de viaje / rango amplio (Canon 28-105)
  "24105f4": "/camofduty/lenses/zoom-travel.jpg",
  "18105f4": "/camofduty/lenses/zoom-travel.jpg",
  // Tele zoom pro (Canon 70-200 blanco)
  "70200f28": "/camofduty/lenses/tele-zoom.jpg",
  // Tele zoom consumidor (Canon 75-300)
  "70300f456": "/camofduty/lenses/tele-zoom-consumer.jpg",
  // Supertele (Canon 300mm / 100-400)
  "100400f456": "/camofduty/lenses/super-tele.jpg",
  // Kit zoom de entrada (Canon 17-40, perfil compacto)
  "1855f3556": "/camofduty/lenses/kit-zoom.jpg",
  // Superzoom todo-en-uno (Canon 75-300, barril largo)
  "18200f3563": "/camofduty/lenses/superzoom.jpg",
};

const DEFAULT_THUMB = "/camofduty/lenses/normal-prime.jpg";

export function getLensThumbnailPath(lensId: string): string {
  return LENS_THUMBNAILS[lensId] ?? DEFAULT_THUMB;
}
