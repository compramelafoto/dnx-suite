/**
 * State de Google OAuth: rol + atribución de referido (y redirect ¿Cuánto Cobro?).
 * Compatibilidad: strings legacy (`PHOTOGRAPHER`, `CC:/ruta`) siguen funcionando.
 */

export type GoogleOAuthStatePayload = {
  role: string;
  ref?: string;
  sourceType?: string;
  sourceEntityId?: number;
  /** Redirect post-login para flujo ¿Cuánto Cobro? (antes `CC:`). */
  redirect?: string;
};

const STATE_PREFIX = "v1.";

function toBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }
  const b64 = btoa(unescape(encodeURIComponent(value)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return decodeURIComponent(escape(atob(b64 + pad)));
}

export function encodeGoogleOAuthState(payload: GoogleOAuthStatePayload): string {
  const role = (payload.role || "PHOTOGRAPHER").trim() || "PHOTOGRAPHER";
  const ref = payload.ref?.trim() || undefined;
  const sourceType = payload.sourceType?.trim() || undefined;
  const sourceEntityId =
    typeof payload.sourceEntityId === "number" &&
    Number.isFinite(payload.sourceEntityId) &&
    payload.sourceEntityId > 0
      ? payload.sourceEntityId
      : undefined;
  const redirect =
    payload.redirect?.startsWith("/") && !payload.redirect.startsWith("//")
      ? payload.redirect
      : undefined;

  const hasExtras = !!(ref || sourceType || sourceEntityId || redirect);
  if (!hasExtras) {
    return role;
  }

  // Mantener forma corta del flujo ¿Cuánto Cobro? cuando no hay referido.
  if (redirect && !ref && !sourceType && !sourceEntityId) {
    return `CC:${redirect}`;
  }

  return (
    STATE_PREFIX +
    toBase64Url(
      JSON.stringify({
        role,
        ...(ref ? { ref } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(sourceEntityId ? { sourceEntityId } : {}),
        ...(redirect ? { redirect } : {}),
      })
    )
  );
}

export function decodeGoogleOAuthState(raw: string | null | undefined): GoogleOAuthStatePayload {
  const value = (raw || "PHOTOGRAPHER").trim() || "PHOTOGRAPHER";

  if (value.startsWith(STATE_PREFIX)) {
    try {
      const parsed = JSON.parse(fromBase64Url(value.slice(STATE_PREFIX.length))) as Partial<GoogleOAuthStatePayload>;
      const role = typeof parsed.role === "string" && parsed.role.trim() ? parsed.role.trim() : "PHOTOGRAPHER";
      const ref = typeof parsed.ref === "string" ? parsed.ref.trim() : undefined;
      const sourceType = typeof parsed.sourceType === "string" ? parsed.sourceType.trim() : undefined;
      const sourceEntityId =
        typeof parsed.sourceEntityId === "number" &&
        Number.isFinite(parsed.sourceEntityId) &&
        parsed.sourceEntityId > 0
          ? parsed.sourceEntityId
          : undefined;
      const redirect =
        typeof parsed.redirect === "string" &&
        parsed.redirect.startsWith("/") &&
        !parsed.redirect.startsWith("//")
          ? parsed.redirect
          : undefined;
      return {
        role,
        ...(ref ? { ref } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(sourceEntityId ? { sourceEntityId } : {}),
        ...(redirect ? { redirect } : {}),
      };
    } catch {
      return { role: "PHOTOGRAPHER" };
    }
  }

  if (value.startsWith("CC:")) {
    const redirect = value.slice(3);
    return {
      role: "PHOTOGRAPHER",
      ...(redirect.startsWith("/") && !redirect.startsWith("//") ? { redirect } : {}),
    };
  }

  return { role: value };
}
