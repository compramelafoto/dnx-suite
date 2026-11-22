import "server-only";
import { Resend } from "resend";
import { prisma } from "@repo/db";
import { baseUrlPublica } from "@/lib/fichas/base-publica";
import { MARCAS, marcaDeDisciplina, type MarcaId } from "@/lib/marca";
import { compuertaDeEnvio } from "./compuerta";

/** Sólo para lo que no es de una muestra (la revisión del super admin). */
export const APP_URL = (process.env.APP_URL?.trim() || "https://muestrasfotograficas.com").replace(/\/+$/, "");

/**
 * La dirección de los enlaces de un correo sobre una muestra: la de su casa. Fotografía, la de
 * siempre (`APP_URL`); arte, muestrasdearte.com.
 */
export function origenDeCorreo(primaryDiscipline: string | null | undefined): string {
  return marcaDeDisciplina(primaryDiscipline).id === "ARTE" ? baseUrlPublica(process.env, primaryDiscipline) : APP_URL;
}

/**
 * El remitente con el nombre de la marca. Fotografía, tal cual está en `MUESTRAS_EMAIL_FROM`; arte,
 * «Muestras de Arte» con la misma dirección.
 */
export function remitente(from: string, marca: MarcaId = "FOTOGRAFIA"): string {
  if (marca === "FOTOGRAFIA") return from;
  const direccion = /<([^<>]+)>\s*$/.exec(from)?.[1]?.trim() || from.trim();
  return `${MARCAS[marca].nombre} <${direccion}>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Mensaje = {
  to: string; subject: string; parrafos: string[]; enlace?: { texto: string; url: string };
  /** La marca de la muestra del correo (firma y remitente). Sin ella, fotografía. */
  marca?: MarcaId;
};

function armar(m: Mensaje) {
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1a17">${m.parrafos.map((p) => `<p>${esc(p)}</p>`).join("")}${m.enlace ? `<p><a href="${esc(m.enlace.url)}" style="color:#b4432c">${esc(m.enlace.texto)}</a></p>` : ""}<p style="color:#6b665c;font-size:13px">${esc(MARCAS[m.marca ?? "FOTOGRAFIA"].nombre)}</p></div>`;
  const text = [...m.parrafos, m.enlace ? `${m.enlace.texto}: ${m.enlace.url}` : ""].filter(Boolean).join("\n\n");
  return { html, text };
}

/**
 * Nunca tira: un correo que no sale no puede deshacer una aprobación. Devuelve `true` sólo si
 * Resend aceptó el correo (compuerta cerrada, rechazo o caída devuelven `false`).
 */
export async function enviar(to: string, subject: string, parrafos: string[], enlace?: { texto: string; url: string }, marca: MarcaId = "FOTOGRAFIA"): Promise<boolean> {
  const c = compuertaDeEnvio();
  if (!c.puede) {
    console.info("[muestras] correo no enviado:", c.motivo, subject);
    return false;
  }
  try {
    // El SDK no tira ante un rechazo de Resend: lo devuelve en `error`.
    const r = await new Resend(c.apiKey).emails.send({ from: remitente(c.from, marca), to, subject, ...armar({ to, subject, parrafos, enlace, marca }) });
    if (r?.error) {
      console.error("[muestras] Resend rechazó el correo", subject, r.error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[muestras] falló el envío", subject, err);
    return false;
  }
}

export type ResultadoDeLote = {
  /** false si la compuerta está cerrada: no se intentó mandar nada. */
  compuerta: boolean;
  total: number;
  /** Cuántos aceptó Resend (los lotes rechazados o caídos no suman). */
  aceptados: number;
};

/**
 * Muchos correos de una vez (cierre de convocatoria, resultados): de a 100 por pedido, que es el
 * tope del envío en lote de Resend. Uno por uno, 300 participantes pasarían el tiempo máximo de
 * la función. Nunca tira; dice cuántos salieron para que quien llama pueda reintentar.
 */
export async function enviarEnLote(mensajes: readonly Mensaje[]): Promise<ResultadoDeLote> {
  const total = mensajes.length;
  if (total === 0) return { compuerta: true, total, aceptados: 0 };
  const c = compuertaDeEnvio();
  if (!c.puede) {
    console.info("[muestras] lote no enviado:", c.motivo, total);
    return { compuerta: false, total, aceptados: 0 };
  }
  let aceptados = 0;
  try {
    const resend = new Resend(c.apiKey);
    for (let i = 0; i < total; i += 100) {
      const tanda = mensajes.slice(i, i + 100);
      try {
        // El SDK no tira ante un rechazo de Resend: lo devuelve en `error`.
        const { error } = await resend.batch.send(tanda.map((m) => ({ from: remitente(c.from, m.marca), to: m.to, subject: m.subject, ...armar(m) })));
        if (error) console.error("[muestras] Resend rechazó un lote", i, error.message);
        else aceptados += tanda.length;
      } catch (err) {
        console.error("[muestras] falló un lote", i, err);
      }
    }
  } catch (err) {
    console.error("[muestras] falló el envío en lote", err);
  }
  return { compuerta: true, total, aceptados };
}

async function datos(id: string) {
  const a = await prisma.culturalActivity.findUnique({
    where: { id },
    select: { title: true, slug: true, rejectionReason: true, proposedByUserId: true, primaryDiscipline: true },
  });
  if (!a) return null;
  const u = await prisma.user.findUnique({ where: { id: a.proposedByUserId }, select: { email: true, name: true } });
  return u ? { ...a, email: u.email, nombre: u.name } : null;
}

export async function avisarNuevaPropuesta(id: string): Promise<void> {
  try {
    const d = await datos(id);
    if (!d) return;
    // Mismo criterio que isGlobalSuperAdmin: rol global o rol heredado.
    const admins = await prisma.user.findMany({
      where: { OR: [{ globalRole: "SUPER_ADMIN" }, { role: "SUPER_ADMIN" }] },
      select: { email: true },
    });
    for (const a of admins) {
      await enviar(a.email, `Nueva propuesta: ${d.title}`, [`${d.nombre ?? d.email} propuso "${d.title}".`], { texto: "Revisarla", url: `${APP_URL}/panel/revision` });
    }
  } catch (err) {
    console.error("[muestras] falló el aviso de nueva propuesta", err);
  }
}

export async function avisarAprobada(id: string): Promise<void> {
  try {
    const d = await datos(id);
    if (!d) return;
    const marca = marcaDeDisciplina(d.primaryDiscipline);
    await enviar(d.email, `Publicamos "${d.title}"`, [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Tu actividad "${d.title}" ya está publicada en el mapa de ${marca.nombre}.`], { texto: "Verla publicada", url: `${origenDeCorreo(d.primaryDiscipline)}/m/${encodeURIComponent(d.slug)}` }, marca.id);
  } catch (err) {
    console.error("[muestras] falló el aviso de aprobación", err);
  }
}

export async function avisarRechazada(id: string): Promise<void> {
  try {
    const d = await datos(id);
    if (!d) return;
    await enviar(d.email, `Revisamos "${d.title}"`, [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Revisamos "${d.title}" y todavía no la podemos publicar.`, `Motivo: ${d.rejectionReason ?? "sin detalle"}.`, "Podés corregirla y volver a enviarla."], { texto: "Corregirla", url: `${origenDeCorreo(d.primaryDiscipline)}/panel/muestras` }, marcaDeDisciplina(d.primaryDiscipline).id);
  } catch (err) {
    console.error("[muestras] falló el aviso de rechazo", err);
  }
}
