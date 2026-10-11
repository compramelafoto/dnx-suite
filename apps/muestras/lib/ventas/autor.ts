"use server";

import { createHash, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { prisma, type Prisma } from "@repo/db";
import {
  MAX_OFFERS_PER_WORK, SALE_SPLIT_TEXT_VERSION, copyCounts, formatArDay, offerProblems, offerTransition, splitProblems,
  type OfferData, type OfferTransitionResult,
} from "@repo/muestras";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { obrasVendibles, type ObraVendible } from "./consultas";
import { PEDIDO_PA } from "./evaluar";
import { borrarPrivado, existePrivado, leerPrivado, subirPrivado, urlDeSubida } from "./r2-privado";

/**
 * El autor vende sus obras (etapa 8, spec D8–D10, D15, D16, D24): acepta el reparto, propone
 * formatos con precio, sube el original (directo al bucket privado) y su firma escaneada. Cada
 * acción vuelve a leer la sesión y trabaja sólo con lo propio (`authorUserId = usuario.id`); lo
 * ajeno "no existe".
 */
export type ResultadoAutor = { ok: true; aviso?: string; id?: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoAutor => ({ ok: false, errores: [texto] });
const TEXTO_NO_EXISTE = "La muestra no existe.";
const SIN_SESION = error("Tenés que ingresar.");
const NO_EXISTE = error(TEXTO_NO_EXISTE);
const NO_EXISTE_FORMATO = error("Ese formato no existe.");
const MUCHOS = error("Hiciste muchos cambios seguidos. Esperá unos minutos.");
const CAMBIO = "El formato cambió mientras tanto. Recargá la página.";
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Original: JPEG, PNG o TIFF de hasta 80 MB (D15). */
const ORIGINAL_MAX_BYTES = 80 * 1024 * 1024;
const MIMES_ORIGINAL: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/tiff": "tiff" };
/** Firma escaneada: PNG o JPEG de hasta 5 MB, guardada como PNG de hasta 1200 px de ancho (D16). */
const FIRMA_MAX_BYTES = 5 * 1024 * 1024;
const FIRMA_ANCHO = 1200;
/** Un original de cámara puede tener 100 MP o más: sólo se mide (no se decodifica entero). */
const ORIGINAL_MAX_PIXELES = 400_000_000;

class Corte extends Error {}

async function sesion(que: "ofertaAutor" | "subirOriginal"): Promise<{ usuario: Usuario } | { error: ResultadoAutor }> {
  const usuario = await getUsuario();
  if (!usuario) return { error: SIN_SESION };
  if (!frenarPorUsuario(que, usuario.id).allowed) return { error: MUCHOS };
  return { usuario };
}

/** La obra, si es del autor y se puede vender (D8). Si no, `null` ("no existe"). */
async function obraPropia(activityWorkId: unknown, usuario: Usuario): Promise<{ activityId: string; obra: ObraVendible } | null> {
  if (typeof activityWorkId !== "string" || !ES_ID.test(activityWorkId)) return null;
  const aw = await prisma.culturalActivityWork.findUnique({ where: { id: activityWorkId }, select: { id: true, activityId: true } });
  if (!aw) return null;
  const obra = (await obrasVendibles(aw.activityId, usuario.id)).find((o) => o.activityWorkId === aw.id);
  return obra ? { activityId: aw.activityId, obra } : null;
}

const OFERTA = {
  id: true, activityId: true, activityWorkId: true, authorUserId: true, format: true, editionKind: true, editionSize: true, proofCount: true,
  priceArs: true, approvedPriceArs: true, paper: true, widthCm: true, heightCm: true, status: true, reviewNote: true, firstSoldAt: true,
} as const;
type Oferta = Prisma.CulturalWorkOfferGetPayload<{ select: typeof OFERTA }>;

async function ofertaPropia(id: unknown, usuario: Usuario): Promise<Oferta | null> {
  if (typeof id !== "string" || !ES_ID.test(id)) return null;
  return prisma.culturalWorkOffer.findFirst({ where: { id, authorUserId: usuario.id }, select: OFERTA });
}

/** Bloquea la oferta y la vuelve a leer: dentro de la transacción manda esta lectura. */
async function bloquearOferta(tx: Prisma.TransactionClient, id: string, usuario: Usuario): Promise<Oferta> {
  await tx.$queryRaw`SELECT id FROM "CulturalWorkOffer" WHERE id = ${id} FOR UPDATE`;
  const o = await tx.culturalWorkOffer.findFirst({ where: { id, authorUserId: usuario.id }, select: OFERTA });
  if (!o) throw new Corte("Ese formato no existe.");
  return o;
}

/** Copias que ocupan número (emitidas, anuladas y reservadas vigentes), la mayor entre prueba y real. */
async function ocupadas(tx: Prisma.TransactionClient, offerId: string, ahora: Date): Promise<number> {
  const filas = await tx.culturalEditionCopy.findMany({ where: { offerId, kind: "COPY" }, select: { id: true, number: true, status: true, reservedUntil: true, isTest: true } });
  const de = (isTest: boolean) => {
    const c = copyCounts(filas.filter((f) => f.isTest === isTest), ahora);
    return c.issued + c.voided + c.reserved;
  };
  return Math.max(de(false), de(true));
}

function refrescar(activityId: string) {
  revalidatePath(`/panel/expositor/ventas/${activityId}`);
  revalidatePath(`/panel/muestras/${activityId}/ventas`);
  revalidatePath("/panel/expositor");
}

const texto = (fd: FormData, nombre: string) => {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.trim() : "";
};
const entero = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : Number.NaN);
const medida = (s: string) => {
  const t = s.replace(",", ".");
  return /^\d{1,3}(\.\d{1,2})?$/.test(t) ? Number(t) : Number.NaN;
};

function datosDeOferta(fd: FormData): OfferData {
  const format = texto(fd, "formato");
  const editionKind = texto(fd, "edicion");
  const impresa = format === "PRINT";
  return {
    format,
    editionKind,
    editionSize: editionKind === "UNIQUE" ? 1 : entero(texto(fd, "copias")),
    proofCount: texto(fd, "pruebas") === "" ? 0 : entero(texto(fd, "pruebas")),
    priceArs: entero(texto(fd, "precio").replace(/\./g, "")),
    paper: impresa ? texto(fd, "papel") || null : null,
    widthCm: impresa ? medida(texto(fd, "ancho")) : null,
    heightCm: impresa ? medida(texto(fd, "alto")) : null,
  };
}

/** ¿Cambia algo más que el precio? (formato, edición, copias, P/A, papel o medida). */
const cambiaAlgoMasQueElPrecio = (o: Oferta, d: OfferData) =>
  o.format !== d.format || o.editionKind !== d.editionKind || o.editionSize !== d.editionSize || o.proofCount !== d.proofCount ||
  (o.paper ?? "") !== (d.paper ?? "") || o.widthCm !== d.widthCm || o.heightCm !== d.heightCm;

// ---------------------------------------------------------------------------------------------
// Reparto

/** "Acepto este reparto" (D8): guarda la versión vigente. Si cambió mientras miraba, no acepta. */
export async function aceptarReparto(fd: FormData): Promise<ResultadoAutor> {
  const s = await sesion("ofertaAutor");
  if ("error" in s) return s.error;
  const { usuario } = s;
  const activityId = texto(fd, "activityId");
  const version = entero(texto(fd, "splitVersion"));
  if (!ES_ID.test(activityId)) return NO_EXISTE;
  if ((await obrasVendibles(activityId, usuario.id)).length === 0) return NO_EXISTE;
  try {
    await prisma.$transaction(async (tx) => {
      // FOR SHARE: la organización no puede cambiar el reparto entre la lectura y la aceptación.
      await tx.$queryRaw`SELECT id FROM "CulturalSaleSetup" WHERE "activityId" = ${activityId} FOR SHARE`;
      const setup = await tx.culturalSaleSetup.findUnique({ where: { activityId } });
      if (!setup || splitProblems(setup).length) throw new Corte("La organización todavía no fijó el reparto.");
      if (version !== setup.splitVersion) throw new Corte("El reparto cambió: recargá la página.");
      const datos = {
        splitVersion: setup.splitVersion, platformFeeBps: setup.platformFeeBps, organizerBps: setup.organizerBps,
        photographerBps: setup.photographerBps, textVersion: SALE_SPLIT_TEXT_VERSION, acceptedAt: new Date(),
      };
      await tx.culturalSaleAuthorTerms.upsert({
        where: { activityId_userId: { activityId, userId: usuario.id } },
        create: { activityId, userId: usuario.id, ...datos },
        update: datos,
      });
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(activityId);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Formatos (ofertas)

/** Crear o editar un formato en borrador o con cambios pedidos (D9, D10). */
export async function guardarOferta(fd: FormData): Promise<ResultadoAutor> {
  const s = await sesion("ofertaAutor");
  if ("error" in s) return s.error;
  const { usuario } = s;
  const d = datosDeOferta(fd);
  const declara = fd.get("declaracion") === "on";
  const id = texto(fd, "id");

  if (!id) {
    const r = await obraPropia(texto(fd, "activityWorkId"), usuario);
    if (!r) return NO_EXISTE;
    const problemas = offerProblems(d, { hasFirstSale: false });
    if (problemas.length) return { ok: false, errores: problemas };
    if (d.editionKind === "LIMITED" && !declara) return error("Marcá la declaración de la edición limitada.");
    let creada = "";
    try {
      await prisma.$transaction(async (tx) => {
        // Una cola por obra: dos pedidos a la vez no pasan juntos del tope de formatos.
        await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`muestras-ofertas:${r.obra.activityWorkId}`}))) AS cola`;
        const cuantas = await tx.culturalWorkOffer.count({ where: { activityWorkId: r.obra.activityWorkId, status: { not: "WITHDRAWN" } } });
        if (cuantas >= MAX_OFFERS_PER_WORK) throw new Corte(`Cada obra puede tener hasta ${MAX_OFFERS_PER_WORK} formatos.`);
        const o = await tx.culturalWorkOffer.create({
          data: {
            activityId: r.activityId, activityWorkId: r.obra.activityWorkId, authorUserId: usuario.id, ...d,
            paper: d.paper?.trim() || null, status: "DRAFT", sortOrder: cuantas,
          },
          select: { id: true },
        });
        creada = o.id;
      }, { timeout: 15_000, maxWait: 5_000 });
    } catch (err) {
      if (err instanceof Corte) return error(err.message);
      throw err;
    }
    refrescar(r.activityId);
    return { ok: true, id: creada };
  }

  const previa = await ofertaPropia(id, usuario);
  if (!previa) return NO_EXISTE_FORMATO;
  if (!(await obraPropia(previa.activityWorkId, usuario))) return NO_EXISTE;
  try {
    await prisma.$transaction(async (tx) => {
      const o = await bloquearOferta(tx, previa.id, usuario);
      if (o.status !== "DRAFT" && o.status !== "CHANGES_REQUESTED") throw new Corte("Este formato ya fue enviado: podés cambiar el precio o retirarlo.");
      const problemas = offerProblems(d, { hasFirstSale: o.firstSoldAt != null, previous: o });
      if (problemas.length) throw new Corte(problemas.join(" "));
      if (d.editionKind === "LIMITED" && !declara) throw new Corte("Marcá la declaración de la edición limitada.");
      let approvedPriceArs = o.approvedPriceArs;
      if (d.editionSize !== o.editionSize) {
        const t = offerTransition("editEdition", o, { actor: "AUTHOR", editionSize: d.editionSize, issuedOrReserved: await ocupadas(tx, o.id, new Date()) });
        if (!t.ok) throw new Corte(t.error);
      }
      // Lo aprobado vale sólo para lo que se aprobó: cualquier otro cambio vuelve a pedir aprobación.
      if (cambiaAlgoMasQueElPrecio(o, d)) approvedPriceArs = null;
      const { count } = await tx.culturalWorkOffer.updateMany({
        where: { id: o.id, status: o.status },
        data: { ...d, paper: d.paper?.trim() || null, approvedPriceArs },
      });
      if (count === 0) throw new Corte(CAMBIO);
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(previa.activityId);
  return { ok: true, id: previa.id };
}

/** Aplica una transición del autor con la oferta bloqueada. */
async function transicionDelAutor(
  id: string,
  calcular: (o: Oferta, tx: Prisma.TransactionClient) => Promise<OfferTransitionResult> | OfferTransitionResult,
  extra: (o: Oferta) => Prisma.CulturalWorkOfferUpdateManyMutationInput = () => ({}),
  { exigeVendible = true }: { exigeVendible?: boolean } = {},
): Promise<ResultadoAutor> {
  const s = await sesion("ofertaAutor");
  if ("error" in s) return s.error;
  const { usuario } = s;
  const previa = await ofertaPropia(id, usuario);
  if (!previa) return NO_EXISTE_FORMATO;
  if (exigeVendible && !(await obraPropia(previa.activityWorkId, usuario))) return NO_EXISTE;
  try {
    await prisma.$transaction(async (tx) => {
      const o = await bloquearOferta(tx, previa.id, usuario);
      const t = await calcular(o, tx);
      if (!t.ok) throw new Corte(t.error);
      const { count } = await tx.culturalWorkOffer.updateMany({
        where: { id: o.id, status: o.status },
        data: {
          status: t.status,
          ...(t.priceArs !== undefined ? { priceArs: t.priceArs } : {}),
          ...(t.approvedPriceArs !== undefined ? { approvedPriceArs: t.approvedPriceArs } : {}),
          ...(t.editionSize !== undefined ? { editionSize: t.editionSize } : {}),
          ...extra(o),
        },
      });
      if (count === 0) throw new Corte(CAMBIO);
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(previa.activityId);
  return { ok: true };
}

/** Enviar a la organización (vuelve a validar todo). */
export async function proponerOferta(id: string): Promise<ResultadoAutor> {
  return transicionDelAutor(id, (o) => {
    const problemas = offerProblems(o, { hasFirstSale: false });
    if (problemas.length) return { ok: false, error: problemas.join(" ") };
    return offerTransition("propose", o, { actor: "AUTHOR" });
  }, () => ({ proposedAt: new Date() }));
}

/** Cambiar el precio: de una aprobada, vuelve a revisión y sigue vendiendo al precio aprobado (D10). */
export async function cambiarPrecio(id: string, precio: number): Promise<ResultadoAutor> {
  return transicionDelAutor(id, (o) => offerTransition("changePrice", o, { actor: "AUTHOR", newPriceArs: precio }), () => ({ proposedAt: new Date() }));
}

/** Retirar: deja de venderse; si ya vendió, la edición queda cerrada. */
export async function retirarOferta(id: string): Promise<ResultadoAutor> {
  return transicionDelAutor(id, (o) => offerTransition("withdraw", o, { actor: "AUTHOR" }), () => ({}), { exigeVendible: false });
}

/**
 * Pedir las pruebas de autor (D24): queda visible para la organización en la nota del formato, con
 * el prefijo "Pedido de P/A:" (sin tabla nueva). La organización las emite desde su panel.
 */
export async function pedirPruebaDeAutor(offerId: string): Promise<ResultadoAutor> {
  return transicionDelAutor(offerId, async (o, tx) => {
    if (o.proofCount <= 0) return { ok: false, error: "Este formato no tiene pruebas de autor." };
    if (o.status !== "APPROVED" && o.status !== "PAUSED") return { ok: false, error: "Las pruebas de autor se piden cuando el formato está aprobado." };
    const emitidas = await tx.culturalEditionCopy.count({ where: { offerId: o.id, kind: "PROOF", status: { in: ["ISSUED", "VOIDED"] } } });
    if (emitidas >= o.proofCount) return { ok: false, error: "Ya se emitieron todas las pruebas de autor." };
    return { ok: true, status: o.status as "APPROVED" | "PAUSED" };
  }, () => ({ reviewNote: `${PEDIDO_PA} el autor pidió sus pruebas de autor el ${formatArDay(new Date())}.` }));
}

// ---------------------------------------------------------------------------------------------
// Archivo original (D15)

/** ¿La obra ya vendió copias reales? Entonces el original queda fijo (el certificado cita su huella). */
async function yaVendio(tx: Prisma.TransactionClient, activityWorkId: string): Promise<boolean> {
  const n = await tx.culturalEditionCopy.count({
    where: { isTest: false, status: { in: ["ISSUED", "VOIDED"] }, offer: { activityWorkId } },
  });
  return n > 0;
}

const YA_VENDIO = "Esta obra ya vendió copias: el original no se puede cambiar.";
const claveDeOriginal = (userId: number, activityWorkId: string) =>
  `originales/${userId}/${activityWorkId}-${Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[randomInt(36)]).join("")}`;
const CLAVE_ORIGINAL = (userId: number, activityWorkId: string) => new RegExp(`^originales/${userId}/${activityWorkId}-[a-z0-9]{12}$`);

/**
 * La URL firmada (10 minutos) para subir el original directo al bucket privado: Vercel no acepta
 * cuerpos de más de 4,5 MB. No toca la base: el original anterior sigue valiendo hasta confirmar.
 */
export async function pedirSubidaDeOriginal(activityWorkId: string, archivo: { mime: string; bytes: number }): Promise<{ ok: true; url: string; clave: string } | { ok: false; errores: string[] }> {
  const s = await sesion("subirOriginal");
  if ("error" in s) return s.error as { ok: false; errores: string[] };
  const { usuario } = s;
  const mime = typeof archivo?.mime === "string" ? archivo.mime : "";
  const bytes = archivo?.bytes;
  if (!MIMES_ORIGINAL[mime]) return { ok: false, errores: ["El original tiene que ser JPEG, PNG o TIFF."] };
  if (!Number.isInteger(bytes) || bytes <= 0) return { ok: false, errores: ["El archivo está vacío."] };
  if (bytes > ORIGINAL_MAX_BYTES) return { ok: false, errores: ["El original puede pesar hasta 80 MB."] };
  const r = await obraPropia(activityWorkId, usuario);
  if (!r) return { ok: false, errores: [TEXTO_NO_EXISTE] };
  if (await yaVendio(prisma, r.obra.activityWorkId)) return { ok: false, errores: [YA_VENDIO] };
  const clave = claveDeOriginal(usuario.id, r.obra.activityWorkId);
  try {
    return { ok: true, url: await urlDeSubida(clave, mime, bytes), clave };
  } catch (err) {
    console.error("[muestras][ventas] url de subida:", err instanceof Error ? err.message : String(err));
    return { ok: false, errores: ["No pudimos preparar la subida. Probá de nuevo en unos minutos."] };
  }
}

/**
 * Después del `PUT`: lee el archivo, calcula su SHA-256, lo mide y lo marca listo (o rechazado, con
 * el motivo). Si ya había un original listo y el nuevo no sirve, queda el anterior.
 */
export async function confirmarOriginal(activityWorkId: string, clave: string): Promise<ResultadoAutor> {
  const s = await sesion("subirOriginal");
  if ("error" in s) return s.error;
  const { usuario } = s;
  const r = await obraPropia(activityWorkId, usuario);
  if (!r) return NO_EXISTE;
  const awId = r.obra.activityWorkId;
  if (typeof clave !== "string" || !CLAVE_ORIGINAL(usuario.id, awId).test(clave)) return error("No encontramos el archivo subido. Probá de nuevo.");
  const meta = await existePrivado(clave).catch(() => null);
  if (!meta) return error("No encontramos el archivo subido. Probá de nuevo.");
  if (meta.bytes > ORIGINAL_MAX_BYTES) {
    await borrarPrivado(clave).catch(() => {});
    return error("El original puede pesar hasta 80 MB.");
  }
  const bytes = await leerPrivado(clave);
  if (!bytes) return error("No encontramos el archivo subido. Probá de nuevo.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let medido: { mime: string; widthPx: number; heightPx: number } | null = null;
  try {
    const m = await sharp(bytes, { limitInputPixels: ORIGINAL_MAX_PIXELES }).metadata();
    const mime = Object.entries(MIMES_ORIGINAL).find(([, f]) => f === m.format)?.[0];
    if (mime && m.width && m.height) medido = { mime, widthPx: m.width, heightPx: m.height };
  } catch {
    medido = null;
  }
  const problema = medido ? null : "No es una imagen JPEG, PNG o TIFF válida.";
  let anterior: string | null = null;
  let conservado = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CulturalSaleFile" WHERE "activityWorkId" = ${awId} FOR UPDATE`;
      if (await yaVendio(tx, awId)) throw new Corte(YA_VENDIO);
      const previo = await tx.culturalSaleFile.findUnique({ where: { activityWorkId: awId }, select: { storageKey: true, status: true, authorUserId: true } });
      if (previo && previo.authorUserId !== usuario.id) throw new Corte(TEXTO_NO_EXISTE);
      if (!medido && previo?.status === "READY") {
        conservado = true;
        return;
      }
      anterior = previo && previo.storageKey !== clave ? previo.storageKey : null;
      const datos = {
        storageKey: clave, sha256: medido ? sha256 : null, bytes: bytes.length, mime: medido?.mime ?? null,
        widthPx: medido?.widthPx ?? null, heightPx: medido?.heightPx ?? null, status: medido ? "READY" : "REJECTED", problem: problema,
        uploadedAt: new Date(),
      };
      await tx.culturalSaleFile.upsert({
        where: { activityWorkId: awId },
        create: { activityWorkId: awId, activityId: r.activityId, authorUserId: usuario.id, ...datos },
        update: datos,
      });
    }, { timeout: 20_000, maxWait: 5_000 });
  } catch (err) {
    await borrarPrivado(clave).catch(() => {});
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  // A mejor esfuerzo: el archivo que quedó sin uso.
  const sobra = conservado ? clave : anterior;
  if (sobra) await borrarPrivado(sobra).catch(() => {});
  refrescar(r.activityId);
  if (problema) return error(conservado ? `${problema} Quedó el original anterior.` : problema);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Firma escaneada (D16)

/** Una vez para todas sus muestras: recorta los bordes blancos y guarda un PNG en el bucket privado. */
export async function guardarFirma(fd: FormData): Promise<ResultadoAutor> {
  const s = await sesion("subirOriginal");
  if ("error" in s) return s.error;
  const { usuario } = s;
  const archivo = fd.get("firma");
  if (!(archivo instanceof Blob) || archivo.size === 0) return error("Elegí la imagen de tu firma.");
  if (archivo.size > FIRMA_MAX_BYTES) return error("La firma puede pesar hasta 5 MB.");
  if (archivo.type !== "image/png" && archivo.type !== "image/jpeg") return error("La firma tiene que ser PNG o JPEG.");
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await archivo.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate()
      .flatten({ background: "#ffffff" })
      .trim({ background: "#ffffff", threshold: 30 })
      .resize({ width: FIRMA_ANCHO, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return error("No pudimos leer la imagen de tu firma. Probá con otra foto o un escaneo.");
  }
  const clave = `firmas/${usuario.id}.png`;
  await subirPrivado(clave, png, "image/png");
  await prisma.culturalAuthorSignature.upsert({
    where: { userId: usuario.id },
    create: { userId: usuario.id, storageKey: clave },
    update: { storageKey: clave },
  });
  revalidatePath("/panel/expositor", "layout");
  return { ok: true };
}
