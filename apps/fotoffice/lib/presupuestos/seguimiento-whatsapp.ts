/**
 * PURO. Seguimiento por WhatsApp de las cotizaciones de eventos que el cliente no respondió (pedido
 * de Daniel, 10/11/2026): recordatorios a los 2, 7 y 12 días de mandada, y nada más.
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
