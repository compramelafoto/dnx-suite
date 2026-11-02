import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@repo/db";
import { uploadFotofficeImage } from "@/lib/images/upload";
import { eligibleEntrantIds } from "./rules";

/** Sin letras que se confunden al tipearlas desde el cartel (0/O, 1/l/I). */
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

export function newPublicCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) code += ALFABETO[randomInt(ALFABETO.length)];
  return code;
}

export function newScreenToken(): string {
  return randomBytes(24).toString("base64url");
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://fotoffice.com").trim().replace(/\/+$/, "");
}

export const publicPath = (code: string) => `/sorteo/${code}`;
export const screenPath = (code: string, token: string) => `/sorteo/${code}/pantalla?k=${encodeURIComponent(token)}`;

/** Cookie que recuerda, en ese celular, quién se anotó en ese sorteo. */
export const entrantCookieName = (liveRaffleId: string) => `fo_sorteo_${liveRaffleId}`;

/**
 * Sube un logo si vino uno en el formulario. Devuelve `undefined` si no vino archivo, para que
 * quien llama no pise el logo que ya había.
 */
export async function uploadLogoFromForm(
  form: FormData,
  field: string,
  scope: string,
): Promise<{ ok: true; url: string | undefined } | { ok: false; error: string }> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return { ok: true, url: undefined };
  const subida = await uploadFotofficeImage({
    presetKey: "memberBusinessLogo",
    bytes: new Uint8Array(await file.arrayBuffer()),
    originalFilename: file.name,
    scopeSegment: scope,
  });
  if (!subida.ok) return { ok: false, error: subida.error };
  return { ok: true, url: subida.url };
}

/** El sorteo por su código público, con todo lo que muestran la página y la pantalla. */
export async function loadLiveRaffleByCode(code: string) {
  return prisma.liveRaffle.findUnique({
    where: { publicCode: code },
    include: {
      prizes: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      sponsors: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      draws: { orderBy: [{ round: "asc" }, { createdAt: "asc" }] },
      polls: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { votes: { select: { optionIndex: true, text: true, entrantId: true, createdAt: true } } },
      },
      _count: { select: { entrants: true } },
    },
  });
}

/**
 * Saca un ganador.
 *
 * - Con `prizeId` (sorteo con listado): un sorteo nuevo para ese premio, si todavía no tiene ganador.
 * - Sin `prizeId` (sin listado): un sorteo nuevo, el siguiente número.
 * - Con `redoRound`: el ganador de ese sorteo no estaba. Queda AUSENTE y se saca otro para el
 *   mismo número y el mismo premio.
 *
 * Corre en una transacción serializable: dos clics seguidos en la pantalla no pueden dejar dos
 * ganadores ni saltearse el máximo o la espera.
 */
export async function drawWinner(params: {
  liveRaffleId: string;
  prizeId?: string;
  redoRound?: number;
  /**
   * Sin listado: el premio que se eligió en la pantalla tocando el logo de un sponsor. Se guarda
   * como un premio más del sorteo, así queda junto al ganador en los resultados y en el panel.
   */
  premioNuevo?: { title: string; sponsorName: string | null; sponsorLogoUrl: string | null };
}): Promise<{ ok: true; winnerId: string; round: number } | { ok: false; error: string }> {
  return prisma.$transaction(
    async (tx) => {
      const sorteo = await tx.liveRaffle.findUnique({
        where: { id: params.liveRaffleId },
        select: {
          maxWinsPerPerson: true,
          cooldownDraws: true,
          prizes: { select: { id: true, order: true } },
          entrants: { select: { id: true } },
          draws: { select: { id: true, round: true, entrantId: true, prizeId: true, status: true } },
        },
      });
      if (!sorteo) return { ok: false as const, error: "El sorteo no existe." };
      const draws = [...sorteo.draws];

      let round: number;
      let prizeId: string | null = null;
      if (params.redoRound !== undefined) {
        const vigente = draws.find((d) => d.round === params.redoRound && d.status === "GANADOR");
        if (!vigente) return { ok: false as const, error: "Ese sorteo ya cambió. Recargá la pantalla." };
        await tx.liveRaffleDraw.update({ where: { id: vigente.id }, data: { status: "AUSENTE" } });
        vigente.status = "AUSENTE";
        round = vigente.round;
        prizeId = vigente.prizeId;
      } else {
        if (params.prizeId) {
          if (!sorteo.prizes.some((p) => p.id === params.prizeId)) {
            return { ok: false as const, error: "El premio no existe." };
          }
          if (draws.some((d) => d.prizeId === params.prizeId && d.status === "GANADOR")) {
            return { ok: false as const, error: "Ese premio ya tiene ganador." };
          }
          prizeId = params.prizeId;
        } else if (params.premioNuevo) {
          const creado = await tx.liveRafflePrize.create({
            data: {
              liveRaffleId: params.liveRaffleId,
              order: sorteo.prizes.reduce((max, p) => Math.max(max, p.order), 0) + 1,
              title: params.premioNuevo.title,
              sponsorName: params.premioNuevo.sponsorName,
              sponsorLogoUrl: params.premioNuevo.sponsorLogoUrl,
            },
            select: { id: true },
          });
          prizeId = creado.id;
        }
        round = draws.reduce((max, d) => Math.max(max, d.round), 0) + 1;
      }

      const candidatos = eligibleEntrantIds({
        entrantIds: sorteo.entrants.map((e) => e.id),
        draws,
        round,
        maxWins: sorteo.maxWinsPerPerson,
        cooldown: sorteo.cooldownDraws,
      });
      if (candidatos.length === 0) {
        return { ok: false as const, error: "No quedan participantes que puedan salir en este sorteo." };
      }

      const winnerId = candidatos[randomInt(candidatos.length)];
      await tx.liveRaffleDraw.create({
        data: { liveRaffleId: params.liveRaffleId, round, entrantId: winnerId, prizeId, status: "GANADOR" },
      });
      return { ok: true as const, winnerId, round };
    },
    { isolationLevel: "Serializable" },
  );
}
