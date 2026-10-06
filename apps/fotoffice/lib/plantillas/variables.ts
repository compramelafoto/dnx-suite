/**
 * Catálogo de variables de las plantillas (spec §3.3). Es código, no base: cada etapa futura suma filas.
 * Puro: cada variable se obtiene de un contexto ya cargado en lote; ninguna consulta la base.
 */
import { CLAVE_FIRMA, MARCADOR_FIRMA, TIPOS_PLANTILLA, ZONA_HORARIA, type TipoPlantilla } from "./constantes";

export type ContextoVariables = {
  persona: { nombreCompleto: string | null; email: string | null; telefono: string | null };
  organizacion: {
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    whatsapp: string | null;
    web: string | null;
    instagram: string | null;
    ciudad: string | null;
  };
  usuario: { nombre: string | null; email: string | null };
  hoy: Date;
  consulta?: {
    numero: string | null;
    tipo: string | null;
    fecha: Date | null;
    lugar: string | null;
    mensaje: string | null;
    etapa: string | null;
  };
  socio?: { numero: string | null };
  /** Valores legibles de los campos personalizados, por clave del campo (sin el prefijo `campo:`). */
  campos: Record<string, string>;
};

export type GrupoVariable = "Persona" | "Organización" | "Usuario que envía" | "Fecha" | "Consulta" | "Socio" | "Campos";

export type DefinicionVariable = {
  clave: string;
  etiqueta: string;
  descripcion: string;
  grupo: GrupoVariable;
  tipos: readonly TipoPlantilla[];
  obtener(ctx: ContextoVariables): string | null;
};

export const PREFIJO_CAMPO = "campo:";

const TODAS = TIPOS_PLANTILLA;
const CONSULTA: readonly TipoPlantilla[] = ["CONSULTA"];
const SOCIO: readonly TipoPlantilla[] = ["SOCIO"];
const CON_CAMPOS: readonly TipoPlantilla[] = ["CLIENTE", "SOCIO", "CONSULTA"];

function limpio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t ? t : null;
}

function palabras(nombreCompleto: string | null): string[] {
  const t = limpio(nombreCompleto);
  return t ? t.split(/\s+/) : [];
}

const formatoAR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric" });
const formatoUTC = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

