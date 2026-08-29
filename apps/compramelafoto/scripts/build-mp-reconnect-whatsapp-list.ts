/**
 * CLF-MP-OAUTH-REFRESH-100 — arma la lista de WhatsApp para avisarle a los vendedores
 * que tienen que volver a conectar Mercado Pago.
 *
 * Genera un HTML local con un link wa.me por fotógrafo y el mensaje ya escrito.
 *
 *   npx tsx scripts/build-mp-reconnect-whatsapp-list.ts [ruta-de-salida.html]
 */
import { writeFileSync } from "fs";
import { loadAnalysisEnv } from "./load-env-for-analysis";
loadAnalysisEnv();

const PANEL_URL = "https://www.compramelafoto.com/fotografo/configuracion?tab=mercadopago";

async function tokenIsValid(token: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Deja el número como lo quiere wa.me: solo dígitos, con código de país.
 *
 * Para Argentina WhatsApp exige el 9 después del 54 (54 9 área número), que casi nunca
 * está en la base: la mayoría de los teléfonos están guardados como 10 dígitos sueltos
 * (3415551234), con un 0 adelante (03415551234) o como +54 sin el 9.
 *
 * Los números de otros países (se ven +56 de Chile y +52 de México) se dejan como vinieron:
 * solo se los reconoce como internacionales si el original traía "+" o empezaba con "00".
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const original = String(raw ?? "").trim();
  if (!original) return null;

  const veniaInternacional = original.startsWith("+") || original.replace(/\D/g, "").startsWith("00");
  let digits = original.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("54")) {
    // 54 9 + 10 dígitos ya es el formato final.
    if (digits.length === 13 && digits[2] === "9") return digits;
    // 54 + 10 dígitos: falta el 9.
    if (digits.length === 12) return `549${digits.slice(2)}`;
    return null;
  }

  // Otro país: se confía solo si el original estaba escrito como internacional.
  if (veniaInternacional) {
    return digits.length >= 10 && digits.length <= 15 ? digits : null;
  }

  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `549${digits}`;
  return null;
}

