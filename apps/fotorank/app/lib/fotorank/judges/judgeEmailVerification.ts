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

export type PropositoDeToken = "VERIFY_EMAIL" | "CREATE_ACCOUNT";

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function crearTokenDeVerificacion(
  ahora: Date,
): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashDeToken(token),
    expiresAt: new Date(ahora.getTime() + VERIFICACION_VIGENCIA_HORAS * 60 * 60 * 1000),
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
}): RevisionDeToken {
  if (!input.fila) {
    return { ok: false, motivo: "NO_EXISTE", mensaje: `Este enlace no es válido. ${PEDI_UNO_NUEVO}` };
  }
  if (input.fila.purpose !== "VERIFY_EMAIL") {
    return { ok: false, motivo: "OTRO_PROPOSITO", mensaje: `Este enlace no es válido. ${PEDI_UNO_NUEVO}` };
  }
  if (input.fila.usedAt) {
    return { ok: false, motivo: "YA_USADO", mensaje: `Este enlace ya se usó. ${PEDI_UNO_NUEVO}` };
  }
  if (input.ahora.getTime() > input.fila.expiresAt.getTime()) {
    return { ok: false, motivo: "VENCIDO", mensaje: `Este enlace venció. ${PEDI_UNO_NUEVO}` };
  }
  return { ok: true };
}
