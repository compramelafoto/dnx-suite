import { CANALES, ETIQUETA_ESTADO_MENSAJE, type Canal } from "./constantes";

/**
 * Cómo se muestra un mensaje registrado (`FotofficeMessage`) en la línea de tiempo de la ficha y
 * en el historial de la consulta. Módulo PURO: sin base ni `server-only`, así lo usan el
 * proveedor, la página y los componentes de cliente.
 */

/** Cuántos caracteres del cuerpo se ven antes de "Ver completo". */
export const LARGO_RECORTE = 280;

export type MensajeVista = {
  id: string;
  /** ISO. */
  fecha: string;
  canal: Canal;
  /** "Enviado", "Falló: …", "Abierto en WhatsApp". */
  estado: string;
  fallo: boolean;
  automatico: boolean;
  quien: string;
  destino: string;
  plantilla: string | null;
  asunto: string | null;
  cuerpo: string;
  /** Avisos del correo, en orden: "Entregado 15/11 21:39", "Abierto 15/11 21:40", "Clic 15/11 21:41". */
  seguimiento: { texto: string; tipo: "ok" | "abierto" | "problema" }[];
};

/** La fila tal como la lee el proveedor (sólo lo que se muestra). */
export type FilaMensaje = {
  id: string;
  channel: string;
  status: string;
  automatic: boolean;
  toAddress: string;
  subject: string | null;
  body: string;
  errorCode: string | null;
  actorLabel: string | null;
  createdAt: Date;
  /** Avisos de Resend (sólo correo); pueden faltar en lecturas viejas. */
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  clickedAt?: Date | null;
  bouncedAt?: Date | null;
  complainedAt?: Date | null;
};

const fechaCorta = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const corta = (d: Date) => fechaCorta.format(d).replace(",", "");

/**
 * Puro: lo que Resend avisó de un correo. El rebote y la queja van primero (son problemas: la
 * dirección no sirve o lo marcaron como spam). La apertura puede aparecer sola en algunos
 * programas de correo que abren las imágenes automáticamente; el clic es la señal segura.
 */
export function seguimientoDe(f: Pick<FilaMensaje, "channel" | "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt">): MensajeVista["seguimiento"] {
  if (f.channel !== "EMAIL") return [];
  const out: MensajeVista["seguimiento"] = [];
  if (f.bouncedAt) out.push({ texto: `Rebotó ${corta(f.bouncedAt)}: la dirección no recibe correos`, tipo: "problema" });
  if (f.complainedAt) out.push({ texto: `Lo marcó como spam ${corta(f.complainedAt)}`, tipo: "problema" });
  if (f.deliveredAt && !f.bouncedAt) out.push({ texto: `Entregado ${corta(f.deliveredAt)}`, tipo: "ok" });
  if (f.openedAt) out.push({ texto: `Abierto ${corta(f.openedAt)}`, tipo: "abierto" });
  if (f.clickedAt) out.push({ texto: `Hizo clic ${corta(f.clickedAt)}`, tipo: "abierto" });
  return out;
}

/** Motivo legible de un código de error guardado (nunca el detalle del proveedor). */
export function motivoDeFalla(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  if (codigo === "CONFIGURATION_ERROR") return "el envío de correos no está configurado";
  if (codigo.startsWith("PROVIDER_REJECTED")) return "el proveedor de correo lo rechazó";
  return "no se pudo conectar con el proveedor de correo";
}

export function estadoLegible(estado: string, codigo: string | null | undefined): string {
  const base = (ETIQUETA_ESTADO_MENSAJE as Record<string, string>)[estado] ?? estado;
  if (estado !== "FAILED") return base;
  const motivo = motivoDeFalla(codigo);
  return motivo ? `${base}: ${motivo}` : base;
}

function canalDe(v: string): Canal {
  return (CANALES as readonly string[]).includes(v) ? (v as Canal) : "EMAIL";
}

export function vistaDeMensaje(f: FilaMensaje, plantilla: string | null): MensajeVista {
  return {
    id: f.id,
    fecha: f.createdAt.toISOString(),
    canal: canalDe(f.channel),
    estado: estadoLegible(f.status, f.errorCode),
    fallo: f.status === "FAILED",
    automatico: f.automatic,
    quien: f.automatic ? "Automático" : f.actorLabel || "Sistema",
    destino: f.toAddress,
    plantilla,
    asunto: f.subject?.trim() ? f.subject : null,
    cuerpo: f.body,
    seguimiento: seguimientoDe(f),
  };
}

/** Título corto: "Correo enviado", "Correo que falló", "WhatsApp abierto". */
export function tituloDeMensaje(m: Pick<MensajeVista, "canal" | "fallo">): string {
  if (m.canal === "WHATSAPP") return "WhatsApp abierto";
  return m.fallo ? "Correo que falló" : "Correo enviado";
}

/** El cuerpo recortado (sin cortar una palabra si se puede), o null si entra entero. */
export function recortar(texto: string, largo = LARGO_RECORTE): string | null {
  if (texto.length <= largo) return null;
  const corte = texto.slice(0, largo);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > largo * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

// ─── Panel "Mensaje" de la ficha ───────────────────────────────────────────────

/** Lo que viaja al panel (cliente): objetos planos, nada de la base. */
export type PlantillaOpcion = { id: string; nombre: string; general: boolean };
export type CanalDelPanel = {
  /** Correo válido o teléfono que sirve para WhatsApp; null = el canal se muestra deshabilitado. */
  destino: string | null;
  /** Por qué no se puede usar el canal (sólo si `destino` es null). */
  motivo: string | null;
  plantillas: PlantillaOpcion[];
};
export type PanelMensaje = { correo: CanalDelPanel; whatsapp: CanalDelPanel };
