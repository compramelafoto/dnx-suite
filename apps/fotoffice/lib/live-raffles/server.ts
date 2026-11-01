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
      polls: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { votes: { select: { optionIndex: true, entrantId: true } } } },
      _count: { select: { entrants: true } },
    },
  });
}

/**
 * Saca un ganador para el premio. Con `markAbsentId`, antes anota que esa persona salió y no
 * estaba, así no vuelve a salir para este premio.
 *
 * Corre en una transacción serializable: dos clics seguidos en la pantalla no pueden dejar dos
 * ganadores distintos ni saltearse la regla de "un premio por persona".
 */
export async function drawPrize(params: {
  liveRaffleId: string;
  prizeId: string;
  markAbsentId?: string;
}): Promise<{ ok: true; winnerId: string } | { ok: false; error: string }> {
  return prisma.$transaction(
    async (tx) => {
      const sorteo = await tx.liveRaffle.findUnique({
        where: { id: params.liveRaffleId },
        select: {
          oneWinPerPerson: true,
          prizes: { select: { id: true, winnerEntrantId: true, absentEntrantIds: true } },
          entrants: { select: { id: true } },
        },
      });
      if (!sorteo) return { ok: false as const, error: "El sorteo no existe." };
      const premio = sorteo.prizes.find((p) => p.id === params.prizeId);
      if (!premio) return { ok: false as const, error: "El premio no existe." };

      if (params.markAbsentId) {
        if (premio.winnerEntrantId !== params.markAbsentId) {
          return { ok: false as const, error: "Ese premio ya cambió. Recargá la pantalla." };
        }
        premio.absentEntrantIds = [...premio.absentEntrantIds, params.markAbsentId];
        premio.winnerEntrantId = null;
      } else if (premio.winnerEntrantId) {
        return { ok: false as const, error: "Ese premio ya tiene ganador." };
      }

      const candidatos = eligibleEntrantIds({
        entrantIds: sorteo.entrants.map((e) => e.id),
        prizeId: premio.id,
        prizes: sorteo.prizes,
        oneWinPerPerson: sorteo.oneWinPerPerson,
      });
      if (candidatos.length === 0) {
        if (params.markAbsentId) {
          await tx.liveRafflePrize.update({
            where: { id: premio.id },
            data: { winnerEntrantId: null, drawnAt: null, absentEntrantIds: premio.absentEntrantIds },
          });
        }
        return { ok: false as const, error: "No quedan participantes que puedan ganar este premio." };
      }

      const winnerId = candidatos[randomInt(candidatos.length)];
      await tx.liveRafflePrize.update({
        where: { id: premio.id },
        data: { winnerEntrantId: winnerId, drawnAt: new Date(), absentEntrantIds: premio.absentEntrantIds },
      });
      return { ok: true as const, winnerId };
    },
    { isolationLevel: "Serializable" },
  );
}
