import { resolveConsentimientoConfig } from "./config";
import { pedirInvitacion, type DepsConsentimiento } from "./servicio";

/**
 * Invitación de cobro dividido pedida sola al terminar de conectar Mercado Pago.
 *
 * Conectar por OAuth deja a CLF cobrar a nombre del fotógrafo, pero el consentimiento de
 * Split 1:N es una autorización aparte que sólo el titular puede aceptar en Mercado Pago.
 * Para que no tenga que escribir ningún correo, apenas vuelve de conectar se lee el correo de
 * esa cuenta (con el token recién obtenido) y se pide la invitación. Queda sólo «Aceptar».
 *
 * Nunca lanza: cualquier problema se registra y la conexión sigue igual que siempre (la
 * invitación se puede pedir después desde la tarjeta «Cobro dividido al instante»).
 */

/** Roles que pueden cobrar una parte de una venta (los mismos que la ruta del panel). */
const ROLES_CON_PARTE = new Set([
  "PHOTOGRAPHER",
  "LAB_PHOTOGRAPHER",
  "ORGANIZER",
  "SCHOOL_ORGANIZER",
  "ADMIN",
  "SUPER_ADMIN",
]);

/** Lo máximo que se espera a Mercado Pago antes de seguir con la conexión. */
export const ESPERA_MAXIMA_MS = 8_000;

export type ResultadoAlConectar =
  /** No se intentó nada: la conexión queda exactamente como antes. */
  | { pedida: false; motivo: "APAGADO" | "ROL" | "SIN_CUENTA" | "YA_ACTIVO" }
  /** Se intentó y no salió (se registra; se puede pedir desde la tarjeta). */
  | { pedida: false; motivo: "SIN_CORREO" | "FALLA"; codigo?: string }
  /** Invitación lista: falta que la persona la acepte en Mercado Pago (o ya estaba aceptada). */
  | { pedida: true; estado: string; inviteUrl: string | null };

export type DepsAlConectar = {
  env?: NodeJS.ProcessEnv;
  /** Correo de la cuenta de Mercado Pago dueña del token (`GET /users/me`). */
  leerCorreo: (accessToken: string) => Promise<string | null>;
  /** Puede lanzar si falta configuración del piloto. */
  crearDeps: () => DepsConsentimiento;
  esperaMaximaMs?: number;
};

/** Los dos interruptores: el consentimiento desde CLF y el freno de escritura en producción. */
export function autoInvitacionEncendida(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    resolveConsentimientoConfig(env).enabled &&
    env.DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED?.trim().toLowerCase() === "true"
  );
}

function conLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("TIEMPO_AGOTADO")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function pedirInvitacionAlConectar(
  deps: DepsAlConectar,
  input: { userId: number; rol: string | null; accessToken: string; mpUserId: string | null },
): Promise<ResultadoAlConectar> {
  if (!autoInvitacionEncendida(deps.env ?? process.env)) return { pedida: false, motivo: "APAGADO" };
  if (!input.rol || !ROLES_CON_PARTE.has(input.rol)) return { pedida: false, motivo: "ROL" };
  // Sin el id de la cuenta conectada no se puede comprobar de quién es una invitación previa.
  if (!input.mpUserId) return { pedida: false, motivo: "SIN_CUENTA" };

  const espera = deps.esperaMaximaMs ?? ESPERA_MAXIMA_MS;
  try {
    const consentimiento = deps.crearDeps();
    const actual = await conLimite(consentimiento.repo.buscarPorUsuario(input.userId), espera);
    // Un cobro dividido ya aceptado no se toca, aunque haya conectado otra cuenta.
    if (actual?.estado === "ACTIVE") return { pedida: false, motivo: "YA_ACTIVO" };

    const correo = (await conLimite(deps.leerCorreo(input.accessToken), espera))?.trim() ?? "";
    if (!correo) {
      console.warn("[split-1n-consentimiento] al_conectar_sin_correo", { userId: input.userId });
      return { pedida: false, motivo: "SIN_CORREO" };
    }

    const r = await conLimite(
      pedirInvitacion(consentimiento, { userId: input.userId, correo, mpUserId: input.mpUserId }),
      espera,
    );
    if (!r.ok) {
      console.warn("[split-1n-consentimiento] al_conectar_no_pedida", {
        userId: input.userId,
        codigo: r.codigo,
      });
      return { pedida: false, motivo: "FALLA", codigo: r.codigo };
    }
    console.info("[split-1n-consentimiento] al_conectar_pedida", {
      userId: input.userId,
      estado: r.vista.estado,
    });
    return { pedida: true, estado: r.vista.estado, inviteUrl: r.vista.inviteUrl };
  } catch (err: unknown) {
    console.error("[split-1n-consentimiento] al_conectar_fallida", {
      userId: input.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { pedida: false, motivo: "FALLA" };
  }
}

/** Correo de la cuenta de Mercado Pago dueña del token. null si no responde o no lo trae. */
export async function leerCorreoMercadoPago(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchImpl("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { email?: unknown } | null;
  return typeof data?.email === "string" ? data.email : null;
}

/**
 * Qué agregar a la vuelta al panel. Con la invitación pendiente, el panel muestra el botón
 * «Aceptar en Mercado Pago» destacado; en cualquier otro caso, nada (como antes).
 */
export function parametrosDeVuelta(r: ResultadoAlConectar): Record<string, string> {
  if (r.pedida && r.estado === "PENDING") return { tab: "mercadopago", cobro_dividido: "aceptar" };
  return {};
}
