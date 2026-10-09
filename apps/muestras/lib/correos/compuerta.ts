/**
 * Nada sale hasta que alguien lo enciende, y hacen falta dos llaves: la clave de Resend y el
 * interruptor propio escrito exactamente `true`. Mismo criterio que SubiLaFoto.
 */
export type Compuerta = { puede: true; apiKey: string; from: string } | { puede: false; motivo: string };

export function compuertaDeEnvio(env: Readonly<Record<string, string | undefined>> = process.env): Compuerta {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return { puede: false, motivo: "Falta RESEND_API_KEY." };
  if (env.MUESTRAS_CORREOS_EN_VIVO !== "true") return { puede: false, motivo: 'MUESTRAS_CORREOS_EN_VIVO no es exactamente "true".' };
  const from = env.MUESTRAS_EMAIL_FROM?.trim();
  if (!from) return { puede: false, motivo: "Falta MUESTRAS_EMAIL_FROM." };
  return { puede: true, apiKey, from };
}
