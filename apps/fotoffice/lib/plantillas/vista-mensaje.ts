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
  /** Avisos de Resend (sólo correos): primera entrega y primera apertura. */
  deliveredAt?: Date | null;
  openedAt?: Date | null;
};

const DIA_HORA_AR = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** "21/11 a las 15:30" en hora de Argentina. */
function diaYHora(d: Date): string {
  const p = Object.fromEntries(DIA_HORA_AR.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} a las ${p.hour}:${p.minute}`;
}

/** Lo que se sabe del correo después de enviado: lo abrió (aproximado) o le llegó. */
export function seguimientoDelCorreo(f: Pick<FilaMensaje, "channel" | "status" | "deliveredAt" | "openedAt">): string | null {
  if (f.channel !== "EMAIL" || f.status !== "SENT") return null;
  if (f.openedAt) return `lo abrió el ${diaYHora(f.openedAt)}`;
  if (f.deliveredAt) return "le llegó, todavía sin abrir";
  return null;
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
    estado: [estadoLegible(f.status, f.errorCode), seguimientoDelCorreo(f)].filter(Boolean).join(" · "),
    fallo: f.status === "FAILED",
    automatico: f.automatic,
    quien: f.automatic ? "Automático" : f.actorLabel || "Sistema",
    destino: f.toAddress,
    plantilla,
    asunto: f.subject?.trim() ? f.subject : null,
    cuerpo: f.body,
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
