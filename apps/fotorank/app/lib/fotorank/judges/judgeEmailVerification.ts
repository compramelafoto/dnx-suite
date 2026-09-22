/**
 * Verificación del correo de un jurado que se postuló solo.
 *
 * NO se inventa una tabla: se usa `EmailVerificationToken` del schema
 * compartido, con `purpose = VERIFY_EMAIL`. Ya existe en las cinco bases y es
 * la misma que usa CompraMeLaFoto, así que no hace falta migrar nada para esto.
 *
 * El campo se llama `token` pero guarda el hash: así lo escribe el resto de la
 * suite (`apps/compramelafoto/lib/token-hash.ts`) y se respeta el mismo
 * algoritmo para no tener dos formas de lo mismo.
 */
import { createHash, randomBytes } from "node:crypto";

export const VERIFICACION_VIGENCIA_HORAS = 48;

export type PropositoDeToken = "VERIFY_EMAIL" | "CREATE_ACCOUNT" | "PASSWORD_RESET";

/**
 * Un token vale para una cosa sola.
 *
 * Sin esto, el enlace que confirma un correo serviría también para cambiar la
 * contraseña de esa cuenta: dos cosas con riesgos muy distintos detrás del
 * mismo papel. Por eso el propósito se compara siempre, y por eso hubo que
 * agregar `PASSWORD_RESET` al enum en vez de reutilizar `VERIFY_EMAIL`.
 */

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function crearTokenDeVerificacion(
  ahora: Date,
  vigenciaHoras: number = VERIFICACION_VIGENCIA_HORAS,
): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashDeToken(token),
    expiresAt: new Date(ahora.getTime() + vigenciaHoras * 60 * 60 * 1000),
  };
}

export type FilaDeToken = {
  usedAt: Date | null;
  expiresAt: Date;
  purpose: PropositoDeToken;
};

export type RevisionDeToken =
  | { ok: true }
  | {
      ok: false;
      motivo: "NO_EXISTE" | "YA_USADO" | "VENCIDO" | "OTRO_PROPOSITO";
      mensaje: string;
    };

const PEDI_UNO_NUEVO = "Pedí uno nuevo desde tu panel.";

export function revisarToken(input: {
  fila: FilaDeToken | null;
  ahora: Date;
  /** Para qué se está usando el enlace. Por omisión, confirmar el correo. */
  esperado?: PropositoDeToken;
  /** Qué hacer si venció o ya se usó. Cambia según de dónde se pide uno nuevo. */
  comoPedirOtro?: string;
}): RevisionDeToken {
  const esperado = input.esperado ?? "VERIFY_EMAIL";
  const pediOtro = input.comoPedirOtro ?? PEDI_UNO_NUEVO;

  if (!input.fila) {
    return { ok: false, motivo: "NO_EXISTE", mensaje: `Este enlace no es válido. ${pediOtro}` };
  }
  if (input.fila.purpose !== esperado) {
    return { ok: false, motivo: "OTRO_PROPOSITO", mensaje: `Este enlace no es válido. ${pediOtro}` };
  }
  if (input.fila.usedAt) {
    return { ok: false, motivo: "YA_USADO", mensaje: `Este enlace ya se usó. ${pediOtro}` };
  }
  if (input.ahora.getTime() > input.fila.expiresAt.getTime()) {
    return { ok: false, motivo: "VENCIDO", mensaje: `Este enlace venció. ${pediOtro}` };
  }
  return { ok: true };
}
