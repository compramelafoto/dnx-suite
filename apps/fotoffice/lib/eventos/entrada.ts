import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { escapeHtml, C, FUENTE } from "@/lib/communications/html";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { deleteFotofficeR2Object, isFotofficeR2Configured, uploadToFotofficeR2 } from "@/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { sniffImageFormat } from "@/lib/images/validation";
import { correoValido } from "@/lib/plantillas/contexto";
import { resolverClaveDeEnlace } from "@/lib/presupuestos/enlace";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { rutaDeEntrada, tokenDeEntrada, tokenDeEntradaValido, urlDelSitio } from "./enlace";
import { FORMATOS_FOTO_INSCRIPTO, LADO_MAX_FOTO_INSCRIPTO, LADO_MIN_FOTO_INSCRIPTO } from "./inscripcion";
import { fechaDeEvento } from "./reglas";

/**
 * "Mi entrada": el enlace personal de cada inscripto. Desde ahí completa sus datos, sube la foto,
 * ve el QR de su credencial y baja su placa de bienvenida. Es lo que en Clickatón era la página de
 * la inscripción confirmada, con el acceso por token del correo.
 */

export type EntradaLeida = Prisma.FotofficeEventoInscriptoGetPayload<{ include: { evento: true } }>;

function origenDeLaApp(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
}

/** El inscripto de ese código, si el token es el suyo. null para cualquier otra cosa. */
export async function leerEntrada(workspaceId: string, codigo: string, token: unknown): Promise<EntradaLeida | null> {
  const clave = resolverClaveDeEnlace();
  if (!clave || !/^[A-Za-z0-9]{6,10}$/.test(codigo)) return null;
  const i = await prisma.fotofficeEventoInscripto.findFirst({
    where: { workspaceId, codigo: codigo.toUpperCase() },
    include: { evento: true },
  });
  if (!i || !tokenDeEntradaValido(i.id, token, clave)) return null;
  return i;
}

/** La dirección completa del enlace personal, o null si no hay clave o la institución no tiene sitio. */
export async function urlDeEntrada(workspaceId: string, inscripto: { id: string; codigo: string }): Promise<string | null> {
  const clave = resolverClaveDeEnlace();
  if (!clave) return null;
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio) return null;
  return urlDelSitio({
    customDomain: sitio.customDomain,
    appOrigin: origenDeLaApp(),
    slug: sitio.slug,
    ruta: rutaDeEntrada(inscripto.codigo, tokenDeEntrada(inscripto.id, clave)),
  });
}

/**
 * Arma las direcciones de muchos inscriptos de una vez (el listado del panel): lee el sitio una sola
 * vez. Devuelve null si no hay clave o la institución no tiene sitio.
 */
export async function armadorDeUrlsDeEntrada(workspaceId: string): Promise<((i: { id: string; codigo: string }) => string | null) | null> {
  const clave = resolverClaveDeEnlace();
  const sitio = clave ? await sitioDelWorkspace(workspaceId) : null;
  if (!clave || !sitio) return null;
  return (i) =>
    urlDelSitio({
      customDomain: sitio.customDomain,
      appOrigin: origenDeLaApp(),
      slug: sitio.slug,
      ruta: rutaDeEntrada(i.codigo, tokenDeEntrada(i.id, clave)),
    });
}

/** La ruta relativa (para enlazar dentro del mismo sitio). */
export function rutaRelativaDeEntrada(inscripto: { id: string; codigo: string }): string | null {
  const clave = resolverClaveDeEnlace();
  return clave ? rutaDeEntrada(inscripto.codigo, tokenDeEntrada(inscripto.id, clave)) : null;
}

export type ResultadoFoto = { ok: true; url: string; key: string } | { ok: false; error: string };

const MENSAJE_FOTO_INVALIDA = "El archivo no es una foto JPG, PNG o WebP válida.";
const MAX_BYTES = 3.8 * 1024 * 1024;

