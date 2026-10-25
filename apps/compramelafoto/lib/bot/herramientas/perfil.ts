import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import {
  normalizeDefaultDigitalPrice,
  normalizeHexColor,
  normalizePublicPageHandler,
} from "@/lib/fotografo/profile-field-rules";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";

/*
  Sólo datos públicos del perfil y precios por defecto. Nunca datos de cobro (CBU, alias, CUIT,
  Mercado Pago), email ni contraseña: los esquemas son estrictos y el deshacer filtra las claves.
*/

const texto = z.string().max(200).nullable();
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().describe("#RRGGBB; null para borrarlo");

const TEXTOS = ["name", "phone", "whatsapp", "instagram", "tiktok", "facebook", "website", "companyName", "city", "province"] as const;
const COLORES = ["primaryColor", "secondaryColor", "tertiaryColor", "fontColor"] as const;
const BANDERAS = ["isPublicPageEnabled", "enableAlbumsPage", "enablePrintPage"] as const;
const PERFIL_KEYS = [...TEXTOS, ...COLORES, "publicPageHandler", ...BANDERAS] as const;

const ETIQUETAS: Record<(typeof PERFIL_KEYS)[number], string> = {
  name: "nombre",
  phone: "teléfono",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  website: "sitio web",
  companyName: "nombre del estudio",
  city: "ciudad",
  province: "provincia",
  primaryColor: "color principal",
  secondaryColor: "color secundario",
  tertiaryColor: "color terciario",
  fontColor: "color de letra",
  publicPageHandler: "dirección de tu página pública",
  isPublicPageEnabled: "página pública",
  enableAlbumsPage: "sección de álbumes",
  enablePrintPage: "sección de impresiones",
};

const perfilSchema = z.strictObject({
  name: texto.optional(),
  phone: texto.optional(),
  whatsapp: texto.optional(),
  instagram: texto.optional(),
  tiktok: texto.optional(),
  facebook: texto.optional(),
  website: texto.optional(),
  companyName: texto.optional(),
  city: texto.optional(),
  province: texto.optional(),
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
  tertiaryColor: color.optional(),
  fontColor: color.optional(),
  publicPageHandler: z.string().max(60).nullable().optional().describe("Sólo letras, números y guiones"),
  isPublicPageEnabled: z.boolean().optional(),
  enableAlbumsPage: z.boolean().optional(),
  enablePrintPage: z.boolean().optional(),
});

const DESCUENTOS = [
  ["digitalDiscount5Plus", 5],
  ["digitalDiscount10Plus", 10],
  ["digitalDiscount20Plus", 20],
] as const;
const PRECIOS_KEYS = ["defaultDigitalPhotoPrice", "digitalDiscountsEnabled", ...DESCUENTOS.map(([k]) => k)] as const;

const pct = z.number().min(0).max(100).nullable();
const preciosSchema = z.strictObject({
  defaultDigitalPhotoPrice: z.number().int().positive().optional().describe("Pesos enteros (5000 = $5.000)"),
  digitalDiscountsEnabled: z.boolean().optional(),
  digitalDiscount5Plus: pct.optional(),
  digitalDiscount10Plus: pct.optional(),
  digitalDiscount20Plus: pct.optional(),
});

const MSG_HANDLER_EN_USO = "Esa dirección de página pública ya la usa otra persona. Probá con otra.";

async function handlerTomado(handler: string, userId: number): Promise<boolean> {
  const otro = await prisma.user.findFirst({
    where: { publicPageHandler: handler, id: { not: userId } },
    select: { id: true },
  });
  return Boolean(otro);
}

/** Lee los valores actuales (para deshacer) y escribe sólo en el usuario que habla. */
async function applyUserPatch(userId: number, data: Record<string, unknown>) {
  const keys = Object.keys(data);
  const prev = (await prisma.user.findUnique({
    where: { id: userId },
    select: Object.fromEntries(keys.map((k) => [k, true])),
  })) as Record<string, unknown> | null;
  await prisma.user.update({ where: { id: userId }, data });
  // Columnas de texto, número o booleano: el `before` sobrevive igual a JSON y el deshacer lo escribe tal cual.
  return Object.fromEntries(keys.map((k) => [k, prev?.[k] ?? null]));
}

function soloClaves(before: unknown, permitidas: readonly string[]): Record<string, unknown> {
  const src = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(src).filter(([k]) => permitidas.includes(k)));
}

function valorLegible(v: unknown): string {
  if (typeof v === "boolean") return v ? "activar" : "desactivar";
  if (v == null || v === "") return "(vacío)";
  return String(v);
}

