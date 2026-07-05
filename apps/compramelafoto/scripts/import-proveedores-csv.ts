/**
 * Import masivo de proveedores desde CSV a CommunityProfile (EVENT_VENDOR).
 * Headers normalizados (trim, lower, sin acentos, espacios colapsados) y acceso por alias.
 * Re-importa actualizando registros existentes (corrige "Sin nombre", "Otro", eventos).
 * Uso: npm run import:proveedores
 * Requiere: data/import/alboom_form_contacto_de_proveedores.csv
 */

import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function checkPrismaModels(): void {
  const p = prisma as unknown as Record<string, { upsert?: unknown; create?: unknown } | undefined>;
  if (typeof p.communityCategory?.upsert !== "function" || typeof p.communityProfile?.create !== "function") {
    console.error("❌ El cliente Prisma no tiene los modelos de Comunidad.");
    console.error("   Ejecutá primero: npx prisma generate");
    console.error("   Y si aún no aplicaste la migración: npx prisma migrate deploy");
    process.exit(1);
  }
}

const CSV_PATH = path.join(
  process.cwd(),
  "data",
  "import",
  "alboom_form_contacto_de_proveedores.csv"
);

// Normalizar texto: lower, sin acentos, espacios colapsados, trim
function normalizeKey(s: string): string {
  return (
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim() || ""
  );
}

function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sin-nombre"
  );
}

// Alias internos para columnas del CSV (header normalizado -> clave interna)
const HEADER_TO_ALIAS: Record<string, string> = {
  correo: "email",
  "evento en el que trabajaremos o trabajamos": "event",
  "instagram de la empresa": "instagram",
  "nombre y apellido": "contactName",
  "otros detalles": "otherDetails",
  rubro: "rubro",
  "enviado em": "sentAt",
  whatsapp: "whatsapp",
};

type NormalizedRow = Record<string, string>;

function buildNormalizedRows(rawRows: Record<string, string>[]): NormalizedRow[] {
  if (rawRows.length === 0) return [];
  const first = rawRows[0];
  const headerToAlias: Record<string, string> = {};
  for (const rawHeader of Object.keys(first)) {
    const norm = normalizeKey(rawHeader);
    const alias = HEADER_TO_ALIAS[norm];
    if (alias) headerToAlias[rawHeader] = alias;
  }

  return rawRows.map((row) => {
    const out: NormalizedRow = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const alias = headerToAlias[rawKey];
      if (alias && value != null) out[alias] = String(value).trim();
    }
    return out;
  });
}

// Mapeo: valor normalizado de "Rubro" en CSV -> slug de CommunityCategory (EVENT_VENDOR)
const RUBRO_TO_SLUG: Record<string, string> = {
  "animacion de fiestas/show": "animacion-show",
  "animacion show": "animacion-show",
  "cabina de fotos": "cabina-de-fotos",
  dj: "dj",
  decoracion: "decoracion-ambientacion",
  "decoracion ambientacion": "decoracion-ambientacion",
  florista: "flores-florista",
  "flores florista": "flores-florista",
  makeup: "makeup-maquillaje",
  maquillaje: "makeup-maquillaje",
  "manicura/estilista": "manicura-unas",
  "manicura estilista": "manicura-unas",
  "organizacion de eventos": "organizacion-de-eventos",
  otros: "otro",
  pasteleria: "pasteleria-mesa-dulce",
  "pasteleria mesa dulce": "pasteleria-mesa-dulce",
  "pelqueria/estilista": "peinado-peluqueria",
  "peluqueria/estilista": "peinado-peluqueria",
  "peinado peluqueria": "peinado-peluqueria",
  "plataforma 360": "plataforma-360",
  salon: "salon-quinta",
  "salon quinta": "salon-quinta",
  "tocados para el cabello": "tocados",
  tocados: "tocados",
  vestidos: "vestidos",
  zapateria: "calzado-zapateria",
  "calzado zapateria": "calzado-zapateria",
  rubro: "otro",
};

const SLUG_TO_NAME: Record<string, string> = {
  "animacion-show": "Animación / Show",
  "cabina-de-fotos": "Cabina de fotos",
  dj: "DJ",
  "decoracion-ambientacion": "Decoración / Ambientación",
  "flores-florista": "Flores / Florista",
  "makeup-maquillaje": "Makeup / Maquillaje",
  "manicura-unas": "Manicura / Uñas",
  "organizacion-de-eventos": "Organización de eventos",
  otro: "Otro",
  "pasteleria-mesa-dulce": "Pastelería / Mesa dulce",
  "peinado-peluqueria": "Peinado / Peluquería",
  "plataforma-360": "Plataforma 360",
  "salon-quinta": "Salón / Quinta",
  tocados: "Tocados",
  vestidos: "Vestidos",
  "calzado-zapateria": "Calzado / Zapatería",
};

