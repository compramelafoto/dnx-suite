/**
 * Cómo nombrarle al cliente lo que acaba de comprar.
 *
 * La pantalla de "pago procesado" decía "tus fotos" siempre, así que a quien
 * compraba un video le hablaba de algo que no había comprado. El texto tiene
 * que nombrar lo que la persona realmente pagó.
 */

export type PurchasedThings = {
  photos: number;
  videos: number;
};

function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function purchasedThingsLabel(input: PurchasedThings): string {
  const photos = safe(input.photos);
  const videos = safe(input.videos);

  const partes: string[] = [];
  if (photos > 0) partes.push("tus fotos");
  if (videos > 0) partes.push(videos === 1 ? "tu video" : "tus videos");

  // Sin datos, algo genérico antes que una frase a medias.
  if (partes.length === 0) return "tu compra";

  return partes.join(" y ");
}