export const perfilTools: BotTool[] = [
  defineTool({
    name: "actualizar_perfil",
    description:
      "Propone cambiar datos públicos del perfil: nombre, contacto, redes, colores y página pública. No toca datos de cobro (CBU, alias, CUIT, Mercado Pago), email ni contraseña.",
    kind: "write",
    input: z.strictObject({ cambios: perfilSchema }),
    describe: async ({ cambios }) => {
      const partes = PERFIL_KEYS.filter((k) => cambios[k] !== undefined).map((k) =>
        BANDERAS.includes(k as (typeof BANDERAS)[number])
          ? `${valorLegible(cambios[k])} ${ETIQUETAS[k]}`
          : `${ETIQUETAS[k]} → ${valorLegible(cambios[k])}`
      );
      return `Actualizar tu perfil: ${partes.join(", ") || "sin cambios"}.`;
    },
    run: async ({ cambios }, actor) => {
      const data: Record<string, unknown> = {};
      for (const k of TEXTOS) {
        const v = cambios[k];
        if (v !== undefined) data[k] = v?.toString().trim() || null;
      }
      for (const k of COLORES) {
        const v = cambios[k];
        if (v === undefined) continue;
        // En la ruta, null se ignora y "" borra: para el bot, null significa borrar.
        const c = normalizeHexColor(v ?? "");
        if (c.set) data[k] = c.value;
      }
      if (cambios.publicPageHandler !== undefined) {
        const h = normalizePublicPageHandler(cambios.publicPageHandler);
        if (!h.ok) return { ok: false, message: h.error };
        if (h.value && (await handlerTomado(h.value, actor.userId))) return { ok: false, message: MSG_HANDLER_EN_USO };
        data.publicPageHandler = h.value;
      }
      for (const k of BANDERAS) {
        if (cambios[k] !== undefined) data[k] = cambios[k];
      }
      if (Object.keys(data).length === 0) return { ok: false, message: "No hay cambios válidos para aplicar." };
      const before = await applyUserPatch(actor.userId, data);
      return { ok: true, message: "Listo, actualicé tu perfil.", before, after: data };
    },
    undo: async (before, actor) => {
      const data = soloClaves(before, PERFIL_KEYS);
      if (Object.keys(data).length === 0) return { ok: false, message: "No hay nada para deshacer." };
      const handler = data.publicPageHandler;
      if (typeof handler === "string" && handler && (await handlerTomado(handler, actor.userId))) {
        return { ok: false, message: "No pude volver la dirección de tu página pública: ahora la usa otra persona." };
      }
      await prisma.user.update({ where: { id: actor.userId }, data });
      return { ok: true, message: "Volví tu perfil a como estaba." };
    },
  }),
  defineTool({
    name: "actualizar_precios_por_defecto",
    description:
      "Propone cambiar los precios por defecto que se usan al crear álbumes nuevos: precio por foto digital (pesos enteros) y descuentos por cantidad. No cambia los álbumes que ya existen.",
    kind: "write",
    input: z.strictObject({ cambios: preciosSchema }),
    describe: async ({ cambios }) => {
      const partes = [
        cambios.defaultDigitalPhotoPrice !== undefined ? `foto digital a ${formatPurchaseArs(cambios.defaultDigitalPhotoPrice)}` : null,
        cambios.digitalDiscountsEnabled !== undefined ? (cambios.digitalDiscountsEnabled ? "activar los descuentos" : "desactivar los descuentos") : null,
        ...DESCUENTOS.map(([k, n]) => {
          const v = cambios[k];
          if (v === undefined) return null;
          return v ? `${v}% desde ${n} fotos` : `sin descuento desde ${n} fotos`;
        }),
      ].filter(Boolean);
      return `Precios por defecto para álbumes nuevos: ${partes.join(", ") || "sin cambios"}.`;
    },
    run: async ({ cambios }, actor) => {
      const data: Record<string, unknown> = {};
      if (cambios.defaultDigitalPhotoPrice !== undefined) {
        const cfg = await getAppConfig();
        const p = normalizeDefaultDigitalPrice(cambios.defaultDigitalPhotoPrice, cfg?.minDigitalPhotoPrice ?? 5000);
        if (!p.ok) return { ok: false, message: p.error };
        data.defaultDigitalPhotoPrice = p.value;
      }
      if (cambios.digitalDiscountsEnabled !== undefined) data.digitalDiscountsEnabled = cambios.digitalDiscountsEnabled;
      // Igual que la ruta del perfil: 0 o vacío guarda "sin descuento" (null).
      for (const [k] of DESCUENTOS) {
        if (cambios[k] !== undefined) data[k] = cambios[k] || null;
      }
      if (Object.keys(data).length === 0) return { ok: false, message: "No hay cambios para aplicar." };
      const before = await applyUserPatch(actor.userId, data);
      return { ok: true, message: "Listo. Se usan en los álbumes que crees de ahora en más.", before, after: data };
    },
    undo: async (before, actor) => {
      const data = soloClaves(before, PRECIOS_KEYS);
      if (Object.keys(data).length === 0) return { ok: false, message: "No hay nada para deshacer." };
      await prisma.user.update({ where: { id: actor.userId }, data });
      return { ok: true, message: "Volví los precios por defecto a como estaban." };
    },
  }),
];