/**
 * Sube la foto del inscripto. Llega dentro del envío (el navegador ya la achicó). Se revisa la firma
 * binaria, se endereza según el EXIF, se achica a 1600 px y se guarda en JPEG con una key que arma
 * el servidor: `fotoffice/evento-inscriptos/<workspaceId>/<uuid>.jpg`.
 */
export async function guardarFotoInscripto(workspaceId: string, archivo: File): Promise<ResultadoFoto> {
  if (!(FORMATOS_FOTO_INSCRIPTO as readonly string[]).includes(archivo.type)) return { ok: false, error: MENSAJE_FOTO_INVALIDA };
  if (archivo.size > MAX_BYTES) return { ok: false, error: "La foto es muy pesada; probá con otra." };
  if (!isFotofficeR2Configured()) return { ok: false, error: "Ahora no se pueden subir fotos. Probá más tarde." };
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const tipo = sniffImageFormat(bytes.subarray(0, 16));
  if (!tipo || !(FORMATOS_FOTO_INSCRIPTO as readonly string[]).includes(tipo)) return { ok: false, error: MENSAJE_FOTO_INVALIDA };

  let jpeg: Buffer;
  try {
    const { default: sharp } = await import("sharp");
    const img = sharp(bytes, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const lado = Math.min(meta.autoOrient?.width ?? meta.width ?? 0, meta.autoOrient?.height ?? meta.height ?? 0);
    if (lado > 0 && lado < LADO_MIN_FOTO_INSCRIPTO) {
      return { ok: false, error: `La foto es muy chica: necesitamos al menos ${LADO_MIN_FOTO_INSCRIPTO} px de lado.` };
    }
    jpeg = await img
      .resize({ width: LADO_MAX_FOTO_INSCRIPTO, height: LADO_MAX_FOTO_INSCRIPTO, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch {
    return { ok: false, error: MENSAJE_FOTO_INVALIDA };
  }

  const key = `${FOTOFFICE_R2_PREFIXES.eventoInscriptoPhoto}/${workspaceId.replace(/[^a-zA-Z0-9_-]/g, "")}/${randomUUID()}.jpg`;
  try {
    const r = await uploadToFotofficeR2(jpeg, key, "image/jpeg");
    return { ok: true, url: r.url, key: r.key };
  } catch (err) {
    console.error("[fotoffice][eventos] no se pudo subir la foto del inscripto", { error: (err as { name?: string })?.name ?? "desconocido" });
    return { ok: false, error: "No pudimos guardar la foto. Probá de nuevo." };
  }
}

/** Borra una foto reemplazada. Nunca lanza. */
export async function borrarFotoInscripto(key: string | null): Promise<void> {
  if (!key) return;
  try {
    await deleteFotofficeR2Object(key);
  } catch {
    // Una foto huérfana en el bucket no rompe nada.
  }
}

/**
 * Manda a cada inscripto (con correo) el enlace a su entrada: uno por dirección, con todas sus
 * entradas juntas (quien compró tres recibe un solo correo con los tres enlaces). Marca
 * `enlaceEnviadoAt`; con `soloSinEnviar` no repite a quien ya lo recibió. Nunca lanza.
 */
export async function enviarEnlacesDeEntrada(input: {
  workspaceId: string;
  eventoId?: string;
  storeOrderId?: string;
  inscriptoIds?: string[];
  soloSinEnviar: boolean;
}): Promise<{ enviados: number; fallidos: number }> {
  let enviados = 0;
  let fallidos = 0;
  try {
    const filas = await prisma.fotofficeEventoInscripto.findMany({
      where: {
        workspaceId: input.workspaceId,
        estadoPago: { not: "ANULADO" },
        email: { not: null },
        ...(input.eventoId ? { eventoId: input.eventoId } : {}),
        ...(input.storeOrderId ? { storeOrderId: input.storeOrderId } : {}),
        ...(input.inscriptoIds ? { id: { in: input.inscriptoIds } } : {}),
        ...(input.soloSinEnviar ? { enlaceEnviadoAt: null } : {}),
      },
      include: { evento: { select: { nombre: true, fechaInicio: true, fechaFin: true, lugar: true, archivado: true } } },
      orderBy: [{ createdAt: "asc" }, { unidad: "asc" }],
      take: 500,
    });
    const vigentes = filas.filter((f) => !f.evento.archivado && correoValido(f.email));
    if (vigentes.length === 0) return { enviados, fallidos };

    const sitio = await sitioDelWorkspace(input.workspaceId);
    const sender = await loadWorkspaceSender(input.workspaceId);
    const organizacion = sitio?.nombre ?? "La organización";

    const porCorreo = new Map<string, typeof vigentes>();
    for (const f of vigentes) {
      const k = f.email!.toLowerCase();
      porCorreo.set(k, [...(porCorreo.get(k) ?? []), f]);
    }

    for (const [correo, propias] of porCorreo) {
      const enlaces: { f: (typeof propias)[number]; url: string }[] = [];
      for (const f of propias) {
        const url = await urlDeEntrada(input.workspaceId, f);
        if (url) enlaces.push({ f, url });
      }
      if (enlaces.length === 0) continue;
      const evento = enlaces[0].f.evento;
      const cuando = [fechaDeEvento(evento.fechaInicio, evento.fechaFin), evento.lugar].filter(Boolean).join(" · ");
      const varias = enlaces.length > 1;
      const asunto = `Tu entrada a ${evento.nombre}: completá tu inscripción`;
      const lineas = [
        `Hola, ${enlaces[0].f.nombre.split(" ")[0]}:`,
        `Ya tenés ${varias ? `${enlaces.length} entradas` : "tu entrada"} a ${evento.nombre}${cuando ? ` (${cuando})` : ""}.`,
        `Para terminar la inscripción ${varias ? "abrí cada enlace" : "abrí este enlace"}, completá los datos y subí una foto: con ella armamos tu credencial con QR y tu placa de bienvenida.`,
      ];
      const botones = enlaces
        .map(
          ({ f, url }, n) =>
            `<p style="margin:16px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${C.tinta};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(varias ? `Entrada ${n + 1}${f.tipo ? ` · ${f.tipo}` : ""}` : "Completar mi inscripción")}</a></p>`,
        )
        .join("");
      const html = `<div style="font-family:${FUENTE};color:${C.cuerpo};font-size:15px;line-height:1.5;max-width:560px">${lineas
        .map((l) => `<p>${escapeHtml(l)}</p>`)
        .join("")}${botones}<p style="color:${C.apagado};font-size:13px">El enlace es personal: no lo compartas. En la puerta vas a mostrar el QR que aparece ahí.</p><p>${escapeHtml(organizacion)}</p></div>`;
      const text = [...lineas, "", ...enlaces.map(({ url }) => url), "", "El enlace es personal: no lo compartas.", organizacion].join("\n");

      const r = await sendTransactionalEmail({
        to: correo,
        subject: asunto,
        html,
        text,
        sender,
        idempotencyKey: `evento-entrada:${enlaces.map(({ f }) => f.id).join(",")}`.slice(0, 250),
      });
      if (r.status === "SENT") {
        enviados++;
        await prisma.fotofficeEventoInscripto.updateMany({
          where: { id: { in: enlaces.map(({ f }) => f.id) }, workspaceId: input.workspaceId },
          data: { enlaceEnviadoAt: new Date() },
        });
      } else {
        fallidos++;
        console.error("[fotoffice][eventos] no salió el correo con la entrada", { estado: r.status });
      }
    }
  } catch (error) {
    console.error("[fotoffice][eventos] falló el envío de enlaces de entrada", {
      detalle: error instanceof Error ? error.message : "desconocido",
    });
  }
  return { enviados, fallidos };
}
