/**
 * Los correos de la entrega de videos (E3 y E8). Módulo PURO: arma asunto, texto y HTML; el envío
 * lo hace `servidor/entregas.ts`. Montos en "pesos" (nunca "$") y fechas en hora argentina.
 */
import { DESCARGAS_INCLUIDAS, duracionLegible, fechaArgentina, pesos } from "./entrega";

export type VideoDelCorreo = { titulo: string; duracionSeg: number | null };

export type DatosVideosListos = {
  estudio: string;
  /** Nombre de pila del cliente ("" si no hay). */
  nombre: string;
  pedidoNumero: string;
  videos: VideoDelCorreo[];
  /** Lo que falta pagar, en centavos (0 = pagado). */
  saldoMinor: number;
  /** Página pública del pedido (para pagar). null si no se pudo armar. */
  urlPedido: string | null;
  urlVideos: string;
  videosVencenAt: Date;
  cassettesVencenAt: Date;
  contacto: string | null;
  /** Cassettes que no se pudieron digitalizar, ya armados: «Cassette 7 (Cinta cortada)». Ver `lineaCorreoNoDigitalizables`. */
  noDigitalizables?: string | null;
};

export type Correo = { subject: string; text: string; html: string };

type Bloque = { titulo: string | null; lineas: string[]; enlace?: { texto: string; url: string } };

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function armar(subject: string, bloques: Bloque[], estudio: string): Correo {
  const text = [
    ...bloques.flatMap((b) => [...(b.titulo ? [`${b.titulo}:`] : []), ...b.lineas, ...(b.enlace ? [`${b.enlace.texto}: ${b.enlace.url}`] : []), ""]),
    "¡Gracias!",
    estudio,
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
    .join("")}<p style="margin:16px 0 0">¡Gracias!<br>${escapar(estudio)}</p>`;
  return { subject, text, html };
}

function saludo(nombre: string): string {
  return nombre.trim() ? `¡Hola ${nombre.trim()}!` : "¡Hola!";
}

/** E3: "Tus videos están listos". */
export function correoVideosListos(d: DatosVideosListos): Correo {
  const n = d.videos.length;
  const bloques: Bloque[] = [
    { titulo: null, lineas: [`${saludo(d.nombre)} Ya digitalizamos ${n === 1 ? "tu video" : `tus ${n} videos`} del pedido N° ${d.pedidoNumero}.`] },
    {
      titulo: n === 1 ? "Tu video" : "Tus videos",
      lineas: [
        ...d.videos.map((v) => `• ${v.titulo}${v.duracionSeg != null ? ` (${duracionLegible(v.duracionSeg)})` : ""}`),
        ...(d.noDigitalizables ? [d.noDigitalizables] : []),
      ],
    },
  ];
  if (d.saldoMinor > 0) {
    bloques.push({
      titulo: "Saldo",
      lineas: [`Te queda por pagar ${pesos(d.saldoMinor)}. Cuando esté pago, se habilitan los videos para ver y descargar.`, "Podés pagarlo con Mercado Pago o por transferencia."],
      ...(d.urlPedido ? { enlace: { texto: "Pagar el saldo", url: d.urlPedido } } : {}),
    });
  }
  bloques.push({
    titulo: "Ver y descargar",
    lineas: [
      `Tenés ${DESCARGAS_INCLUIDAS} descargas por video.`,
      `Los videos están disponibles hasta el ${fechaArgentina(d.videosVencenAt)}: después se borran.`,
    ],
    enlace: { texto: n === 1 ? "Ver mi video" : "Ver mis videos", url: d.urlVideos },
  });
  bloques.push({
    titulo: "Tus cassettes",
    lineas: [
      `Retirá tus cassettes antes del ${fechaArgentina(d.cassettesVencenAt)}: después los descartamos porque no tenemos espacio para guardarlos.`,
      "¿Querés que te los llevemos? Pedí el envío desde la página de tus videos.",
    ],
  });
  if (d.contacto) bloques.push({ titulo: null, lineas: [`Cualquier duda, escribinos: ${d.contacto}.`] });
  return armar(`${n === 1 ? "Tu video está listo" : "Tus videos están listos"} · ${d.estudio}`, bloques, d.estudio);
}

export type DatosRecordatorioVideos = {
  estudio: string;
  nombre: string;
  pedidoNumero: string;
  urlVideos: string;
  videosVencenAt: Date;
  /** Días de calendario que faltan de verdad (0 = hoy), no el umbral del aviso. */
  dias: number;
  contacto: string | null;
};

/** E8: "Tus videos se borran el dd/mm". */
export function correoRecordatorioVideos(d: DatosRecordatorioVideos): Correo {
  const cuando = d.dias <= 0 ? "hoy" : d.dias === 1 ? "mañana" : `en ${d.dias} días`;
  const bloques: Bloque[] = [
    {
      titulo: null,
      lineas: [
        `${saludo(d.nombre)} Te recordamos que los videos del pedido N° ${d.pedidoNumero} se borran ${cuando}, el ${fechaArgentina(d.videosVencenAt)}.`,
        "Si todavía no los descargaste, hacelo antes de esa fecha.",
      ],
      enlace: { texto: "Ver mis videos", url: d.urlVideos },
    },
  ];
  if (d.contacto) bloques.push({ titulo: null, lineas: [`Cualquier duda, escribinos: ${d.contacto}.`] });
  return armar(`Tus videos se borran el ${fechaArgentina(d.videosVencenAt, "corta")} · ${d.estudio}`, bloques, d.estudio);
}

export type DatosVideoAgregado = {
  estudio: string;
  nombre: string;
  pedidoNumero: string;
  /** Los videos nuevos desde el último aviso (uno o varios: un solo correo para todos). */
  videos: VideoDelCorreo[];
  urlVideos: string;
  videosVencenAt: Date;
  contacto: string | null;
};

/**
 * Videos que se convirtieron después del envío: un solo correo con todos los nuevos («Agregamos 3
 * videos a tu pedido»), el mismo enlace y el vencimiento vigente.
 */
export function correoVideoAgregado(d: DatosVideoAgregado): Correo {
  const n = d.videos.length;
  const cuantos = n === 1 ? "un video" : `${n} videos`;
  const bloques: Bloque[] = [
    {
      titulo: null,
      lineas: [
        `${saludo(d.nombre)} Agregamos ${cuantos} a tu pedido N° ${d.pedidoNumero}:`,
        ...d.videos.map((v) => `• ${v.titulo}${v.duracionSeg != null ? ` (${duracionLegible(v.duracionSeg)})` : ""}`),
        `Están disponibles hasta el ${fechaArgentina(d.videosVencenAt)}. El enlace es el mismo de antes.`,
      ],
      enlace: { texto: "Ver mis videos", url: d.urlVideos },
    },
  ];
  if (d.contacto) bloques.push({ titulo: null, lineas: [`Cualquier duda, escribinos: ${d.contacto}.`] });
  return armar(`Agregamos ${cuantos} a tu pedido · ${d.estudio}`, bloques, d.estudio);
}