function mapRubroToSlug(rubroRaw: string): string {
  const key = normalizeKey(rubroRaw);
  if (!key) return "otro";
  if (RUBRO_TO_SLUG[key]) return RUBRO_TO_SLUG[key];
  return slugFromName(key);
}

function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

// Extraer handle(s) de Instagram: URLs, @handle, o texto plano
function parseInstagramField(val: string): { handle: string; extraHandles: string[]; plainText: string } {
  const s = (val ?? "").trim();
  if (!s) return { handle: "", extraHandles: [], plainText: "" };
  const handles: string[] = [];
  const urlMatch = s.match(/instagram\.com\/([^/?\s]+)/gi);
  if (urlMatch) {
    urlMatch.forEach((m) => {
      const h = m.replace(/instagram\.com\//i, "").replace(/^@/, "");
      if (h && !handles.includes(h)) handles.push(h);
    });
  }
  const atMatches = s.match(/@([a-zA-Z0-9_.]+)/g);
  if (atMatches) {
    atMatches.forEach((m) => {
      const h = m.slice(1).trim();
      if (h && !handles.includes(h)) handles.push(h);
    });
  }
  const mainHandle = handles[0] ?? "";
  const extraHandles = handles.slice(1);
  const plainText = !mainHandle && !urlMatch?.length && !atMatches?.length ? s : "";
  return { handle: mainHandle, extraHandles, plainText };
}

function buildNameAndInstagram(row: NormalizedRow): { name: string; instagram: string | null; descriptionExtras: string } {
  const contactName = (row.contactName ?? "").trim();
  const email = (row.email ?? "").trim();
  const whatsappNorm = digitsOnly(row.whatsapp ?? "");
  const instagramRaw = (row.instagram ?? "").trim();

  const { handle, extraHandles, plainText } = parseInstagramField(instagramRaw);
  let name = "";
  let instagram: string | null = null;
  let descriptionExtras = "";

  if (handle) {
    name = handle.charAt(0).toUpperCase() + handle.slice(1).toLowerCase().replace(/_/g, " ");
    instagram = handle;
    if (extraHandles.length > 0) {
      descriptionExtras = "Otros IG: " + extraHandles.map((h) => "@" + h).join(" ") + "\n";
    }
  } else if (plainText) {
    name = plainText;
    instagram = null;
  }

  if (!name && contactName) name = contactName;
  if (!name && email) {
    const local = email.split("@")[0]?.trim() || "";
    if (local) name = local;
  }
  if (!name && whatsappNorm) name = `Proveedor ${whatsappNorm}`;
  if (!name) name = "Sin nombre";

  return { name, instagram, descriptionExtras };
}

async function ensureEventVendorCategory(slug: string): Promise<number> {
  const name = SLUG_TO_NAME[slug] ?? slug.replace(/-/g, " ");
  const cat = await prisma.communityCategory.upsert({
    where: { type_slug: { type: "EVENT_VENDOR", slug } },
    update: {},
    create: { type: "EVENT_VENDOR", name, slug, order: 999 },
  });
  return cat.id;
}

async function ensureEventVendorCategories(): Promise<void> {
  const slugs = new Set<string>([...Object.keys(SLUG_TO_NAME), "otro"]);
  for (const slug of slugs) {
    await ensureEventVendorCategory(slug);
  }
}

async function findUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let exists = await prisma.communityProfile.findUnique({
    where: { type_slug: { type: "EVENT_VENDOR", slug } },
  });
  if (!exists) return slug;
  slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
  exists = await prisma.communityProfile.findUnique({
    where: { type_slug: { type: "EVENT_VENDOR", slug } },
  });
  return exists ? `${baseSlug}-${Date.now()}` : slug;
}

