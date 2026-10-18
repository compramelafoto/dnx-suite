/**
 * El correo de "Recibimos tu pedido" que le llega al cliente cuando se arma un pedido. Módulo
 * PURO: arma el asunto y el cuerpo; el envío lo hace `aviso-pedido-servidor.ts`.
 */

export type DatosAvisoPedido = {
  estudio: string;
  /** Nombre de pila del cliente. */
  nombre: string;
  numero: string;
  items: { nombre: string; cantidad: number }[];
  /** En centavos. */
  totalMinor: number;
  cobradoMinor: number;
  /** "aaaa-mm-dd" o null. */
  entrega: string | null;
  /** Qué es la fecha ("Entrega", "Sesión"…); null o "Entrega" = la fecha en que está listo. */
  etiquetaFecha: string | null;
  direccion: string | null;
  horario: string | null;
  contacto: string | null;
};

function pesos(minor: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

function dia(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" });
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function avisoPedidoRecibido(d: DatosAvisoPedido): { subject: string; text: string; html: string } {
  const subject = `Recibimos tu pedido ${d.numero} · ${d.estudio}`;
  const saldo = Math.max(0, d.totalMinor - d.cobradoMinor);
  const bloques: { titulo: string | null; lineas: string[] }[] = [];

  bloques.push({ titulo: null, lineas: [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Recibimos tu pedido ${d.numero}. Te dejamos el detalle:`] });
  bloques.push({ titulo: "Tu pedido", lineas: d.items.map((i) => (i.cantidad > 1 ? `${i.cantidad} × ${i.nombre}` : i.nombre)) });
  bloques.push({
    titulo: "Pago",
    lineas: [
      `Total: ${pesos(d.totalMinor)}`,
      ...(d.cobradoMinor > 0 ? [`${saldo === 0 ? "Pagado" : "Pagaste"}: ${pesos(d.cobradoMinor)}`] : []),
      saldo > 0 ? `Saldo a pagar al retirar: ${pesos(saldo)}` : "Ya está todo pago.",
    ],
  });
  if (d.entrega) {
    const esEntrega = !d.etiquetaFecha || /^entrega$/i.test(d.etiquetaFecha.trim());
    bloques.push(
      esEntrega
        ? { titulo: "Entrega", lineas: [`Va a estar listo el ${dia(d.entrega)}. Te avisamos apenas lo tengamos.`] }
        : { titulo: d.etiquetaFecha!.trim(), lineas: [`El ${dia(d.entrega)}.`] },
    );
  }
  const retiro = [d.direccion ? `Dirección: ${d.direccion}` : null, d.horario ? `Horario: ${d.horario}` : null].filter((x): x is string => x !== null);
  if (retiro.length) bloques.push({ titulo: "Dónde retirarlo", lineas: retiro });
  if (d.contacto) bloques.push({ titulo: null, lineas: [`Cualquier duda, escribinos: ${d.contacto}.`] });

  const text = [...bloques.flatMap((b) => [...(b.titulo ? [`${b.titulo}:`] : []), ...b.lineas, ""]), "¡Gracias!", d.estudio].join("\n");
  const html = `${bloques
    .map(
      (b) =>
        `${b.titulo ? `<p style="margin:16px 0 4px;font-weight:600">${escapar(b.titulo)}</p>` : ""}${b.lineas
          .map((l) => `<p style="margin:2px 0">${escapar(l)}</p>`)
          .join("")}`,
    )
    .join("")}<p style="margin:16px 0 0">¡Gracias!<br>${escapar(d.estudio)}</p>`;
  return { subject, text, html };
}
