/**
 * Helpers puros de entrega pública (sin deps de R2/storage).
 */

export function getEditorialPhotoDelivery(
  variants: Array<{ width: number; format: string; url: string }>,
) {
  const webps = variants
    .filter((v) => v.format === "webp")
    .sort((a, b) => a.width - b.width);
  const sorted = [...variants].sort((a, b) => a.width - b.width);
  const master = webps[webps.length - 1] || sorted[sorted.length - 1] || null;
  const srcSet = webps.map((v) => `${v.url} ${v.width}w`).join(", ");
  return {
    src: master?.url ?? "",
    srcSet: srcSet || undefined,
    sizes: "(max-width: 768px) 100vw, 960px",
  };
}
