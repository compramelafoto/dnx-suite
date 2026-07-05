/**
 * Comprueba existencia de assets estáticos en public/.
 */

export async function assetFileExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    if (head.status === 404) return false;
    const probe = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-3" },
      cache: "no-store",
    });
    return probe.ok;
  } catch {
    return false;
  }
}
