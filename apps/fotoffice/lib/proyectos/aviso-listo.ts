/**
 * El aviso de "Listo para retirar" que le llega al cliente. Módulo PURO: arma el asunto y el
 * cuerpo; el envío lo hace `aviso-listo-servidor.ts`.
 */

export type DatosAvisoListo = {
  estudio: string;
  /** Nombre de pila del cliente. */
  nombre: string;
  trabajo: string;
  /** Lo que falta pagar, en centavos (0 = pagado). */
  saldoMinor: number;
  transferencia: { alias: string | null; cbuCvu: string | null; titular: string | null; banco: string | null } | null;
  direccion: string | null;
  horario: string | null;
  contacto: string | null;
  archivos: { url: string; vence: string | null } | null;
};

function pesos(minor: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long" });
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function avisoListoParaRetirar(d: DatosAvisoListo): { subject: string; text: string; html: string } {
  const subject = `Tu pedido está listo para retirar · ${d.estudio}`;
  const bloques: { titulo: string | null; lineas: string[]; enlace?: { texto: string; url: string } }[] = [];

  bloques.push({ titulo: null, lineas: [`¡Hola ${d.nombre}! Tu pedido (${d.trabajo}) ya está listo para retirar.`] });

  if (d.saldoMinor > 0) {
    const t = d.transferencia;
    const datos = t
      ? [t.alias ? `Alias: ${t.alias}` : null, t.cbuCvu ? `CBU/CVU: ${t.cbuCvu}` : null, t.titular ? `Titular: ${t.titular}` : null, t.banco ? `Banco: ${t.banco}` : null].filter(
          (x): x is string => x !== null,
        )
      : [];
    bloques.push({
      titulo: "Saldo",
      lineas: [
        `Te queda por abonar ${pesos(d.saldoMinor)}.`,
        ...(datos.length ? ["Podés pagarlo al retirar o transferirlo antes:", ...datos] : ["Lo abonás al retirar."]),
      ],
    });
  } else {
    bloques.push({ titulo: "Saldo", lineas: ["Ya está todo pago."] });
  }

  const retiro = [d.direccion ? `Dirección: ${d.direccion}` : null, d.horario ? `Horario: ${d.horario}` : null].filter((x): x is string => x !== null);
  if (retiro.length) bloques.push({ titulo: "Dónde y cuándo retirarlo", lineas: retiro });

  if (d.archivos) {
    bloques.push({
      titulo: "Tus archivos",
      lineas: [d.archivos.vence ? `Ya podés verlos y descargarlos. Descargalos antes del ${fecha(d.archivos.vence)}: después se borran.` : "Ya podés verlos y descargarlos."],
      enlace: { texto: "Ver y descargar mis archivos", url: d.archivos.url },
    });
  }

  if (d.contacto) bloques.push({ titulo: null, lineas: [`Cualquier duda, escribinos: ${d.contacto}.`] });

  const text = [
    ...bloques.flatMap((b) => [...(b.titulo ? [`${b.titulo}:`] : []), ...b.lineas, ...(b.enlace ? [`${b.enlace.texto}: ${b.enlace.url}`] : []), ""]),
    `¡Te esperamos!`,
    d.estudio,
  ].join("\n");

  const html = `${bloques
    .map(
      (b) =>
        `${b.titulo ? `<p style="margin:16px 0 4px;font-weight:600">${escapar(b.titulo)}</p>` : ""}${b.lineas
          .map((l) => `<p style="margin:2px 0">${escapar(l)}</p>`)
          .join("")}${
          b.enlace
            ? `<p style="margin:12px 0"><a href="${escapar(b.enlace.url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:8px;text-decoration:none">${escapar(b.enlace.texto)}</a></p>`
            : ""
        }`,
    )
    .join("")}<p style="margin:16px 0 0">¡Te esperamos!<br>${escapar(d.estudio)}</p>`;

  return { subject, text, html };
}
