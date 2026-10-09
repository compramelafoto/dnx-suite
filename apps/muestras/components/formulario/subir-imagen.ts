/**
 * Achica en el navegador antes de subir: una foto de cámara pesa 10–25 MB y Vercel corta los
 * pedidos en 4,5 MB. El servidor la vuelve a procesar (WebP, tamaño final).
 */
export async function achicarEnNavegador(file: File, ladoMayor: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const escala = Math.min(1, ladoMayor / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No pudimos leer la imagen."))), "image/jpeg", 0.9),
  );
}

export async function subirImagen(file: File, uso: "obra" | "portada"): Promise<string> {
  const blob = await achicarEnNavegador(file, uso === "portada" ? 1600 : 2000);
  const fd = new FormData();
  fd.set("file", new File([blob], "imagen.jpg", { type: "image/jpeg" }));
  fd.set("uso", uso);
  const res = await fetch("/api/imagenes", { method: "POST", body: fd });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "No pudimos subir la imagen.");
  return json.url;
}
