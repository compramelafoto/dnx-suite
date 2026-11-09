const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Comprobante único de un carrito de evento: un correo con todos los fotógrafos y un solo
 * enlace a las descargas del grupo (reemplaza al comprobante de cada pedido).
 */
export function armarComprobanteGrupo(params: {
  buyerEmail: string;
  totalPesos: number;
  /** Página del grupo: con el pago acreditado muestra las descargas de cada fotógrafo. */
  descargasUrl: string;
  eventoTitulo: string | null;
  pedidos: Array<{ pedidoId: number; fotografo: string; fotos: number; totalPesos: number }>;
}): { subject: string; text: string; html: string } {
  const nombre = params.buyerEmail.includes("@") ? params.buyerEmail.split("@")[0] : params.buyerEmail;
  const evento = params.eventoTitulo?.trim() || "el evento";
  const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);
  const lineas = params.pedidos.map(
    (p) => `- ${p.fotografo}: ${fotos(p.fotos)}, ${pesos.format(p.totalPesos)} (pedido #${p.pedidoId})`,
  );
  const total = pesos.format(params.totalPesos);

  const text = `Hola ${nombre},

Tu pago de las fotos de ${evento} se acreditó.

${lineas.join("\n")}

Total pagado: ${total}

Descargá todas tus fotos (sin iniciar sesión):
${params.descargasUrl}

Saludos,
ComprameLaFoto`;

  const html = `<p>Hola ${escapar(nombre)},</p>
<p>Tu pago de las fotos de <strong>${escapar(evento)}</strong> se acreditó.</p>
<ul>${params.pedidos
    .map(
      (p) =>
        `<li>${escapar(p.fotografo)}: ${fotos(p.fotos)}, ${pesos.format(p.totalPesos)} (pedido #${p.pedidoId})</li>`,
    )
    .join("")}</ul>
<p><strong>Total pagado:</strong> ${total}</p>
<p><a href="${escapar(params.descargasUrl)}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Descargar mis fotos</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`;

  return { subject: `Tus fotos de ${evento} están listas`, text, html };
}
