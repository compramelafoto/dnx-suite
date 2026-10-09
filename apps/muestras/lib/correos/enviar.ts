import "server-only";
import { Resend } from "resend";
import { prisma } from "@repo/db";
import { compuertaDeEnvio } from "./compuerta";

const APP_URL = (process.env.APP_URL?.trim() || "https://muestrasfotograficas.com").replace(/\/+$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Nunca tira: un correo que no sale no puede deshacer una aprobación. */
async function enviar(to: string, subject: string, parrafos: string[], enlace?: { texto: string; url: string }) {
  const c = compuertaDeEnvio();
  if (!c.puede) {
    console.info("[muestras] correo no enviado:", c.motivo, subject);
    return;
  }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1a17">${parrafos.map((p) => `<p>${esc(p)}</p>`).join("")}${enlace ? `<p><a href="${esc(enlace.url)}" style="color:#b4432c">${esc(enlace.texto)}</a></p>` : ""}<p style="color:#6b665c;font-size:13px">Muestras Fotográficas</p></div>`;
  const text = [...parrafos, enlace ? `${enlace.texto}: ${enlace.url}` : ""].filter(Boolean).join("\n\n");
  try {
    await new Resend(c.apiKey).emails.send({ from: c.from, to, subject, html, text });
  } catch (err) {
    console.error("[muestras] falló el envío", subject, err);
  }
}

async function datos(id: string) {
  const a = await prisma.culturalActivity.findUnique({
    where: { id },
    select: { title: true, slug: true, rejectionReason: true, proposedByUserId: true },
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
      await enviar(a.email, `Nueva propuesta: ${d.title}`, [`${d.nombre ?? d.email} propuso "${d.title}".`], { texto: "Revisarla", url: `${APP_URL}/admin` });
    }
  } catch (err) {
    console.error("[muestras] falló el aviso de nueva propuesta", err);
  }
}

export async function avisarAprobada(id: string): Promise<void> {
  try {
    const d = await datos(id);
    if (!d) return;
    await enviar(d.email, `Publicamos "${d.title}"`, [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Tu actividad "${d.title}" ya está publicada en el mapa de Muestras Fotográficas.`], { texto: "Verla publicada", url: `${APP_URL}/m/${encodeURIComponent(d.slug)}` });
  } catch (err) {
    console.error("[muestras] falló el aviso de aprobación", err);
  }
}

export async function avisarRechazada(id: string): Promise<void> {
  try {
    const d = await datos(id);
    if (!d) return;
    await enviar(d.email, `Revisamos "${d.title}"`, [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Revisamos "${d.title}" y todavía no la podemos publicar.`, `Motivo: ${d.rejectionReason ?? "sin detalle"}.`, "Podés corregirla y volver a enviarla."], { texto: "Corregirla", url: `${APP_URL}/mis-muestras` });
  } catch (err) {
    console.error("[muestras] falló el aviso de rechazo", err);
  }
}
