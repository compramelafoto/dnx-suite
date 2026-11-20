import { waIdDe } from "@/lib/bandeja/telefono";

/**
 * El mensaje para mandarle el enlace del cuestionario al cliente, por WhatsApp o por correo.
 * Módulo PURO: arma textos y direcciones, no manda nada. El envío lo hace la persona desde su
 * propio WhatsApp o su programa de correo.
 */

/** «Pérez, Ana María» o «Ana María Pérez» → «Ana». Vacío si no hay nombre. */
export function primerNombre(nombre: string | null | undefined): string {
  const t = (nombre ?? "").trim();
  if (!t || /^sin nombre$/i.test(t)) return "";
  const despuesDeLaComa = t.includes(",") ? t.split(",").slice(1).join(",").trim() : t;
  return (despuesDeLaComa || t).split(/\s+/)[0] ?? "";
}

export type DatosDelMensaje = {
  nombreCliente?: string | null;
  nombreCuestionario: string;
  nombreEstudio?: string | null;
  enlace: string;
};

export type MensajeArmado = {
  /** El texto para WhatsApp (y el cuerpo del correo). */
  texto: string;
  asunto: string;
};

export function armarMensaje(d: DatosDelMensaje): MensajeArmado {
  const nombre = primerNombre(d.nombreCliente);
  const saludo = nombre ? `¡Hola, ${nombre}!` : "¡Hola!";
  const estudio = d.nombreEstudio?.trim();
  const cuestionario = d.nombreCuestionario.trim() || "cuestionario";
  const texto = [
    `${saludo} Te compartimos el ${cuestionario.charAt(0).toLowerCase()}${cuestionario.slice(1)}${estudio ? ` de ${estudio}` : ""}.`,
    "Nos ayuda a conocerte y a preparar todo para tu evento. Lo podés completar desde el celular, en pocos minutos:",
    d.enlace,
    "¡Gracias!",
  ].join("\n\n");
  const asunto = estudio ? `${cuestionario} · ${estudio}` : cuestionario;
  return { texto, asunto };
}

/**
 * `https://wa.me/<número>?text=…`. Sin un número que sirva, el enlace abre WhatsApp para elegir
 * el contacto a mano (`https://wa.me/?text=…`), así el botón nunca queda muerto.
 */
export function enlaceWhatsapp(telefono: string | null | undefined, texto: string): string {
  const id = waIdDe(telefono);
  return `https://wa.me/${id ?? ""}?text=${encodeURIComponent(texto)}`;
}

/** `mailto:` con asunto y cuerpo. Sin correo, abre un mensaje nuevo sin destinatario. */
export function enlaceCorreo(correo: string | null | undefined, asunto: string, cuerpo: string): string {
  const destino = (correo ?? "").trim();
  const valido = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(destino) ? destino : "";
  return `mailto:${valido ? encodeURIComponent(valido).replace(/%40/g, "@") : ""}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export type EnlacesDeEnvio = { enlace: string; whatsappUrl: string; mailtoUrl: string; texto: string };

export function enlacesDeEnvio(d: DatosDelMensaje & { telefono?: string | null; correo?: string | null }): EnlacesDeEnvio {
  const { texto, asunto } = armarMensaje(d);
  return {
    enlace: d.enlace,
    texto,
    whatsappUrl: enlaceWhatsapp(d.telefono, texto),
    mailtoUrl: enlaceCorreo(d.correo, asunto, texto),
  };
}