async function main() {
  checkPrismaModels();

  if (!fs.existsSync(CSV_PATH)) {
    console.error("❌ No se encontró el archivo:", CSV_PATH);
    console.error("   Copiá el CSV a: data/import/alboom_form_contacto_de_proveedores.csv");
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rawRows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = buildNormalizedRows(rawRows);
  console.log("📂 CSV leído:", rows.length, "filas (headers normalizados por alias)");
  if (rows.length === 0) {
    console.log("   No hay filas para importar.");
    return;
  }

  await ensureEventVendorCategories();
  console.log("✅ Categorías EVENT_VENDOR listas");

  let createdCount = 0;
  let updatedCount = 0;
  let conflictCount = 0;
  let workRefsCreated = 0;
  const conflictIds: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const emailRaw = (row.email ?? "").trim();
    const whatsappRaw = (row.whatsapp ?? "").trim();
    const eventLabel = (row.event ?? "").trim();
    const rubroRaw = (row.rubro ?? "").trim();
    const otherDetails = (row.otherDetails ?? "").trim();

    const emailNormalized = emailRaw ? emailRaw.toLowerCase() : "";
    const whatsappNormalized = digitsOnly(whatsappRaw);

    if (!emailNormalized && !whatsappNormalized && !row.contactName?.trim()) {
      console.warn(`   Fila ${i + 2}: sin email, whatsapp ni nombre — se omite`);
      skipped++;
      continue;
    }

    const { name, instagram, descriptionExtras } = buildNameAndInstagram(row);
    const contactName = (row.contactName ?? "").trim() || null;
    const description = [descriptionExtras, otherDetails, eventLabel].filter(Boolean).join("\n\n").trim() || null;

    const categorySlug = mapRubroToSlug(rubroRaw);
    const categoryId = await ensureEventVendorCategory(categorySlug);

    const byEmail =
      emailNormalized
        ? await prisma.communityProfile.findUnique({
            where: { type_emailNormalized: { type: "EVENT_VENDOR", emailNormalized } },
          })
        : null;
    const byWhatsApp =
      whatsappNormalized
        ? await prisma.communityProfile.findUnique({
            where: { type_whatsappNormalized: { type: "EVENT_VENDOR", whatsappNormalized } },
          })
        : null;

    if (byEmail && byWhatsApp && byEmail.id !== byWhatsApp.id) {
      conflictCount++;
      conflictIds.push(`email→${byEmail.id} whatsapp→${byWhatsApp.id}`);
      continue;
    }

    const existing = byEmail ?? byWhatsApp;

    if (existing) {
      // Actualizar toda la información del CSV para los que ya existen
      await prisma.communityProfile.update({
        where: { id: existing.id },
        data: {
          name,
          contactName,
          email: emailRaw || null,
          emailNormalized: emailNormalized || null,
          whatsapp: whatsappRaw || null,
          whatsappNormalized: whatsappNormalized || null,
          description,
          instagram: instagram ?? null,
          status: "ACTIVE",
        },
      });

      await prisma.communityProfileCategory.deleteMany({ where: { profileId: existing.id } });
      await prisma.communityProfileCategory.create({
        data: { profileId: existing.id, categoryId },
      });

      if (eventLabel) {
        const existingRef = await prisma.communityWorkReference.findFirst({
          where: { profileId: existing.id, label: eventLabel },
        });
        if (!existingRef) {
          await prisma.communityWorkReference.create({
            data: { profileId: existing.id, label: eventLabel },
          });
          workRefsCreated++;
        }
      }
      updatedCount++;
    } else {
      const baseSlug = slugFromName(name);
      const slug = await findUniqueSlug(baseSlug);

      const created = await prisma.communityProfile.create({
        data: {
          type: "EVENT_VENDOR",
          status: "ACTIVE",
          name,
          slug,
          contactName: contactName ?? undefined,
          email: emailRaw || undefined,
          emailNormalized: emailNormalized || undefined,
          whatsapp: whatsappRaw || undefined,
          whatsappNormalized: whatsappNormalized || undefined,
          description: description ?? undefined,
          instagram: instagram ?? undefined,
          categories: { create: [{ categoryId }] },
        },
      });

      if (eventLabel) {
        await prisma.communityWorkReference.create({
          data: { profileId: created.id, label: eventLabel },
        });
        workRefsCreated++;
      }
      createdCount++;
    }
  }

  console.log("\n--- Resumen ---");
  console.log("  Creados:        ", createdCount);
  console.log("  Actualizados:   ", updatedCount);
  console.log("  Conflictos:     ", conflictCount);
  console.log("  Omitidos:       ", skipped);
  console.log("  WorkRefs nuevos:", workRefsCreated);
  if (conflictIds.length > 0) {
    console.log("  Conflictos (ids):");
    conflictIds.slice(0, 15).forEach((id) => console.log("   -", id));
    if (conflictIds.length > 15) console.log("   ... y", conflictIds.length - 15, "más");
  }
  console.log("\n✅ Import terminado.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
