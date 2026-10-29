/** Un comentario del cliente sobre un pliego (-1 = la tapa). */
export type ComentarioCliente = { id: string; pliego: number; texto: string; nombre: string; fecha: string; resuelto: boolean };

export type RevisionCliente = {
  fotolibroId: string;
  /** El enlace vigente; null = se dejó de compartir. */
  token: string | null;
  creada: string;
  /** "pendiente": enviado, sin respuesta; "cambios": el cliente pidió cambios; "aprobado". */
  estado: "pendiente" | "cambios" | "aprobado";
  comentarios: ComentarioCliente[];
  /** Quién aprobó, cuándo y sobre qué guardado del libro (para saber si se cambió después). */
  aprobacion: { nombre: string; fecha: string; revision: number } | null;
};

const txt = (v: unknown) => (typeof v === "string" ? v : "");

export function leerRevisionCliente(raw: Record<string, unknown>): RevisionCliente | null {
  if (!txt(raw.fotolibroId)) return null;
  const estado = raw.estado === "cambios" || raw.estado === "aprobado" ? raw.estado : "pendiente";
  const comentarios = (Array.isArray(raw.comentarios) ? raw.comentarios : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ id: txt(c.id), pliego: typeof c.pliego === "number" ? c.pliego : 0, texto: txt(c.texto), nombre: txt(c.nombre), fecha: txt(c.fecha), resuelto: c.resuelto === true }))
    .filter((c) => c.id && c.texto);
  const a = raw.aprobacion as Record<string, unknown> | null | undefined;
  return {
    fotolibroId: txt(raw.fotolibroId),
    token: txt(raw.token) || null,
    creada: txt(raw.creada),
    estado,
    comentarios,
    aprobacion: a && typeof a === "object" && txt(a.fecha) ? { nombre: txt(a.nombre), fecha: txt(a.fecha), revision: typeof a.revision === "number" ? a.revision : 0 } : null,
  };
}

/**
 * "29/10 15:30", en hora argentina. Armado a mano con las partes de la fecha: así sale igual en el
 * servidor y en el navegador (con `toLocaleString` cada uno pone otro espacio antes de "p. m." y
 * la página falla al cargar).
 */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}
