/**
 * El correo al ganador. Módulo PURO: devuelve asunto, texto y HTML. El diseño de CLF (logo,
 * tarjeta, botón) lo pone la cola de correos al enviarlo.
 */

const SITE_URL = "https://www.compramelafoto.com";

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function winnerEmail(input: {
  raffleId: string;
  raffleTitle: string;
  winnerName: string | null;
  prizeTitle: string;
  prizeDescription: string | null;
  sponsorName: string | null;
  deliveryInstructions: string | null;
}): { subject: string; text: string; html: string } {
  const saludo = input.winnerName?.trim() ? `¡Hola, ${input.winnerName.trim().split(/\s+/)[0]}!` : "¡Hola!";
  const verificacion = `${SITE_URL}/sorteos/${input.raffleId}`;
  const entrega =
    input.deliveryInstructions?.trim() ||
    "Te vamos a escribir en los próximos días para coordinar la entrega.";
  const lineas = [
    saludo,
    `Ganaste en el ${input.raffleTitle} de CompraMeLaFoto: ${input.prizeTitle}${input.sponsorName ? `, gentileza de ${input.sponsorName}` : ""}.`,
    input.prizeDescription?.trim() || null,
    `Cómo lo recibís: ${entrega}`,
    "Participaste porque vendiste fotos en CompraMeLaFoto durante el período del sorteo. ¡Gracias por elegirnos!",
    `El sorteo es verificable: podés ver la lista de participantes y cómo salió el resultado acá: ${verificacion}`,
  ].filter((l): l is string => Boolean(l));

  const html = [
    `<p>${escapeHtml(saludo)}</p>`,
    `<p>Ganaste en el <strong>${escapeHtml(input.raffleTitle)}</strong> de CompraMeLaFoto: <strong>${escapeHtml(input.prizeTitle)}</strong>${input.sponsorName ? `, gentileza de ${escapeHtml(input.sponsorName)}` : ""}.</p>`,
    input.prizeDescription?.trim() ? `<p>${escapeHtml(input.prizeDescription.trim())}</p>` : "",
    `<p><strong>Cómo lo recibís:</strong> ${escapeHtml(entrega)}</p>`,
    `<p>Participaste porque vendiste fotos en CompraMeLaFoto durante el período del sorteo. ¡Gracias por elegirnos!</p>`,
    `<p>El sorteo es verificable: podés ver la lista de participantes y cómo salió el resultado.</p>`,
    `<p><a href="${verificacion}">Ver el resultado del sorteo</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `¡Ganaste en el ${input.raffleTitle}!`,
    text: lineas.join("\n\n"),
    html,
  };
}

/** Un premio del sorteo mensual, tal como se guarda en `ClfRaffleSettings.monthlyPrizes`. */
export type PrizeTemplate = {
  title: string;
  description?: string | null;
  conditions?: string | null;
  sponsorName?: string | null;
  deliveryInstructions?: string | null;
  estimatedValueArs?: number | null;
};

/** Lee la lista guardada sin confiar en su forma: lo que no sirve se descarta. */
export function parsePrizeTemplates(value: unknown): PrizeTemplate[] {
  if (!Array.isArray(value)) return [];
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return value
    .map((p): PrizeTemplate | null => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const title = txt(o.title);
      if (!title) return null;
      const valor = Number(o.estimatedValueArs);
      return {
        title,
        description: txt(o.description),
        conditions: txt(o.conditions),
        sponsorName: txt(o.sponsorName),
        deliveryInstructions: txt(o.deliveryInstructions),
        estimatedValueArs: Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null,
      };
    })
    .filter((p): p is PrizeTemplate => p !== null)
    .slice(0, 20);
}
