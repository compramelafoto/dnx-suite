import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { requestAlbumExtension } from "@/lib/album-extensions/request-album-extension";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { updateAlbumSettingsForOwner, type AlbumSettingsPatch } from "@/lib/albums/album-settings-update";
import { resetCameraIngestJobForRetry } from "@/lib/camera-connection/camera-ingest-job";
import { buildAlbumEventScheduleFromDb } from "@/lib/albums/album-event-datetime";
import { loadCollaborativeEventPricingSnapshot } from "@/lib/events/collaborative-event-pricing-lock";
import { loadAlbumExtensionSurchargeModeForPhotographer, type AlbumExtensionSurchargeMode } from "@/lib/pricing/album-extension-surcharge";
import { prisma } from "@/lib/prisma";

/** describe() que lanza = el motor devuelve el error al modelo y NO crea la tarjeta de confirmación. */
const NO_ALBUM = "No encontré ese álbum en tu cuenta.";
const NO_FOTO = "No encontré esa foto en tu cuenta.";
const NO_SUBIDA = "No encontré esa subida en tu cuenta.";
const FOTOS_BORRADAS = "Las fotos de este álbum ya se eliminaron o se están eliminando; no se puede extender.";
/** Estados de limpieza en los que las fotos ya no están (o se están borrando): extender no las trae de vuelta. */
const CLEANUP_SIN_FOTOS = new Set(["PENDING", "PROCESSING", "COMPLETED", "COMPLETED_WITH_REFERENCES"]);
const pct = z.number().min(0).max(100).nullable();

const cambiosSchema = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  location: z.string().max(200).nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("YYYY-MM-DD"),
  eventStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  eventEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  isPublic: z.boolean().optional(),
  digitalPhotoPriceCents: z.number().int().positive().nullable().optional().describe("Precio por foto digital en PESOS enteros (5000 = $5.000)"),
  digitalDiscount5Plus: pct.optional(),
  digitalDiscount10Plus: pct.optional(),
  digitalDiscount20Plus: pct.optional(),
  hiddenPhotosEnabled: z.boolean().optional().describe("Reconocimiento facial: el comprador busca sus fotos con una selfie"),
  hiddenSelfieRetentionDays: z.number().int().min(1).max(365).nullable().optional(),
});

const DISCOUNT_KEYS = [
  ["digitalDiscount5Plus", 5],
  ["digitalDiscount10Plus", 10],
  ["digitalDiscount20Plus", 20],
] as const;

function fechaAr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function describeCambios(c: AlbumSettingsPatch, skip: { agenda: boolean; precio: boolean; descuentos: boolean }): string[] {
  const out: string[] = [];
  if (c.title !== undefined && !skip.agenda) out.push(`cambiar el nombre a «${c.title}»`);
  if (c.location !== undefined && !skip.agenda) out.push(c.location ? `poner el lugar «${c.location}»` : "borrar el lugar");
  if (c.eventDate !== undefined && !skip.agenda) out.push(c.eventDate ? `poner la fecha ${fechaAr(c.eventDate)}` : "quitar la fecha");
  if (c.eventStartTime !== undefined && !skip.agenda) out.push(c.eventStartTime ? `poner la hora de inicio ${c.eventStartTime}` : "quitar la hora de inicio");
  if (c.eventEndTime !== undefined && !skip.agenda) out.push(c.eventEndTime ? `poner la hora de fin ${c.eventEndTime}` : "quitar la hora de fin");
  if (c.isPublic !== undefined) out.push(c.isPublic ? "Publicar el álbum" : "Despublicar el álbum");
  if (c.digitalPhotoPriceCents !== undefined && !skip.precio) {
    out.push(c.digitalPhotoPriceCents == null ? "quitar el precio digital" : `poner el precio por foto digital en ${formatPurchaseArs(c.digitalPhotoPriceCents)}`);
  }
  if (!skip.descuentos) {
    for (const [k, n] of DISCOUNT_KEYS) {
      if (c[k] !== undefined) out.push(c[k] == null ? `quitar el descuento desde ${n} fotos` : `${c[k]}% de descuento desde ${n} fotos`);
    }
  }
  if (c.hiddenPhotosEnabled !== undefined) out.push(c.hiddenPhotosEnabled ? "activar la búsqueda con selfie" : "desactivar la búsqueda con selfie");
  if (c.hiddenSelfieRetentionDays !== undefined) out.push(c.hiddenSelfieRetentionDays == null ? "guardar las selfies el tiempo por defecto" : `guardar las selfies ${c.hiddenSelfieRetentionDays} días`);
  return out;
}

