import { z } from "zod";
import { MIN_MINUTOS_ENTRE_CORRIDAS } from "./constants";

/**
 * Lo que las acciones de `/ventas` deciden sin tocar la base: cuánto falta para poder volver a
 * sincronizar y la validación de los formularios.
 *
 * Módulo PURO: lo prueba `panel.test.ts` sin Prisma ni red.
 */

/**
 * Cuántos minutos faltan para poder apretar "Actualizar ahora" otra vez; 0 si ya se puede.
 *
 * Existe para cuidar a Alboom (cada corrida inicia sesión y pagina todo) y el gasto en Claude:
 * sin tope, un dedo nervioso haría diez corridas seguidas.
 */
export function minutosParaActualizar(ultimaCorrida: Date | null, ahora: Date): number {
  if (!ultimaCorrida) return 0;
  const pasaron = (ahora.getTime() - ultimaCorrida.getTime()) / 60_000;
  if (pasaron >= MIN_MINUTOS_ENTRE_CORRIDAS || pasaron < 0) return 0;
  return Math.ceil(MIN_MINUTOS_ENTRE_CORRIDAS - pasaron);
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Como mucho ${max} caracteres.`)
    .transform((s) => (s === "" ? null : s));

/**
 * El subdominio como lo escribe la gente: acepta que peguen `dnxfotografia.alboomcrm.com` o la
 * dirección entera, y se queda con la primera parte. Las mismas reglas que exige el cliente.
 */
export const conexionSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => s.replace(/^https?:\/\//, "").replace(/\.alboomcrm\.com.*$/, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(/^[a-z0-9-]{1,63}$/, "El subdominio sólo lleva letras, números y guiones.")),
  username: z.string().trim().min(1, "Falta el usuario de Alboom.").max(200),
  password: z.string().max(200),
});

export const ajustesSchema = z.object({
  pipelinesIncluded: z.array(z.string().trim().min(1).max(200)).max(50),
  signature: textoOpcional(120),
  voiceNotes: textoOpcional(2000),
  waitDays: z.coerce
    .number({ invalid_type_error: "Los días de espera tienen que ser un número." })
    .int("Los días de espera van sin decimales.")
    .min(1, "Los días de espera van de 1 a 30.")
    .max(30, "Los días de espera van de 1 a 30."),
  staleDays: z.coerce
    .number({ invalid_type_error: "Los días sin movimiento tienen que ser un número." })
    .int("Los días sin movimiento van sin decimales.")
    .min(30, "Los días sin movimiento van de 30 a 365.")
    .max(365, "Los días sin movimiento van de 30 a 365."),
});

/** Los embudos elegidos, sin espacios de más ni repetidos: `sync` compara contra el nombre recortado. */
export function embudosElegidos(valores: FormDataEntryValue[]): string[] {
  const nombres = valores.map((v) => String(v).trim()).filter((v) => v !== "");
  return [...new Set(nombres)];
}

/** El primer mensaje de error de zod, que es el que se muestra. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisá los datos.";
}
