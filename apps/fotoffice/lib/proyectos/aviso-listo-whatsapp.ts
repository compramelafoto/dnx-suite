/**
 * El aviso de "Listo para retirar" por WhatsApp. Módulo PURO: arma el texto libre (cuando el chat
 * tiene la ventana de 24 h abierta) o la plantilla de Meta (cuando está cerrada). El envío lo hace
 * `aviso-listo-servidor.ts`.
 *
 * Plantillas aprobadas en Meta (es_AR):
 * - `pedido_listo`: {{1}} nombre, {{2}} número de pedido.
 * - `pedido_listo_con_saldo`: {{1}} nombre, {{2}} número, {{3}} saldo; botón con enlace
 *   `https://fotoffice.com/{{1}}` para pagarlo.
 */
import type { Plantilla } from "@/lib/bandeja/plantilla-meta";

export type DatosListoWhatsapp = {
  /** Nombre de pila del cliente ("" si no hay). */
  nombre: string;
  trabajo: string;
  numeroPedido: string | null;
  /** Lo que falta pagar, en centavos (0 = pagado). */
  saldoMinor: number;
  /** Dirección completa del pedido, para pagar el saldo. */
  urlPago: string | null;
  horario: string | null;
  /** Enlace para ver y descargar los archivos (entregas digitales). Sólo va en el texto libre. */
  urlArchivos?: string | null;
};

const IDIOMA = "es_AR";

function pesos(minor: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

export function textoListoWhatsapp(d: DatosListoWhatsapp): string {
  const saludo = d.nombre.trim() ? `¡Hola ${d.nombre.trim()}!` : "¡Hola!";
  const partes = [`${saludo} 😊 Tu pedido (${d.trabajo}) ya está listo para retirar.`];
  if (d.saldoMinor > 0) {
    partes.push(
      d.urlPago
        ? `Te queda un saldo de ${pesos(d.saldoMinor)}: podés pagarlo al retirar o desde acá ${d.urlPago}`
        : `Te queda un saldo de ${pesos(d.saldoMinor)}, que abonás al retirar.`,
    );
  }
  if (d.urlArchivos) partes.push(`Tus archivos ya están para descargar: ${d.urlArchivos}`);
  if (d.horario?.trim()) partes.push(`Te esperamos ${d.horario.trim()}.`);
  return partes.join(" ");
}

/** La plantilla que corresponde. Con saldo hace falta el botón para pagarlo; sin él, sale la simple. */
export function plantillaListo(d: DatosListoWhatsapp, boton: string | null): Plantilla {
  const nombre = d.nombre.trim() || "¡hola";
  const numero = d.numeroPedido?.trim() || d.trabajo;
  if (d.saldoMinor > 0 && boton) {
    return { nombre: "pedido_listo_con_saldo", idioma: IDIOMA, cuerpo: [nombre, numero, pesos(d.saldoMinor)], boton };
  }
  return { nombre: "pedido_listo", idioma: IDIOMA, cuerpo: [nombre, numero] };
}

/**
 * Lo que va en el botón de la plantilla (después de `https://fotoffice.com/`): `w/<slug>/pedido/<token>`.
 * Con dominio propio el enlace no lleva `/w/<slug>`, así que se arma con el slug. null si no se puede.
 */
export function botonDelPedido(url: string, slug: string | null): string | null {
  let ruta: string;
  try {
    ruta = new URL(url).pathname;
  } catch {
    return null;
  }
  if (/^\/w\/[^/]+\/pedido\/[^/]+$/.test(ruta)) return ruta.slice(1);
  if (/^\/pedido\/[^/]+$/.test(ruta) && slug) return `w/${encodeURIComponent(slug)}${ruta}`;
  return null;
}

/** La línea que ve el estudio después de avisar. */
export function resumenDelAviso(email: string | null, whatsapp: boolean): string {
  if (email && whatsapp) return `Se le avisó por correo a ${email} y por WhatsApp.`;
  if (email) return `Se le avisó por correo a ${email}.`;
  return "Se le avisó por WhatsApp.";
}
