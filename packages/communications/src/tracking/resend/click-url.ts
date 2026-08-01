import { assertSafeUrl } from "../../templates/security/urls";
import type { TrackingLinkData } from "../contracts";

/**
 * Normaliza URL de click: solo https (http en tests con allowHttp).
 * Descarta query sensible (token, key, etc.) y credenciales.
 */
export function normalizeClickedUrl(
  raw: string | undefined,
  options: { allowHttp?: boolean } = {},
): TrackingLinkData {
  if (!raw?.trim()) {
    return { discardedUnsafe: true };
  }

  try {
    const safe = assertSafeUrl(raw, { allowHttp: options.allowHttp });
    const url = new URL(safe);
    if (url.username || url.password) {
      return { discardedUnsafe: true };
    }

    const sensitiveKeys = /^(token|key|secret|password|auth|signature|sid)$/i;
    const cleaned = new URL(url.toString());
    for (const key of [...cleaned.searchParams.keys()]) {
      if (sensitiveKeys.test(key)) {
        cleaned.searchParams.delete(key);
      }
    }

    return {
      safeUrl: cleaned.toString(),
      hostname: cleaned.hostname,
      protocol: cleaned.protocol.replace(":", ""),
      discardedUnsafe: false,
    };
  } catch {
    return { discardedUnsafe: true };
  }
}
