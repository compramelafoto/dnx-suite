/**
 * Extrae key R2 relativa desde previewUrl CLF (URL pública o path).
 * No hace fetch externo: solo parsea pathname → key del bucket compartido.
 */
export function urlToR2Key(urlOrPath: string): string {
  const raw = urlOrPath.trim();
  if (!raw) throw new Error("Key R2 vacía");

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      let pathname = url.pathname.replace(/^\//, "");
      const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
      if (
        bucketName &&
        (pathname === bucketName || pathname.startsWith(`${bucketName}/`))
      ) {
        pathname = pathname.replace(new RegExp(`^${bucketName}/?`), "");
      }
      if (!pathname) throw new Error("Key R2 vacía tras parsear URL");
      return pathname;
    } catch (e) {
      if (e instanceof Error && e.message.includes("Key R2")) throw e;
      // fall through: tratar como path
    }
  }

  return raw.replace(/^\//, "");
}
