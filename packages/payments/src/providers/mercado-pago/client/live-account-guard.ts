/**
 * ¿La credencial pertenece a una cuenta de prueba de Mercado Pago?
 *
 * No se puede saber mirando el token. Mercado Pago emite las credenciales de prueba con el
 * mismo prefijo `APP_USR-` que las productivas —está documentado en `isSandboxAccessToken`—
 * así que el chequeo `token.startsWith("TEST-")` deja pasar a todos los usuarios de prueba
 * modernos. La única forma honesta de distinguirlos es preguntarle a Mercado Pago de quién
 * es la cuenta.
 *
 * No es un riesgo teórico. El 2026-11-02 una invitación al consentimiento de Split 1:N en
 * producción falló con `403 Operation not allowed` porque el token era de un usuario de
 * prueba (`TESTUSER313600323196489184`). La lectura funcionaba, la escritura no, y el 403 se
 * interpretó como una falta de permisos del lado de Mercado Pago: se escaló a su equipo un
 * problema que era nuestro.
 */
import type { MercadoPagoHttpClient } from "./mercado-pago-http-client.js";

/** Lo que devuelve `GET /users/me`, recortado a lo que hace falta para decidir. */
export type MercadoPagoAccountIdentity = {
  id: string | null;
  nickname: string | null;
  email: string | null;
};

export class MercadoPagoTestAccountError extends Error {
  readonly code = "MP_CUENTA_DE_PRUEBA";
  readonly identity: MercadoPagoAccountIdentity;

  constructor(identity: MercadoPagoAccountIdentity) {
    super(
      `La credencial es de una cuenta de prueba de Mercado Pago (${identity.nickname ?? identity.id ?? "sin apodo"}). ` +
        "En producción hace falta la credencial de la cuenta real que cobra.",
    );
    this.name = "MercadoPagoTestAccountError";
    this.identity = identity;
  }
}

export class MercadoPagoAccountUnknownError extends Error {
  readonly code = "MP_CUENTA_DESCONOCIDA";

  constructor(detalle: string) {
    super(
      `No se pudo confirmar de qué cuenta es la credencial: ${detalle}. ` +
        "La operación se frena en lugar de arriesgar una escritura productiva con la credencial equivocada.",
    );
    this.name = "MercadoPagoAccountUnknownError";
  }
}

/**
 * Marcas de un usuario de prueba. Mercado Pago los crea con apodo `TESTUSER<números>` y
 * correo en el dominio `@testuser.com`; cualquiera de las dos alcanza.
 */
export function isTestAccountIdentity(identity: MercadoPagoAccountIdentity): boolean {
  const nickname = (identity.nickname ?? "").trim().toUpperCase();
  if (nickname.startsWith("TESTUSER") || nickname.startsWith("TEST_USER")) return true;

  const email = (identity.email ?? "").trim().toLowerCase();
  return email.endsWith("@testuser.com");
}

function normalizeIdentity(body: unknown): MercadoPagoAccountIdentity {
  const r = (body ?? {}) as { id?: unknown; nickname?: unknown; email?: unknown };
  return {
    id: r.id == null ? null : String(r.id),
    nickname: typeof r.nickname === "string" ? r.nickname : null,
    email: typeof r.email === "string" ? r.email : null,
  };
}

/** Pregunta a Mercado Pago de quién es la credencial. Lectura, no escribe nada. */
export async function fetchCollectorIdentity(
  http: MercadoPagoHttpClient,
): Promise<MercadoPagoAccountIdentity> {
  const r = await http.request<Record<string, unknown>>({
    method: "GET",
    path: "/users/me",
  });
  return normalizeIdentity(r.body);
}

/**
 * Freno previo a cualquier escritura productiva: la cuenta tiene que ser real.
 *
 * Falla cerrado a propósito. Si no se puede confirmar quién es, frenar cuesta un reintento;
 * seguir cuesta un rechazo confuso y, como ya pasó, un reclamo mal dirigido a Mercado Pago.
 */
export async function assertLiveCollectorAccount(
  http: MercadoPagoHttpClient,
): Promise<MercadoPagoAccountIdentity> {
  let identity: MercadoPagoAccountIdentity;
  try {
    identity = await fetchCollectorIdentity(http);
  } catch (err: unknown) {
    throw new MercadoPagoAccountUnknownError(
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!identity.id) {
    throw new MercadoPagoAccountUnknownError("Mercado Pago no devolvió el id de la cuenta");
  }
  if (isTestAccountIdentity(identity)) {
    throw new MercadoPagoTestAccountError(identity);
  }
  return identity;
}
