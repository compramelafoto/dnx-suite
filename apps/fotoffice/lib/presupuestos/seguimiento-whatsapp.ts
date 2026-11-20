/**
 * PURO. Seguimiento de las cotizaciones de eventos que el cliente no respondió (pedido de Daniel,
 * 10/11/2026; cambiado el 20/11/2026): el 1.º por WhatsApp dentro de la ventana de 24 h, sin
 * plantilla; si no llegó a salir, a los 2 días por CORREO. Los de los 7 y 12 días, también por
 * correo. Los correos salen sólo si el cliente no dio señales de vida (`sinSenalesDeVida`).
 * La corrida diaria ya no manda plantillas de WhatsApp.
 * Se corta si el cliente escribió después de recibirla, si la cotización ya no está abierta
 * (aceptada, rechazada o vencida), si una persona del equipo atiende el chat o a los 30 días.
 */

/** Días desde el envío de cada recordatorio (Daniel: 2, 7 y 12). */
export const DIAS_SEGUIMIENTOS = [2, 7, 12] as const;
export const DIAS_PRIMERO = DIAS_SEGUIMIENTOS[0];
export type NumeroSeguimiento = 1 | 2 | 3;
export const DIAS_MAXIMO = 30;
/** Comienzo del mensaje del sistema que deja cada seguimiento (también sirve para contarlos). */
export const MARCA_SEGUIMIENTO = "Seguimiento de cotización";
/** La plantilla aprobada en Meta para escribir fuera de la ventana de 24 h. */
export const PLANTILLA_SEGUIMIENTO = { nombre: "seguimiento_cotizacion", idioma: "es_AR" } as const;

const DIA_MS = 86_400_000;

export type EstadoSeguimiento = {
  enviadaEn: Date;
  ahora: Date;
  /** El número del último seguimiento que ya salió para esta cotización (0 si ninguno). */
  yaEnviados: number;
  respondioDespues: boolean;
  /** ENVIADO o VISTO, sin aceptar ni vencer. */
  abierta: boolean;
  atiendePersona: boolean;
};

/**
 * ¿Toca un seguimiento hoy? Devuelve cuál (1, 2 o 3) o null. Si uno no salió a tiempo (por
 * ejemplo, la plantilla todavía no estaba aprobada), no se mandan dos juntos: sale el que
 * corresponde a hoy.
 */
export function cualSeguimiento(e: EstadoSeguimiento): NumeroSeguimiento | null {
  if (e.respondioDespues || !e.abierta || e.atiendePersona) return null;
  const dias = (e.ahora.getTime() - e.enviadaEn.getTime()) / DIA_MS;
  if (dias > DIAS_MAXIMO) return null;
  const corresponde = DIAS_SEGUIMIENTOS.filter((d) => dias >= d).length;
  return corresponde > e.yaEnviados ? (corresponde as NumeroSeguimiento) : null;
}

/** "15 años" ⇒ "tus 15"; "Casamientos" ⇒ "tu casamiento"; sin categoría ⇒ "tu evento". */
export function tipoDeEvento(categoria: string | null): string {
  const c = (categoria ?? "").trim().toLowerCase();
  if (!c || c === "evento" || c === "eventos") return "tu evento";
  if (/\b(15|xv|quince)\b/.test(c)) return "tus 15";
  if (/casamiento|boda/.test(c)) return "tu casamiento";
  const singular = c.replace(/(?<=[aeiou])s$/, "");
  return `tu ${singular}`;
}

export function nombreDePila(nombre: string | null): string {
  return nombre?.trim().split(/\s+/)[0] || "";
}

/** El último seguimiento anotado en el chat, leyendo las marcas ("Seguimiento de cotización 2 …"). */
export function ultimoSeguimiento(marcas: readonly (string | null)[]): number {
  let max = 0;
  for (const m of marcas) {
    const n = Number(m?.match(/^Seguimiento de cotización (\d)\b/)?.[1] ?? 0);
    if (n > max) max = n;
  }
  return max;
}

export function marcaDe(numero: NumeroSeguimiento): string {
  return `${MARCA_SEGUIMIENTO} ${numero} enviado por WhatsApp`;
}

/** Cuántos de esos seguimientos salieron por correo. */
export function enviadosPorCorreo(marcas: readonly (string | null)[]): number {
  return marcas.filter((m) => m?.startsWith(MARCA_SEGUIMIENTO) && m.endsWith("por correo")).length;
}

export function marcaDeCorreo(numero: NumeroSeguimiento): string {
  return `${MARCA_SEGUIMIENTO} ${numero} enviado por correo`;
}

/**
 * ¿El cliente no dio señales de vida desde que recibió la cotización? Señales: la abrió, escribió,
 * alguien del equipo le escribió o le cargó algo (un mensaje, una cita) o una persona tomó el chat.
 */
export function sinSenalesDeVida(s: { vio: boolean; respondio: boolean; delEquipo: boolean; atiendePersona: boolean }): boolean {
  return !s.vio && !s.respondio && !s.delEquipo && !s.atiendePersona;
}

/** Horas mínimas entre la cotización y el seguimiento dentro de la ventana (no se insiste el mismo rato). */
export const HORAS_MINIMAS_EN_VENTANA = 12;

/**
 * El primer seguimiento puede salir antes, dentro de la ventana de 24 h del último mensaje del cliente
 * (pedido de Daniel, 20/11/2026): es texto libre, sin plantilla ni botón, y no se cobra. El horario lo
 * decide `tocaRecordar` (22 h después, de 7 a 21 h). Si no llega a salir, a los 2 días va la plantilla.
 */
export function seguirEnLaVentana(e: { ultimoEntranteEn: Date; enviadaEn: Date; ahora: Date; yaEnviados: number; abierta: boolean }): boolean {
  if (!e.abierta || e.yaEnviados > 0) return false;
  if (e.enviadaEn.getTime() <= e.ultimoEntranteEn.getTime()) return false;
  return e.ahora.getTime() - e.enviadaEn.getTime() >= HORAS_MINIMAS_EN_VENTANA * 3_600_000;
}

export function textoSeguimientoEnVentana(nombre: string | null, categoria: string | null, enlace: string): string {
  const n = nombreDePila(nombre);
  const hola = n ? `¡Hola ${n}!` : "¡Hola!";
  return `${hola} ¿Pudiste ver la cotización para ${tipoDeEvento(categoria)}? Si tenés alguna duda o querés cambiar algo, contame por acá y lo vemos 😊\n${enlace}`;
}