/** Primer nombre, con mayúscula inicial. Si no hay nombre usable, devuelve null. */
export function firstName(name: string | null | undefined): string | null {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  if (/^\d+$/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function buildMessage(name: string | null): string {
  const saludo = name ? `Hola ${name}, ¿cómo estás?` : "Hola, ¿cómo estás?";
  return [
    `${saludo} Soy Daniel Cuart, de Comprame la Foto.`,
    "",
    "Te escribo porque Mercado Pago pide renovar cada 6 meses el permiso que nos diste para cobrar tus ventas, y el tuyo se venció. Es una disposición de Mercado Pago, no un cambio nuestro.",
    "",
    "Mientras tanto tus álbumes siguen publicados, pero quien quiere comprarte una foto recibe un error al momento de pagar. Es decir, no estás pudiendo vender.",
    "",
    "Se soluciona en un minuto y desde tu propio panel:",
    `1) Entrá a ${PANEL_URL}`,
    "2) Apretá \"Reconectar Mercado Pago\"",
    "3) Iniciá sesión en Mercado Pago y autorizá",
    "",
    "Cobrás en la misma cuenta de siempre y no perdés ninguna venta anterior. Ya dejamos el sistema preparado para que se renueve solo y no te vuelva a pasar.",
    "",
    "Cualquier duda escribime por acá y lo vemos juntos. ¡Gracias!",
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function inspect() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { mpAccessToken: { not: null } },
    select: { id: true, phone: true, whatsapp: true },
  });
  const shapes = new Map<string, number>();
  for (const u of users) {
    for (const raw of [u.whatsapp, u.phone]) {
      if (!raw) continue;
      const d = String(raw).replace(/\D/g, "");
      const key = `${String(raw).trim().slice(0, 4)}… len=${d.length}`;
      shapes.set(key, (shapes.get(key) ?? 0) + 1);
    }
  }
  for (const [k, v] of [...shapes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(v).padStart(3)}  ${k}`);
  }
  await prisma.$disconnect();
}

async function main() {
  const outPath = process.argv[2] || "mp-reconectar-whatsapp.html";
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      where: { mpAccessToken: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsapp: true,
        mpConnectedAt: true,
        mpAccessToken: true,
        _count: { select: { albums: true } },
      },
      orderBy: { id: "asc" },
    });

    const rows: Array<{
      id: number;
      nombre: string | null;
      email: string;
      albums: number;
      conecto: string;
      telefono: string | null;
      link: string | null;
    }> = [];

    for (const u of users) {
      if (await tokenIsValid(u.mpAccessToken as string)) continue;
      const nombre = firstName(u.name);
      const telefono = toWhatsAppNumber(u.whatsapp) ?? toWhatsAppNumber(u.phone);
      const mensaje = buildMessage(nombre);
      rows.push({
        id: u.id,
        nombre,
        email: u.email ?? "",
        albums: u._count.albums,
        conecto: u.mpConnectedAt ? u.mpConnectedAt.toISOString().slice(0, 10) : "?",
        telefono,
        link: telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : null,
      });
    }

    rows.sort((a, b) => b.albums - a.albums || a.id - b.id);
    const conLink = rows.filter((r) => r.link);
    const sinLink = rows.filter((r) => !r.link);

    const filas = rows
      .map((r, i) => {
        const accion = r.link
          ? `<a class="btn" href="${r.link}" target="_blank" rel="noreferrer">Abrir WhatsApp</a>`
          : `<span class="sin">sin teléfono cargado</span>`;
        return `<tr class="${r.link ? "" : "falta"}">
        <td class="num">${i + 1}</td>
        <td><strong>${escapeHtml(r.nombre ?? "(sin nombre)")}</strong><br><span class="mail">${escapeHtml(r.email)}</span></td>
        <td class="num">${r.albums}</td>
        <td class="num">${r.conecto}</td>
        <td>${r.telefono ? `+${r.telefono}` : "—"}</td>
        <td>${accion}</td>
      </tr>`;
      })
      .join("\n");

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reconectar Mercado Pago — avisos por WhatsApp</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 32px 20px; background: #f6f7f9; color: #1a1a1a; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  p.sub { color: #6b7280; margin: 0 0 24px; }
  .resumen { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
  .card b { display: block; font-size: 22px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eef0f3; font-size: 14px; vertical-align: middle; }
  th { background: #fafbfc; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  tr:last-child td { border-bottom: 0; }
  tr.falta { background: #fff8f8; }
  .num { text-align: center; white-space: nowrap; }
  .mail { color: #6b7280; font-size: 12px; }
  .btn { display: inline-block; background: #25D366; color: #fff; text-decoration: none; padding: 7px 14px; border-radius: 7px; font-weight: 600; font-size: 13px; white-space: nowrap; }
  .sin { color: #b91c1c; font-size: 13px; }
  details { margin-top: 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; color: #374151; margin: 12px 0 0; }
</style></head>
<body><div class="wrap">
<h1>Reconectar Mercado Pago</h1>
<p class="sub">Un mensaje por fotógrafo, con el nombre ya puesto. Abrí el link, revisá y mandá.</p>
<div class="resumen">
  <div class="card"><b>${rows.length}</b>hay que avisarles</div>
  <div class="card"><b>${conLink.length}</b>con WhatsApp</div>
  <div class="card"><b>${sinLink.length}</b>sin teléfono cargado</div>
</div>
<table>
<thead><tr><th>#</th><th>Fotógrafo</th><th>Álbumes</th><th>Conectó</th><th>WhatsApp</th><th></th></tr></thead>
<tbody>
${filas}
</tbody></table>
<details><summary>Ver el texto del mensaje</summary><pre>${escapeHtml(buildMessage("Nombre"))}</pre></details>
</div></body></html>`;

    writeFileSync(outPath, html, "utf8");
    console.log(`Escrito: ${outPath}`);
    console.log(`Total a avisar: ${rows.length} | con WhatsApp: ${conLink.length} | sin teléfono: ${sinLink.length}`);
    for (const r of sinLink) {
      console.log(`  SIN TELEFONO: user ${r.id} | albums ${r.albums} | ${r.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre si se lo invoca directamente: el archivo de tests importa las funciones puras.
const invocadoDirecto = /build-mp-reconnect-whatsapp-list\.ts$/.test(process.argv[1] ?? "");
if (invocadoDirecto) {
  const run = process.argv.includes("--inspect") ? inspect : main;
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
