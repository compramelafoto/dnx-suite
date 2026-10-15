/**
 * Código de verificación de la firma (etapa 5). Módulo PURO: el reloj y el secreto se inyectan.
 *
 * - Seis dígitos, generados con `crypto.randomInt` (no `Math.random`).
 * - En la base sólo el hash: HMAC-SHA256 con el secreto de los enlaces. Nunca el código.
 * - Vale 15 minutos y 5 intentos. Cada firmante puede pedir hasta 3 códigos por hora.
 * - Vencido no gasta intentos; un código con forma inválida tampoco.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const LONGITUD_CODIGO = 6;
export const MINUTOS_VIGENCIA_CODIGO = 15;
export const MAX_INTENTOS_CODIGO = 5;
export const MAX_CODIGOS_POR_VENTANA = 3;
export const VENTANA_CODIGOS_MS = 60 * 60 * 1000;

const MINUTO_MS = 60 * 1000;
const FORMA_CODIGO = /^[0-9]{6}$/;
const PREFIJO = "fotoffice-contrato-codigo:v1:";

export function generarCodigo(): string {
  return String(randomInt(0, 10 ** LONGITUD_CODIGO)).padStart(LONGITUD_CODIGO, "0");
}

export function codigoConForma(v: unknown): v is string {
  return typeof v === "string" && FORMA_CODIGO.test(v);
}

/** HMAC-SHA256 en hexadecimal. `firmanteId` (opcional) ata el código a un firmante: el mismo código no vale en otro. */
export function hashCodigo(codigo: string, secreto: string, firmanteId = ""): string {
  return createHmac("sha256", secreto).update(`${PREFIJO}${firmanteId}:${codigo}`).digest("hex");
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export type EstadoEmision = { codesSentInWindow: number; codeWindowStart: Date | null };

export type ResultadoEmision =
  | { ok: true; siguiente: { codesSentInWindow: number; codeWindowStart: Date; codeExpiresAt: Date; codeAttempts: 0 } }
  | { ok: false; motivo: "TOPE_HORARIO"; reintentarDesde: Date };

/**
 * ¿Puede el firmante pedir otro código ahora? Si la ventana (1 hora desde el primer código) ya pasó o
 * no hay, arranca una nueva con este como primero. Devuelve lo que hay que guardar si sale.
 */
export function puedeEmitirCodigo(estado: EstadoEmision, ahora: Date): ResultadoEmision {
  const inicio = estado.codeWindowStart;
  const vigente = inicio !== null && ahora.getTime() - inicio.getTime() < VENTANA_CODIGOS_MS && ahora.getTime() >= inicio.getTime();
  if (vigente && estado.codesSentInWindow >= MAX_CODIGOS_POR_VENTANA) {
    return { ok: false, motivo: "TOPE_HORARIO", reintentarDesde: new Date(inicio.getTime() + VENTANA_CODIGOS_MS) };
  }
  return {
    ok: true,
    siguiente: {
      codesSentInWindow: vigente ? estado.codesSentInWindow + 1 : 1,
      codeWindowStart: vigente ? inicio : ahora,
      codeExpiresAt: new Date(ahora.getTime() + MINUTOS_VIGENCIA_CODIGO * MINUTO_MS),
      // Un código nuevo reemplaza al anterior y vuelve a tener todos sus intentos.
      codeAttempts: 0,
    },
  };
}

export type CodigoGuardado = { codeHash: string | null; codeExpiresAt: Date | null; codeAttempts: number };

export type ResultadoValidacion =
  | { ok: true; codeAttempts: number }
  | { ok: false; motivo: "SIN_CODIGO" | "FORMATO" | "VENCIDO" | "AGOTADO"; codeAttempts: number }
  | { ok: false; motivo: "INCORRECTO"; codeAttempts: number; intentosRestantes: number };

/**
 * Valida el código ingresado. `codeAttempts` es lo que hay que guardar después (sólo sube con un
 * código incorrecto). Con éxito el que llama borra el hash para que no se use dos veces.
 */
export function validarCodigo(
  ingresado: unknown,
  guardado: CodigoGuardado,
  secreto: string,
  ahora: Date,
  firmanteId = "",
): ResultadoValidacion {
  const intentos = guardado.codeAttempts;
  if (!guardado.codeHash || !guardado.codeExpiresAt) return { ok: false, motivo: "SIN_CODIGO", codeAttempts: intentos };
  if (ahora.getTime() >= guardado.codeExpiresAt.getTime()) return { ok: false, motivo: "VENCIDO", codeAttempts: intentos };
  if (intentos >= MAX_INTENTOS_CODIGO) return { ok: false, motivo: "AGOTADO", codeAttempts: intentos };
  if (!codigoConForma(ingresado)) return { ok: false, motivo: "FORMATO", codeAttempts: intentos };
  if (iguales(hashCodigo(ingresado, secreto, firmanteId), guardado.codeHash)) return { ok: true, codeAttempts: intentos };
  const nuevos = intentos + 1;
  return { ok: false, motivo: "INCORRECTO", codeAttempts: nuevos, intentosRestantes: Math.max(0, MAX_INTENTOS_CODIGO - nuevos) };
}
