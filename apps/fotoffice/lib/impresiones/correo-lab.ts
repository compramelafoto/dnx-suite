export type DatosCorreoLab = {
  estudio: string; laboratorio: string; numero: number; cliente: string; enlace: string; vence: string;
  resumen: { tamano: string; papel: string; cantidad: number }[]; prueba: boolean;
};

/** Escapa texto para meterlo en HTML. Se exporta: otros correos lo reutilizan. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fecha = (ymd: string) => ymd.split("-").reverse().join("/");

export function correoPedidoLab(d: DatosCorreoLab) {
  const total = d.resumen.reduce((s, r) => s + r.cantidad, 0);
  const subject = `${d.prueba ? "[PRUEBA] " : ""}Pedido ${d.numero} – PARA MAÑANA – ${d.cliente}`;
  const filas = d.resumen.map((r) => `- ${r.tamano} ${r.papel}: ${r.cantidad}`).join("\n");
  const text = [
    `Hola, ${d.laboratorio}:`,
    "",
    `${d.estudio} les envía el pedido ${d.numero}, para entregar MAÑANA.`,
    `Rotular el sobre: ${d.cliente}`,
    "",
    filas,
    `Total: ${total} ${total === 1 ? "copia" : "copias"}`,
    "",
    `Descargar los archivos (una carpeta ya ordenada por tamaño, papel y cantidad):`,
    d.enlace,
    `El enlace vence el ${fecha(d.vence)}.`,
    "",
    "Gracias.",
  ].join("\n");
  const html = `<p>Hola, ${esc(d.laboratorio)}:</p>
<p>${esc(d.estudio)} les envía el pedido <strong>${d.numero}</strong>, para entregar <strong>MAÑANA</strong>.<br>Rotular el sobre: <strong>${esc(d.cliente)}</strong></p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">
<tr><th align="left">Tamaño</th><th align="left">Papel</th><th align="right">Copias</th></tr>
${d.resumen.map((r) => `<tr><td>${esc(r.tamano)}</td><td>${esc(r.papel)}</td><td align="right">${r.cantidad}</td></tr>`).join("")}
<tr><td colspan="2"><strong>Total</strong></td><td align="right"><strong>${total}</strong></td></tr>
</table>
<p><a href="${esc(d.enlace)}">Descargar los archivos</a> — una carpeta ya ordenada por tamaño, papel y cantidad. Vence el ${fecha(d.vence)}.</p>
<p>Gracias.</p>`;
  return { subject, text, html };
}
