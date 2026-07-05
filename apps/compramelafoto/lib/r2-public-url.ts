/**
 * Helpers de URL pública R2 — seguros para cliente y servidor (sin fs ni AWS SDK).
 */

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) {
    throw new Error(
      "R2_BUCKET_NAME o R2_BUCKET debe estar configurado en las variables de entorno"
    );
  }
  return bucketName;
}

/**
 * Obtiene la URL pública de un archivo en R2.
 * Siempre devuelve una URL absoluta (https://...).
 */
export function getPublicUrl(keyOrUrl: string): string {
  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    if (keyOrUrl.includes("localhost") || keyOrUrl.includes("127.0.0.1")) {
      console.warn(`⚠️ URL con localhost detectada y rechazada: ${keyOrUrl}`);
      const key = urlToR2Key(keyOrUrl);
      return getPublicUrl(key);
    }
    return keyOrUrl;
  }

  let key = keyOrUrl;
  if (key.startsWith("/uploads/") || key.startsWith("/")) {
    key = key.replace(/^\//, "");
    console.warn(`⚠️ Ruta relativa detectada y normalizada: "${keyOrUrl}" -> key: "${key}"`);
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    const finalUrl = `${publicUrl.replace(/\/$/, "")}/${key}`;
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(`R2_PUBLIC_URL contiene localhost, no permitido en producción: ${publicUrl}`);
    }
    return finalUrl;
  }

  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    const finalUrl = `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(
        `R2_PUBLIC_BASE_URL contiene localhost, no permitido en producción: ${publicBaseUrl}`
      );
    }
    return finalUrl;
  }

  const publicUrlClient = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (publicUrlClient) {
    const finalUrl = `${publicUrlClient.replace(/\/$/, "")}/${key}`;
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(
        `NEXT_PUBLIC_R2_PUBLIC_URL contiene localhost, no permitido en producción: ${publicUrlClient}`
      );
    }
    return finalUrl;
  }

  const publicBaseUrlClient = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (publicBaseUrlClient) {
    const finalUrl = `${publicBaseUrlClient.replace(/\/$/, "")}/${key}`;
    if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
      throw new Error(
        `NEXT_PUBLIC_R2_PUBLIC_BASE_URL contiene localhost, no permitido en producción: ${publicBaseUrlClient}`
      );
    }
    return finalUrl;
  }

  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = getBucketName();

  if (!endpoint) {
    throw new Error(
      "R2_ENDPOINT required for public URLs (o configura R2_PUBLIC_URL o R2_PUBLIC_BASE_URL)"
    );
  }

  const finalUrl = `${endpoint}/${bucketName}/${key}`;

  if (finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) {
    throw new Error(`R2_ENDPOINT contiene localhost, no permitido en producción: ${endpoint}`);
  }

  return finalUrl;
}

export function getR2PublicUrl(keyOrUrl: string): string {
  return getPublicUrl(keyOrUrl);
}

export function urlToR2Key(urlOrPath: string): string {
  if (urlOrPath.startsWith("http")) {
    try {
      const url = new URL(urlOrPath);
      let pathname = url.pathname.replace(/^\//, "");
      const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
      if (bucketName && (pathname === bucketName || pathname.startsWith(`${bucketName}/`))) {
        pathname = pathname.replace(new RegExp(`^${bucketName}/?`), "");
      }
      return pathname;
    } catch {
      // Si falla el parsing, tratar como path
    }
  }

  return urlOrPath.replace(/^\//, "");
}

export function r2PublicUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  return getR2PublicUrl(key.replace(/^\//, ""));
}
