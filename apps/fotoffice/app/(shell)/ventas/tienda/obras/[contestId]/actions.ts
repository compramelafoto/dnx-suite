"use server";

import { revalidatePath } from "next/cache";
import { requireStoreConfigurer } from "@/lib/store/access";
import { parseRoyaltyPercent, royaltyPercentText } from "@/lib/store/artworks/catalog-rules";
import { ArtworkPublishError, publishArtwork, saveContestRoyalty, unpublishArtwork } from "@/lib/store/artworks/catalog";
import { ConsentSetupError, requestConsents, type ConsentSkipReason } from "@/lib/store/artworks/consent";
import { ArtworkImageError } from "@/lib/store/artworks/fotorank-client";
import { ContestNotLinkedError } from "@/lib/store/artworks/links";

/**
 * Acciones de la pantalla de un concurso. Todas pasan por `requireStoreConfigurer` y toman el
 * workspace y la persona de la sesión; el concurso y las obras se vuelven a comprobar abajo
 * (vínculo, que la obra sea del concurso, permiso del autor).
 */

export type ContestActionResult = { ok: true; message?: string } | { ok: false; error: string };

const ruta = (contestId: string) => `/ventas/tienda/obras/${contestId}`;

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

/** Errores conocidos → mensaje para la persona; lo demás sigue de largo. */
function mensajeDe(error: unknown): string | null {
  if (error instanceof ArtworkPublishError || error instanceof ContestNotLinkedError || error instanceof ConsentSetupError) {
    return error.message;
  }
  if (error instanceof ArtworkImageError) {
    return error.code === "ARTWORKS_NOT_CONFIGURED"
      ? "La conexión con FotoRank todavía no está configurada. Avisale a soporte."
      : "No pudimos traer la vista previa de FotoRank. Probá de nuevo en un rato.";
  }
  return null;
}

export async function saveContestRoyaltyAction(contestId: string, formData: FormData): Promise<ContestActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const id = texto(contestId);
  if (!id) return { ok: false, error: "Falta el concurso." };
  const raw = formData.get("royaltyPercent");
  const parsed = parseRoyaltyPercent(typeof raw === "string" ? raw : "");
  if (!parsed.ok) return parsed;
  try {
    await saveContestRoyalty(workspace.id, id, parsed.bps);
  } catch (error) {
    const m = mensajeDe(error);
    if (m) return { ok: false, error: m };
    throw error;
  }
  revalidatePath(ruta(id));
  return { ok: true, message: `Regalía guardada: ${royaltyPercentText(parsed.bps)} %.` };
}

const MOTIVOS: Record<ConsentSkipReason, string> = {
  NOT_IN_CONTEST: "no son de este concurso",
  NOT_ELIGIBLE: "no están confirmadas",
  NO_AUTHOR_EMAIL: "el autor no tiene email",
  AUTHOR_DECLINED: "el autor no aceptó",
  AUTHOR_WITHDREW: "el autor retiró el permiso",
  ALREADY_GRANTED: "el autor ya aceptó",
  RECENTLY_SENT: "ya se avisó en las últimas 24 h",
  IN_PROGRESS: "se están procesando en otra pestaña",
  EMAIL_FAILED: "el correo no salió (podés reintentar)",
  LIMIT: "superan las 100 por vez (mandalas en otra tanda)",
};

export async function requestConsentsAction(contestId: string, entryIds: string[]): Promise<ContestActionResult> {
  const { user, workspace } = await requireStoreConfigurer();
  const id = texto(contestId);
  if (!id) return { ok: false, error: "Falta el concurso." };
  const ids = Array.isArray(entryIds) ? entryIds.filter((e): e is string => typeof e === "string" && e !== "") : [];
  if (ids.length === 0) return { ok: false, error: "Elegí al menos una obra." };
  try {
    const r = await requestConsents(workspace.id, id, ids, user.id);
    revalidatePath(ruta(id));
    const partes: string[] = [];
    if (r.notified) partes.push(`${r.notified} ${r.notified === 1 ? "aviso enviado" : "avisos enviados"}`);
    if (r.requested) partes.push(`${r.requested} ${r.requested === 1 ? "pedido de permiso enviado" : "pedidos de permiso enviados"}`);
    const porMotivo = new Map<ConsentSkipReason, number>();
    for (const s of r.skipped) porMotivo.set(s.reason, (porMotivo.get(s.reason) ?? 0) + 1);
    const salteadas = [...porMotivo].map(([motivo, n]) => `${n} sin enviar porque ${MOTIVOS[motivo]}`);
    const mensaje = [...partes, ...salteadas].join(". ") + ".";
    if (r.notified + r.requested === 0) return { ok: false, error: mensaje };
    return { ok: true, message: mensaje };
  } catch (error) {
    const m = mensajeDe(error);
    if (m) return { ok: false, error: m };
    throw error;
  }
}

export async function publishArtworkAction(contestId: string, entryId: string): Promise<ContestActionResult> {
  const { user, workspace } = await requireStoreConfigurer();
  const c = texto(contestId);
  const e = texto(entryId);
  if (!c || !e) return { ok: false, error: "Falta la obra." };
  try {
    await publishArtwork(workspace.id, c, e, user.id);
  } catch (error) {
    const m = mensajeDe(error);
    if (m) return { ok: false, error: m };
    console.error("[fotoffice][tienda] no se pudo publicar la obra", { workspaceId: workspace.id, entryId: e });
    throw error;
  }
  revalidatePath(ruta(c));
  return { ok: true, message: "Obra publicada en la tienda." };
}

export async function unpublishArtworkAction(contestId: string, entryId: string): Promise<ContestActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const c = texto(contestId);
  const e = texto(entryId);
  if (!c || !e) return { ok: false, error: "Falta la obra." };
  const { withdrawn } = await unpublishArtwork(workspace.id, c, e);
  revalidatePath(ruta(c));
  return withdrawn ? { ok: true, message: "La obra ya no se muestra en la tienda." } : { ok: false, error: "Esa obra no estaba publicada." };
}