const tocaAgenda = (c: AlbumSettingsPatch) =>
  c.title !== undefined || c.location !== undefined || c.eventDate !== undefined || c.eventStartTime !== undefined || c.eventEndTime !== undefined;
const tocaDescuentos = (c: AlbumSettingsPatch) => DISCOUNT_KEYS.some(([k]) => c[k] !== undefined);

function camposDeAgenda(c: AlbumSettingsPatch): string {
  const l: string[] = [];
  if (c.title !== undefined) l.push("el nombre");
  if (c.location !== undefined) l.push("el lugar");
  if (c.eventDate !== undefined || c.eventStartTime !== undefined || c.eventEndTime !== undefined) l.push("la fecha y el horario");
  return l.join(", ").replace(/, ([^,]*)$/, " y $1");
}

const AVISO_EVENTO = "Este álbum es parte de un evento: el nombre, el lugar y la fecha los maneja el organizador";

const aFecha = (v: unknown): Date | null => (v == null ? null : v instanceof Date ? v : new Date(String(v)));

/** `before` viene en formato de columnas (fechas como Date); el undo necesita formato de parche (YYYY-MM-DD / HH:MM, hora argentina). */
function beforeComoParche(before: Record<string, unknown>): AlbumSettingsPatch {
  const { eventDate, startsAt, endsAt, ...resto } = before;
  const patch: Record<string, unknown> = { ...resto };
  if ("eventDate" in before || "startsAt" in before || "endsAt" in before) {
    const f = buildAlbumEventScheduleFromDb({ eventDate: aFecha(eventDate), startsAt: aFecha(startsAt), endsAt: aFecha(endsAt) });
    patch.eventDate = f.eventDate || null;
    patch.eventStartTime = f.eventStartTime || null;
    patch.eventEndTime = f.eventEndTime || null;
  }
  return patch as AlbumSettingsPatch;
}

async function ownedAlbum(albumId: number, userId: number) {
  return prisma.album.findFirst({ where: { id: albumId, userId, deletedAt: null }, select: { id: true, title: true } });
}

async function ownedAlbumForExtension(albumId: number, userId: number) {
  return prisma.album.findFirst({
    where: { id: albumId, userId, deletedAt: null },
    select: { id: true, title: true, cleanupStatus: true },
  });
}

async function ownedPhoto(albumId: number, photoId: number, userId: number) {
  return prisma.photo.findFirst({
    where: { id: photoId, albumId, isRemoved: false, album: { userId, deletedAt: null } },
    select: { id: true },
  });
}

function recargoTexto(mode: AlbumExtensionSurchargeMode): string {
  const detalle =
    mode.kind === "FIXED_PER_30_DAYS"
      ? `${formatPurchaseArs(mode.priceArs)} por cada 30 días de extensión`
      : `${mode.percent}% de la compra por cada 30 días de extensión`;
  return `Mientras dure la extensión, los compradores pagan un recargo en cada compra (${detalle}).`;
}