function ddmmaaaa(f: Intl.DateTimeFormat, d: Date): string {
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}`;
}

/** dd/mm/aaaa en hora de Buenos Aires. */
export function fechaAR(d: Date): string {
  return ddmmaaaa(formatoAR, d);
}

/** Si el instante es exactamente 00:00:00.000 UTC: una fecha de calendario guardada sin hora. */
export function esFechaSinHora(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/**
 * Fecha del evento de una consulta. El formulario público usa `<input type="date">` y guarda
 * `new Date("aaaa-mm-dd")`, o sea medianoche UTC: en Buenos Aires eso es el día anterior a las 21.
 * Si la hora es exactamente 00:00:00.000 UTC se la trata como fecha de calendario (sin zona);
 * cualquier otro instante se muestra en hora de Buenos Aires.
 *
 * Es la regla de toda la app: la lista, el tablero y la ficha de Consultas la usan a través de
 * `fechaDeEvento` de `lib/ficha/formato.ts`. Vive acá porque los módulos de plantillas que
 * carga el navegador sólo pueden importar entre sí.
 */
export function fechaDeEvento(d: Date): string {
  return ddmmaaaa(esFechaSinHora(d) ? formatoUTC : formatoAR, d);
}

export const VARIABLES: readonly DefinicionVariable[] = [
  // Persona
  { clave: "nombre", etiqueta: "Nombre", descripcion: "Nombre de pila: la primera palabra del nombre.", grupo: "Persona", tipos: TODAS, obtener: (c) => palabras(c.persona.nombreCompleto)[0] ?? null },
  { clave: "nombre_completo", etiqueta: "Nombre completo", descripcion: "Nombre y apellido, como figuran en la ficha.", grupo: "Persona", tipos: TODAS, obtener: (c) => palabras(c.persona.nombreCompleto).join(" ") || null },
  { clave: "apellido", etiqueta: "Apellido", descripcion: "Todo lo que sigue a la primera palabra del nombre.", grupo: "Persona", tipos: TODAS, obtener: (c) => palabras(c.persona.nombreCompleto).slice(1).join(" ") || null },
  { clave: "email", etiqueta: "Correo", descripcion: "Correo electrónico de la persona.", grupo: "Persona", tipos: TODAS, obtener: (c) => limpio(c.persona.email) },
  { clave: "telefono", etiqueta: "Teléfono", descripcion: "Teléfono de la persona.", grupo: "Persona", tipos: TODAS, obtener: (c) => limpio(c.persona.telefono) },
  // Organización
  { clave: "organizacion", etiqueta: "Organización", descripcion: "Nombre de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.nombre) },
  { clave: "organizacion_email", etiqueta: "Correo de la organización", descripcion: "Correo de contacto de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.email) },
  { clave: "organizacion_telefono", etiqueta: "Teléfono de la organización", descripcion: "Teléfono de contacto de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.telefono) },
  { clave: "organizacion_whatsapp", etiqueta: "WhatsApp de la organización", descripcion: "Número de WhatsApp de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.whatsapp) },
  { clave: "organizacion_web", etiqueta: "Web de la organización", descripcion: "Sitio web de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.web) },
  { clave: "organizacion_instagram", etiqueta: "Instagram de la organización", descripcion: "Cuenta de Instagram de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.instagram) },
  { clave: "organizacion_ciudad", etiqueta: "Ciudad de la organización", descripcion: "Ciudad de la organización.", grupo: "Organización", tipos: TODAS, obtener: (c) => limpio(c.organizacion.ciudad) },
  { clave: CLAVE_FIRMA, etiqueta: "Firma", descripcion: "La firma de la organización. En el correo se agrega al final si no la ponés.", grupo: "Organización", tipos: TODAS, obtener: () => MARCADOR_FIRMA },
  // Usuario que envía
  { clave: "usuario_nombre", etiqueta: "Tu nombre", descripcion: "Nombre de quien envía el mensaje.", grupo: "Usuario que envía", tipos: TODAS, obtener: (c) => limpio(c.usuario.nombre) },
  { clave: "usuario_email", etiqueta: "Tu correo", descripcion: "Correo de quien envía el mensaje.", grupo: "Usuario que envía", tipos: TODAS, obtener: (c) => limpio(c.usuario.email) },
  // Fecha
  { clave: "hoy", etiqueta: "Fecha de hoy", descripcion: "La fecha del día, en dd/mm/aaaa (hora de Buenos Aires).", grupo: "Fecha", tipos: TODAS, obtener: (c) => fechaAR(c.hoy) },
  // Consulta
  { clave: "consulta_numero", etiqueta: "Número de consulta", descripcion: "El número asignado a la consulta.", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => limpio(c.consulta?.numero) },
  { clave: "consulta_tipo", etiqueta: "Tipo de evento", descripcion: "El tipo de evento de la consulta.", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => limpio(c.consulta?.tipo) },
  { clave: "consulta_fecha", etiqueta: "Fecha del evento", descripcion: "La fecha del evento, en dd/mm/aaaa.", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => (c.consulta?.fecha ? fechaDeEvento(c.consulta.fecha) : null) },
  { clave: "consulta_lugar", etiqueta: "Lugar del evento", descripcion: "El lugar del evento.", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => limpio(c.consulta?.lugar) },
  { clave: "consulta_mensaje", etiqueta: "Mensaje de la consulta", descripcion: "Lo que escribió la persona al consultar.", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => limpio(c.consulta?.mensaje) },
  { clave: "consulta_etapa", etiqueta: "Etapa de la consulta", descripcion: "La etapa actual de la consulta en su recorrido.", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => limpio(c.consulta?.etapa) },
  // Socio
  { clave: "socio_numero", etiqueta: "Número de socio", descripcion: "El número de socio, si la organización los numera.", grupo: "Socio", tipos: SOCIO, obtener: (c) => limpio(c.socio?.numero) },
];

const POR_CLAVE = new Map(VARIABLES.map((v) => [v.clave, v]));

function valorDeCampo(ctx: ContextoVariables, clave: string): string | null {
  return Object.hasOwn(ctx.campos, clave) ? limpio(ctx.campos[clave]) : null;
}

export type CampoParaVariables = string | { clave: string; nombre: string };

/** Variables disponibles para un tipo de ficha, más `[campo:<clave>]` de sus campos activos (no en GENERAL). */
export function variablesPara(tipo: TipoPlantilla, campos: readonly CampoParaVariables[]): DefinicionVariable[] {
  const fijas = VARIABLES.filter((v) => v.tipos.includes(tipo));
  if (!CON_CAMPOS.includes(tipo)) return fijas;
  const deCampos = campos.map((c): DefinicionVariable => {
    const clave = typeof c === "string" ? c : c.clave;
    return {
      clave: `${PREFIJO_CAMPO}${clave}`,
      etiqueta: typeof c === "string" ? clave : c.nombre,
      descripcion: "Campo personalizado de la ficha.",
      grupo: "Campos",
      tipos: [tipo],
      obtener: (ctx) => valorDeCampo(ctx, clave),
    };
  });
  return [...fijas, ...deCampos];
}

/** Claves (sin corchetes) que el motor acepta para ese tipo de ficha. */
export function clavesPermitidas(tipo: TipoPlantilla, campos: readonly CampoParaVariables[]): Set<string> {
  return new Set(variablesPara(tipo, campos).map((v) => v.clave));
}

/** Función de valores para `completar`: variable desconocida o vacía → null. */
export function resolverVariables(ctx: ContextoVariables): (clave: string) => string | null {
  return (clave) => {
    if (clave.startsWith(PREFIJO_CAMPO)) return valorDeCampo(ctx, clave.slice(PREFIJO_CAMPO.length));
    return POR_CLAVE.get(clave)?.obtener(ctx) ?? null;
  };
}
