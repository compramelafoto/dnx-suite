import { SINGLE_EMAIL_RE } from "@/lib/communications/constants";
import { DEFAULT_RETURNS_POLICY } from "./constants";

/**
 * La configuración de la tienda online (`StoreSettings`): si está abierta, dónde y cuándo se
 * retira, la política de devoluciones y a quién se avisa de cada pedido. Módulo PURO.
 *
 * Las reglas viven acá y no en el componente: una acción del servidor se puede llamar a mano,
 * y tiene que quedar igual de protegida.
 *
 * Cerrada, se puede guardar a medio completar (es lo normal mientras se prepara). Abierta,
 * exige lo que el comprador necesita para retirar y lo que el negocio necesita para enterarse
 * de que vendió: la dirección de retiro y un email de avisos válido. Que Mercado Pago esté
 * conectado lo verifica la acción, porque necesita la base.
 */

export const MAX_PICKUP_ADDRESS = 300;
export const MAX_PICKUP_HOURS = 300;
export const MAX_PICKUP_INSTRUCTIONS = 2000;
export const MAX_RETURNS_POLICY = 5000;
const MAX_EMAIL = 254;

export type StoreSettingsValues = {
  isOpen: boolean;
  pickupAddress: string | null;
  pickupHours: string | null;
  pickupInstructions: string | null;
  /** `null` = la política por omisión (`DEFAULT_RETURNS_POLICY`, ver `effectiveReturnsPolicy`). */
  returnsPolicy: string | null;
  notifyEmail: string | null;
};

export type SettingsFormResult = { ok: true; values: StoreSettingsValues } | { ok: false; error: string };

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

/** Casilla con respaldo oculto después: `FormData.get` devuelve la primera coincidencia. */
function casilla(fd: FormData, campo: string): boolean {
  return fd.get(campo) === "on";
}

const TEXTOS = [
  ["pickupAddress", MAX_PICKUP_ADDRESS, "La dirección de retiro"],
  ["pickupHours", MAX_PICKUP_HOURS, "Los horarios de retiro"],
  ["pickupInstructions", MAX_PICKUP_INSTRUCTIONS, "Las indicaciones para retirar"],
  ["returnsPolicy", MAX_RETURNS_POLICY, "La política de devoluciones"],
] as const;

export function parseSettingsForm(fd: FormData): SettingsFormResult {
  const isOpen = casilla(fd, "isOpen");

  const textos: Partial<Record<(typeof TEXTOS)[number][0], string | null>> = {};
  for (const [campo, max, nombre] of TEXTOS) {
    const valor = texto(fd, campo);
    if (valor.length > max) return { ok: false, error: `${nombre} puede tener hasta ${max} caracteres.` };
    textos[campo] = valor || null;
  }

  const emailCrudo = texto(fd, "notifyEmail").toLowerCase();
  const emailValido = emailCrudo.length <= MAX_EMAIL && SINGLE_EMAIL_RE.test(emailCrudo);

  if (isOpen) {
    if (!textos.pickupAddress) return { ok: false, error: "Para abrir la tienda falta la dirección de retiro." };
    if (!emailValido) {
      return { ok: false, error: "Para abrir la tienda falta un email válido para los avisos de pedidos." };
    }
  } else if (emailCrudo !== "" && !emailValido) {
    return { ok: false, error: "El email de avisos no es válido." };
  }

  return {
    ok: true,
    values: {
      isOpen,
      pickupAddress: textos.pickupAddress ?? null,
      pickupHours: textos.pickupHours ?? null,
      pickupInstructions: textos.pickupInstructions ?? null,
      returnsPolicy: textos.returnsPolicy ?? null,
      notifyEmail: emailCrudo || null,
    },
  };
}

/** La política que ve el comprador: la propia si el negocio escribió una, si no la de siempre. */
export function effectiveReturnsPolicy(returnsPolicy: string | null | undefined): string {
  const propia = returnsPolicy?.trim();
  return propia ? propia : DEFAULT_RETURNS_POLICY;
}
