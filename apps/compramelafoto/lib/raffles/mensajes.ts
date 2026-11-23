/**
 * El correo al ganador. Módulo PURO: devuelve asunto, texto y HTML. El diseño de CLF (logo,
 * tarjeta, botón) lo pone la cola de correos al enviarlo.
 */

const SITE_URL = "https://www.compramelafoto.com";

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Sólo direcciones https: las imágenes van a R2 y los enlaces a sitios o redes del sponsor. */
export function safeUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  let raw = v.trim();
  if (!/^[a-z]+:\/\//i.test(raw) && /^[\w-]+(\.[\w-]+)+/.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function winnerEmail(input: {
  raffleId: string;
  raffleTitle: string;
  winnerName: string | null;
  prizeTitle: string;
  prizeDescription: string | null;
  sponsorName: string | null;
  deliveryInstructions: string | null;
  prizeImageUrl?: string | null;
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
    safeUrl(input.prizeImageUrl)
      ? `<p><img src="${escapeHtml(safeUrl(input.prizeImageUrl)!)}" alt="${escapeHtml(input.prizeTitle)}" width="480" style="max-width:100%;height:auto;border-radius:12px" /></p>`
      : "",
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
  imageUrl?: string | null;
  sponsorLogoUrl?: string | null;
  sponsorUrl?: string | null;
};

/** Quien acompaña un sorteo: su logo desfila en la página pública y en el panel. */
export type SponsorTemplate = { name: string | null; logoUrl: string; url: string | null };

export function parseSponsors(value: unknown): SponsorTemplate[] {
  if (!Array.isArray(value)) return [];
  const vistos = new Set<string>();
  const out: SponsorTemplate[] = [];
  for (const s of value) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const logoUrl = safeUrl(o.logoUrl);
    if (!logoUrl || vistos.has(logoUrl)) continue;
    vistos.add(logoUrl);
    const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 80) : null;
    out.push({ name, logoUrl, url: safeUrl(o.url) });
  }
  return out.slice(0, 24);
}

/**
 * Los logos del sorteo, sin repetir: primero los sponsors cargados, después los de quienes
 * donan premios. Igual que el banner de FOTOFFICE.
 */
export function sponsorLogos(
  sponsors: SponsorTemplate[],
  prizes: { sponsorLogoUrl?: string | null; sponsorName?: string | null; sponsorUrl?: string | null }[],
): SponsorTemplate[] {
  const vistos = new Set<string>();
  const out: SponsorTemplate[] = [];
  for (const s of sponsors) {
    if (vistos.has(s.logoUrl)) continue;
    vistos.add(s.logoUrl);
    out.push(s);
  }
  for (const p of prizes) {
    if (!p.sponsorLogoUrl || vistos.has(p.sponsorLogoUrl)) continue;
    vistos.add(p.sponsorLogoUrl);
    out.push({ logoUrl: p.sponsorLogoUrl, name: p.sponsorName ?? null, url: p.sponsorUrl ?? null });
  }
  return out;
}

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
        imageUrl: safeUrl(o.imageUrl),
        sponsorLogoUrl: safeUrl(o.sponsorLogoUrl),
        sponsorUrl: safeUrl(o.sponsorUrl),
      };
    })
    .filter((p): p is PrizeTemplate => p !== null)
    .slice(0, 20);
}
