export type OrderZipStatusResponse = {
  zip?: {
    status?: string;
    downloadUrl?: string | null;
  };
};

/**
 * Espera a que el ZIP del pedido esté listo y devuelve la URL de descarga.
 * Dispara la generación vía zipApiUrl si aún no hay job.
 */
export async function pollOrderZipDownloadUrl(
  orderId: number,
  zipApiUrl: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<string | null> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const intervalMs = options?.intervalMs ?? 4000;

  const checkStatus = async (): Promise<string | null> => {
    const res = await fetch(`/api/orders/${orderId}/zip-status`);
    const json = (await res.json().catch(() => ({}))) as OrderZipStatusResponse;
    if (!res.ok) return null;
    if (json.zip?.status === "completed" && json.zip.downloadUrl) {
      return json.zip.downloadUrl;
    }
    if (json.zip?.status === "error") {
      throw new Error("No se pudo generar el ZIP del pedido.");
    }
    return null;
  };

  let readyUrl = await checkStatus();
  if (readyUrl) return readyUrl;

  // Disparar generación / descarga vía token de pedido
  await fetch(zipApiUrl).catch(() => null);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    readyUrl = await checkStatus();
    if (readyUrl) return readyUrl;
  }

  return null;
}
