import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { validatePackBasics } from "@/lib/album-packs/album-pack-basic-rules";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import {
  loadCollaborativeEventPricingSnapshot,
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING,
} from "@/lib/events/collaborative-event-pricing-lock";
import { prisma } from "@/lib/prisma";

const NO_ALBUM = "No encontré ese álbum en tu cuenta.";
const NO_PACK = "No encontré ese pack en tu cuenta.";

/** Únicas columnas que `editar_pack` toca (y que su deshacer puede volver a escribir). */
const CLAVES_EDITABLES = ["name", "price", "isActive"] as const;
type ValoresPack = Partial<{ name: string; price: number; isActive: boolean }>;

/** Pack del álbum, sólo si el álbum es del que habla y no está borrado. */
async function findOwnPack(albumId: number, packId: string, userId: number) {
  return prisma.albumPack.findFirst({
    where: { id: packId, albumId, album: { userId, deletedAt: null } },
    select: { id: true, name: true, price: true, isActive: true, packType: true, album: { select: { eventId: true } } },
  });
}

/** Igual que el PATCH de la ruta: un pack digital de un evento con precio fijado por el organizador no se toca. */
async function lockedByEvent(pack: { packType: string; album: { eventId: number | null } }): Promise<boolean> {
  if (pack.packType !== "DIGITAL" || pack.album.eventId == null) return false;
  const lock = await loadCollaborativeEventPricingSnapshot(pack.album.eventId);
  return Boolean(lock?.locksPhotographerDigitalPricing);
}

function soloClavesEditables(v: unknown): ValoresPack {
  const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: ValoresPack = {};
  if (typeof src.name === "string") out.name = src.name;
  if (typeof src.price === "number") out.price = src.price;
  if (typeof src.isActive === "boolean") out.isActive = src.isActive;
  return out;
}

export const packTools: BotTool[] = [
  defineTool({
    name: "crear_pack_digital",
    description:
      "Propone crear un pack de N fotos digitales a precio fijo (pesos enteros) en un álbum. El comprador elige las fotos. No sirve para álbumes de un evento.",
    kind: "write",
    input: z.strictObject({
      albumId: z.number().int().positive(),
      nombre: z.string().min(1).max(80),
      precio: z.number().int().min(0).describe("Pesos enteros (15000 = $15.000)"),
      cantidadFotos: z.number().int().min(1).max(500),
    }),
    describe: async (i, actor) => {
      const a = await prisma.album.findFirst({
        where: { id: i.albumId, userId: actor.userId, deletedAt: null },
        select: { title: true },
      });
      // Lanzar (en vez de devolver texto) evita que se cree una tarjeta de confirmación para algo ajeno.
      if (!a) throw new Error(NO_ALBUM);
      return `Crear en «${a.title}» el pack «${i.nombre.trim()}»: ${i.cantidadFotos} fotos digitales a ${formatPurchaseArs(i.precio)}. El comprador elige las fotos.`;
    },
    run: async (i, actor) => {
      const a = await prisma.album.findFirst({
        where: { id: i.albumId, userId: actor.userId, deletedAt: null },
        select: { id: true, eventId: true },
      });
      if (!a) return { ok: false, message: NO_ALBUM };
      if (a.eventId != null) {
        return { ok: false, message: "Este álbum es parte de un evento: los packs digitales los maneja el organizador desde el panel." };
      }
      const v = validatePackBasics({ name: i.nombre, price: i.precio, requiresSelection: true, includedPhotoCount: i.cantidadFotos });
      if (!v.ok) return { ok: false, message: v.error };
      // Mismos datos que guarda POST /api/dashboard/albums/[id]/packs para un pack DIGITAL sin
      // componentes ni plantilla (la ruta sólo llama a replaceAlbumPackComponents si hay componentes).
      const pack = await prisma.albumPack.create({
        data: {
          albumId: a.id,
          name: v.name!,
          description: null,
          price: v.price!,
          packType: "DIGITAL",
          availabilityPhase: "ALWAYS",
          requiresSelection: true,
          requiresDesign: false,
          includedPhotoCount: v.includedPhotoCount!,
          templateId: null,
          templateV2Id: null,
          isActive: true,
        },
        select: { id: true },
      });
      return {
        ok: true,
        message: "Listo, creé el pack. Si no lo querés, lo podés desactivar.",
        after: { albumId: a.id, packId: pack.id },
      };
    },
  }),
  defineTool({
    name: "editar_pack",
    description: "Propone cambiar el nombre, el precio (pesos enteros) o activar/desactivar un pack existente.",
    kind: "write",
    input: z.strictObject({
      albumId: z.number().int().positive(),
      packId: z.string().min(1).max(60),
      nombre: z.string().min(1).max(80).optional(),
      precio: z.number().int().min(0).optional().describe("Pesos enteros"),
      activo: z.boolean().optional(),
    }),
    describe: async (i, actor) => {
      const p = await findOwnPack(i.albumId, i.packId, actor.userId);
      if (!p) throw new Error(NO_PACK);
      const cambios = [
        i.nombre !== undefined ? `cambiarle el nombre a «${i.nombre.trim()}»` : null,
        i.precio !== undefined ? `poner el precio en ${formatPurchaseArs(i.precio)}` : null,
        i.activo !== undefined ? (i.activo ? "activarlo" : "desactivarlo") : null,
      ].filter(Boolean);
      return `Pack «${p.name}»: ${cambios.join(", ") || "sin cambios"}.`;
    },
    run: async (i, actor) => {
      const p = await findOwnPack(i.albumId, i.packId, actor.userId);
      if (!p) return { ok: false, message: NO_PACK };
      if (await lockedByEvent(p)) return { ok: false, message: MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING };
      const v = validatePackBasics({
        ...(i.nombre !== undefined ? { name: i.nombre } : {}),
        ...(i.precio !== undefined ? { price: i.precio } : {}),
      });
      if (!v.ok) return { ok: false, message: v.error };
      const data: ValoresPack = {};
      if (v.name !== undefined) data.name = v.name;
      if (v.price !== undefined) data.price = v.price;
      if (i.activo !== undefined) data.isActive = i.activo;
      if (Object.keys(data).length === 0) return { ok: false, message: "No hay cambios para aplicar." };
      const valores: ValoresPack = {};
      for (const k of CLAVES_EDITABLES) if (k in data) Object.assign(valores, { [k]: p[k] });
      await prisma.albumPack.update({ where: { id: p.id }, data });
      return { ok: true, message: "Listo, actualicé el pack.", before: { albumId: i.albumId, packId: p.id, valores }, after: data };
    },
    undo: async (before, actor) => {
      const b = (before ?? {}) as { albumId?: unknown; packId?: unknown; valores?: unknown };
      if (typeof b.albumId !== "number" || typeof b.packId !== "string") return { ok: false, message: NO_PACK };
      const p = await findOwnPack(b.albumId, b.packId, actor.userId);
      if (!p) return { ok: false, message: NO_PACK };
      if (await lockedByEvent(p)) return { ok: false, message: MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING };
      const data = soloClavesEditables(b.valores);
      if (Object.keys(data).length === 0) return { ok: false, message: "No hay nada para deshacer." };
      await prisma.albumPack.update({ where: { id: p.id }, data });
      return { ok: true, message: "Volví el pack a como estaba." };
    },
  }),
];
