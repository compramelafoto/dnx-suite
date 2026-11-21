/**
 * Textos de los correos del panel de impresiones. Funciones puras: arman asunto, texto y html;
 * el servicio (`servicio.ts`) busca los datos y los encola.
 */

export type Correo = { subject: string; body: string; htmlBody: string };
export type CopiaResumen = { medida: string; acabado: string; cantidad: number };

const BOTON =
  "display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Junta copias de la misma medida y acabado, ordenadas por medida y acabado. */
export function resumirCopias(copias: readonly CopiaResumen[]): CopiaResumen[] {
  const porClave = new Map<string, CopiaResumen>();
  for (const c of copias) {
    const clave = `${c.medida}|${c.acabado}`;
    const previa = porClave.get(clave);
    if (previa) previa.cantidad += c.cantidad;
    else porClave.set(clave, { ...c });
  }
  return [...porClave.values()].sort(
    (a, b) => a.medida.localeCompare(b.medida, "es") || a.acabado.localeCompare(b.acabado, "es"),
  );
}

function lineaDeCopia(c: CopiaResumen): string {
  return `${c.cantidad}× ${c.medida}${c.acabado ? ` ${c.acabado}` : ""}`;
}

export function correoAlLaboratorio(p: {
  nombreLote: string;
  fotografo: string;
  pedidos: number;
  copias: readonly CopiaResumen[];
  mensaje?: string | null;
  enlace: string;
  labTieneCuenta: boolean;
  labEmail: string;
  baseUrl: string;
}): Correo {
  const resumen = resumirCopias(p.copias);
  const totalCopias = resumen.reduce((s, c) => s + c.cantidad, 0);
  const mensaje = p.mensaje?.trim() || null;
  const registro = `${p.baseUrl.replace(/\/+$/, "")}/lab/registro?email=${encodeURIComponent(p.labEmail)}`;
  const invitacion =
    "Si querés ver todos tus lotes en un solo lugar, creá tu cuenta de laboratorio en CompraMeLaFoto.";
  const subject = `${p.nombreLote} de ${p.fotografo} — ${plural(p.pedidos, "pedido", "pedidos")}, ${plural(totalCopias, "copia", "copias")}`;

  const body = [
    "Hola,",
    "",
    `${p.fotografo} te mandó el ${p.nombreLote}: ${plural(p.pedidos, "pedido", "pedidos")}, ${plural(totalCopias, "copia", "copias")}.`,
    "",
    "Copias por medida y acabado:",
    ...resumen.map((c) => `- ${lineaDeCopia(c)}`),
    ...(mensaje ? ["", `Mensaje de ${p.fotografo}:`, mensaje] : []),
    "",
    `Abrir el lote: ${p.enlace}`,
    ...(p.labTieneCuenta ? [] : ["", invitacion, registro]),
    "",
    "Saludos,",
    "CompraMeLaFoto",
  ].join("\n");

  const htmlBody = [
    "<p>Hola,</p>",
    `<p><strong>${escapar(p.fotografo)}</strong> te mandó el <strong>${escapar(p.nombreLote)}</strong>: ${plural(p.pedidos, "pedido", "pedidos")}, ${plural(totalCopias, "copia", "copias")}.</p>`,
    "<p>Copias por medida y acabado:</p>",
    `<ul>${resumen.map((c) => `<li>${escapar(lineaDeCopia(c))}</li>`).join("")}</ul>`,
    mensaje
      ? `<p>Mensaje de ${escapar(p.fotografo)}:<br>${escapar(mensaje).replace(/\n/g, "<br>")}</p>`
      : "",
    `<p><a href="${escapar(p.enlace)}" style="${BOTON}">Abrir el lote</a></p>`,
    p.labTieneCuenta ? "" : `<p>${escapar(invitacion)} <a href="${escapar(registro)}">Crear mi cuenta</a></p>`,
    "<p>Saludos,<br>CompraMeLaFoto</p>",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, body, htmlBody };
}

function conFirma(frase: string): { body: string; htmlBody: string } {
  return {
    body: ["Hola,", "", frase, "", "Saludos,", "CompraMeLaFoto"].join("\n"),
    htmlBody: `<p>Hola,</p>\n<p>${escapar(frase)}</p>\n<p>Saludos,<br>CompraMeLaFoto</p>`,
  };
}

export function correoListoRetiraFotografo(p: { fotografo: string; contactoFotografo: string }): Correo {
  const frase = `${p.fotografo} ya tiene tus copias. Coordiná el retiro con él: ${p.contactoFotografo}.`;
  return { subject: "Tus copias están listas", ...conFirma(frase) };
}

export function correoListoRetiraEnLaboratorio(p: {
  fotografo: string;
  laboratorio: string;
  direccion?: string | null;
  horario?: string | null;
  cliente: string;
}): Correo {
  const donde = [p.laboratorio, p.direccion, p.horario].map((s) => s?.trim()).filter(Boolean).join(", ");
  const frase =
    `Tus copias de ${p.fotografo} están listas. Retiralas en ${donde}. ` +
    `Ya están pagas: decí que vas a buscar el pedido de ${p.fotografo} a nombre de ${p.cliente}.`;
  return { subject: "Tus copias están listas para retirar", ...conFirma(frase) };
}