export const albumTools: BotTool[] = [
  defineTool({
    name: "actualizar_album",
    description: "Propone cambiar ajustes de un álbum: nombre, lugar, fecha, publicar/despublicar, precio digital (pesos), descuentos por cantidad, búsqueda con selfie y días de guardado de selfies.",
    kind: "write",
    input: z.strictObject({ albumId: z.number().int().positive(), cambios: cambiosSchema }),
    describe: async ({ albumId, cambios }, actor) => {
      const a = await prisma.album.findFirst({
        where: { id: albumId, userId: actor.userId, deletedAt: null },
        select: { id: true, title: true, eventId: true },
      });
      if (!a) throw new Error(NO_ALBUM);
      const enEvento = a.eventId != null;
      const skip = { agenda: enEvento && tocaAgenda(cambios), precio: false, descuentos: false };
      const avisos: string[] = [];
      if (skip.agenda) avisos.push(`${AVISO_EVENTO}, así que no voy a cambiar ${camposDeAgenda(cambios)}.`);
      if (enEvento && (cambios.digitalPhotoPriceCents !== undefined || tocaDescuentos(cambios))) {
        const lock = (await loadCollaborativeEventPricingSnapshot(a.eventId))?.locksPhotographerDigitalPricing;
        if (lock) {
          if (cambios.digitalPhotoPriceCents !== undefined) {
            skip.precio = true;
            avisos.push("El organizador fijó el precio digital del evento, así que no se puede cambiar el precio (el sistema lo rechaza).");
          }
          if (tocaDescuentos(cambios)) {
            skip.descuentos = true;
            avisos.push("Los descuentos por cantidad también los define el organizador: se ignoran.");
          }
        }
      }
      const lista = describeCambios(cambios, skip);
      const base = lista.length ? `En «${a.title}»: ${lista.join("; ")}.` : `En «${a.title}»: no quedaría ningún cambio para aplicar.`;
      return [base, ...avisos].join(" ");
    },
    run: async ({ albumId, cambios }, actor) => {
      const r = await updateAlbumSettingsForOwner({ actorUserId: actor.userId, albumId, patch: cambios });
      if (!r.ok) {
        if (r.error === "No hay cambios para aplicar") {
          const a = await prisma.album.findFirst({ where: { id: albumId, userId: actor.userId, deletedAt: null }, select: { eventId: true } });
          if (a?.eventId != null) {
            const partes: string[] = [];
            if (tocaAgenda(cambios)) partes.push(`${camposDeAgenda(cambios)} los maneja el organizador del evento`);
            if (tocaDescuentos(cambios)) partes.push("los descuentos por cantidad los define el organizador del evento");
            if (partes.length) return { ok: false, code: String(r.status), message: `No cambié nada: ${partes.join(" y ")}.` };
          }
        }
        return { ok: false, message: r.error, code: String(r.status) };
      }
      return { ok: true, message: "Listo, guardé los cambios del álbum.", before: { albumId, valores: beforeComoParche(r.before) }, after: { albumId, valores: r.after } };
    },
    undo: async (before, actor) => {
      const b = before as { albumId: number; valores: AlbumSettingsPatch };
      const r = await updateAlbumSettingsForOwner({ actorUserId: actor.userId, albumId: b.albumId, patch: b.valores });
      return r.ok ? { ok: true, message: "Volví el álbum a como estaba." } : { ok: false, message: r.error };
    },
  }),
  defineTool({
    name: "cambiar_venta_de_foto",
    description: "Propone activar o desactivar la venta digital y/o impresa de una foto puntual.",
    kind: "write",
    input: z.strictObject({ albumId: z.number().int().positive(), photoId: z.number().int().positive(), sellDigital: z.boolean().optional(), sellPrint: z.boolean().optional() }),
    describe: async (i, actor) => {
      if (!(await ownedPhoto(i.albumId, i.photoId, actor.userId))) throw new Error(NO_FOTO);
      return `Foto #${i.photoId}: ${[i.sellDigital !== undefined ? `${i.sellDigital ? "vender" : "no vender"} en digital` : null, i.sellPrint !== undefined ? `${i.sellPrint ? "vender" : "no vender"} impresa` : null].filter(Boolean).join(" y ")}.`;
    },
    run: async (i, actor) => {
      const p = await prisma.photo.findFirst({ where: { id: i.photoId, albumId: i.albumId, isRemoved: false, album: { deletedAt: null } }, select: { id: true, sellDigital: true, sellPrint: true, album: { select: { userId: true } } } });
      if (!p || p.album.userId !== actor.userId) return { ok: false, message: NO_FOTO };
      const next = { sellDigital: i.sellDigital ?? p.sellDigital, sellPrint: i.sellPrint ?? p.sellPrint };
      if (!next.sellDigital && !next.sellPrint) return { ok: false, message: "Al menos una opción de venta tiene que quedar activa." };
      await prisma.photo.update({ where: { id: p.id }, data: next });
      return { ok: true, message: "Listo.", before: { albumId: i.albumId, photoId: p.id, sellDigital: p.sellDigital, sellPrint: p.sellPrint }, after: next };
    },
    undo: async (before, actor) => {
      const b = before as { albumId: number; photoId: number; sellDigital: boolean; sellPrint: boolean };
      const p = await prisma.photo.findFirst({ where: { id: b.photoId, albumId: b.albumId, isRemoved: false, album: { userId: actor.userId, deletedAt: null } }, select: { id: true } });
      if (!p) return { ok: false, message: "No encontré esa foto." };
      await prisma.photo.update({ where: { id: p.id }, data: { sellDigital: b.sellDigital, sellPrint: b.sellPrint } });
      return { ok: true, message: "Volví la foto a como estaba." };
    },
  }),
  defineTool({
    name: "configurar_venta_por_reconocimiento",
    description: "Propone activar o desactivar la compra de 'todas mis fotos' (encontradas con selfie) a un precio fijo en pesos.",
    kind: "write",
    input: z.strictObject({ albumId: z.number().int().positive(), habilitar: z.boolean(), precio: z.number().int().positive().optional().describe("Pesos enteros") }),
    describe: async (i, actor) => {
      const a = await ownedAlbum(i.albumId, actor.userId);
      if (!a) throw new Error(NO_ALBUM);
      if (i.habilitar && !i.precio) return `En «${a.title}»: vender «todas mis fotos», pero falta el precio.`;
      return i.habilitar ? `En «${a.title}»: vender «todas mis fotos» a ${formatPurchaseArs(i.precio ?? 0)}.` : `En «${a.title}»: dejar de vender «todas mis fotos».`;
    },
    run: async (i, actor) => {
      if (i.habilitar && !i.precio) return { ok: false, message: "Falta el precio." };
      // enableFaceBulkPurchase / faceBulkPriceCents viven en Album (no en AlbumSalesSettings).
      const prev = await prisma.album.findFirst({
        where: { id: i.albumId, userId: actor.userId, deletedAt: null },
        select: { id: true, enableFaceBulkPurchase: true, faceBulkPriceCents: true },
      });
      if (!prev) return { ok: false, message: NO_ALBUM };
      const data = { enableFaceBulkPurchase: i.habilitar, faceBulkPriceCents: i.habilitar ? i.precio! : null };
      await prisma.album.update({ where: { id: i.albumId }, data });
      return { ok: true, message: "Listo.", before: { albumId: i.albumId, enableFaceBulkPurchase: prev.enableFaceBulkPurchase, faceBulkPriceCents: prev.faceBulkPriceCents }, after: data };
    },
    undo: async (before, actor) => {
      const b = before as { albumId: number; enableFaceBulkPurchase: boolean; faceBulkPriceCents: number | null };
      if (!(await ownedAlbum(b.albumId, actor.userId))) return { ok: false, message: "No encontré ese álbum." };
      await prisma.album.update({ where: { id: b.albumId }, data: { enableFaceBulkPurchase: b.enableFaceBulkPurchase, faceBulkPriceCents: b.faceBulkPriceCents } });
      return { ok: true, message: "Volví la configuración a como estaba." };
    },
  }),
  defineTool({
    name: "extender_vencimiento",
    description: "Propone extender el vencimiento de un álbum. Reactiva el álbum y vuelve a mandar los avisos a los interesados que no compraron. No se puede deshacer.",
    kind: "write",
    input: z.strictObject({ albumId: z.number().int().positive(), dias: z.number().int().min(1).max(90).default(30) }),
    describe: async (i, actor) => {
      const a = await ownedAlbumForExtension(i.albumId, actor.userId);
      if (!a) throw new Error(NO_ALBUM);
      if (CLEANUP_SIN_FOTOS.has(a.cleanupStatus)) throw new Error(FOTOS_BORRADAS);
      const recargo = recargoTexto(await loadAlbumExtensionSurchargeModeForPhotographer(prisma, actor.userId));
      return `Extender «${a.title}» ${i.dias} días. También se reactivan los avisos a interesados. ${recargo} No se puede deshacer.`;
    },
    run: async (i, actor) => {
      const a = await ownedAlbumForExtension(i.albumId, actor.userId);
      if (!a) return { ok: false, message: NO_ALBUM };
      if (CLEANUP_SIN_FOTOS.has(a.cleanupStatus)) return { ok: false, message: FOTOS_BORRADAS };
      let r;
      try {
        r = await requestAlbumExtension({ albumId: i.albumId, daysToAdd: i.dias, requestedByRole: actor.role === "LAB_PHOTOGRAPHER" ? "LAB_PHOTOGRAPHER" : "PHOTOGRAPHER", requestedByUserId: actor.userId });
      } catch (e) {
        console.error("extender_vencimiento falló", e);
        return { ok: false, message: "No pude extender el álbum. Probá de nuevo o abrí un pedido de soporte." };
      }
      return { ok: true, message: `Listo. Queda visible hasta el ${r.visibleUntil.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.`, after: r };
    },
  }),
  defineTool({
    name: "reintentar_subida",
    description: "Propone reintentar una subida de fotos que falló.",
    kind: "write",
    input: z.strictObject({ albumId: z.number().int().positive(), jobId: z.string().min(1) }),
    describe: async (i, actor) => {
      const job = await prisma.cameraIngestJob.findFirst({
        where: { id: i.jobId, albumId: i.albumId, album: { userId: actor.userId, deletedAt: null } },
        select: { id: true },
      });
      if (!job) throw new Error(NO_SUBIDA);
      return `Reintentar la subida fallida ${i.jobId}.`;
    },
    run: async (i, actor) => {
      const job = await prisma.cameraIngestJob.findFirst({ where: { id: i.jobId, albumId: i.albumId, album: { deletedAt: null } }, select: { id: true, status: true, album: { select: { userId: true } } } });
      if (!job || job.album.userId !== actor.userId) return { ok: false, message: NO_SUBIDA };
      if (job.status !== "FAILED") return { ok: false, message: "Esa subida no está fallida." };
      await resetCameraIngestJobForRetry(job.id, "Reintento pedido desde DNX Bot");
      return { ok: true, message: "Listo, la subida se va a reintentar en unos minutos." };
    },
  }),
];
