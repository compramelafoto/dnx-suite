/**
 * Nota para el correo "Ya podés descargar tu compra" cuando el pedido también trae fotos
 * impresas. Sin ella, una familia que compró en papel lee "lo que compraste ya está listo para
 * descargar" y entiende que le cobraron fotos digitales.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type NotaDeImpresas = { asunto: string; texto: string; html: string };

export function notaDeImpresas(input: {
  orderId: number;
  cantidadImpresas: number;
  fotografo: { name: string | null; email: string | null } | null;
}): NotaDeImpresas | null {
  if (!Number.isFinite(input.cantidadImpresas) || input.cantidadImpresas <= 0) return null;
  const n = Math.floor(input.cantidadImpresas);
  const quien = input.fotografo?.name?.trim() || input.fotografo?.email?.trim() || "Tu fotógrafo";
  const fotos = n === 1 ? "La foto impresa" : `Las ${n} fotos impresas`;
  const seImprimen = n === 1 ? "se imprime" : "se imprimen";
  const contacto = input.fotografo?.email?.trim()
    ? ` Si tenés una consulta, respondé este correo y le llega a ${quien}.`
    : "";

  const texto =
    `${fotos} de tu pedido ${seImprimen} en papel, como las pediste. ` +
    `Lo que podés descargar ahora es la versión digital, que viene incluida. ` +
    `${quien} te avisa para coordinar la entrega o el retiro de las impresas.${contacto}`;

  const html =
    `<p style="margin:0 0 1em;padding:10px 14px;background:#fdf6ee;border-left:3px solid #c27b3d;color:#374151;">` +
    `<strong>${escapeHtml(fotos)} de tu pedido ${seImprimen} en papel</strong>, como las pediste. ` +
    `Lo que podés descargar ahora es la versión digital, que viene incluida. ` +
    `${escapeHtml(quien)} te avisa para coordinar la entrega o el retiro de las impresas.${escapeHtml(contacto)}</p>`;

  return {
    asunto: `Ya podés descargar la versión digital - Pedido #${input.orderId}`,
    texto,
    html,
  };
}
