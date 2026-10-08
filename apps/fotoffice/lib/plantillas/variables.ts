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
  /** Sólo al enviar un presupuesto (etapa 2): ya formateados para leer. */
  presupuesto?: { numero: string | null; enlace: string | null; total: string | null; vence: string | null };
  /** Sólo al enviar el enlace de un pedido o un recibo (etapa 3): ya formateados para leer. */
  pedido?: { numero: string | null; enlace: string | null; saldo: string | null };
  /** Sólo al enviar un recibo (etapa 3): ya formateados para leer. */
  recibo?: { numero: string | null; enlace: string | null; importe: string | null };
  /** Etapa 2, Entrega B: los productos "en lista de precios", ya en texto (`lib/presupuestos/lista-precios.ts`). */
  listaPrecios?: string | null;
  /** Valores legibles de los campos personalizados, por clave del campo (sin el prefijo `campo:`). */
  campos: Record<string, string>;
};

export type GrupoVariable =
  | "Persona" | "Organización" | "Usuario que envía" | "Fecha" | "Consulta" | "Presupuesto" | "Pedido" | "Socio" | "Campos";

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
/** El presupuesto sale de una consulta: sus plantillas también usan los datos de la consulta. */
const CONSULTA: readonly TipoPlantilla[] = ["CONSULTA", "PRESUPUESTO"];
const PRESUPUESTO: readonly TipoPlantilla[] = ["PRESUPUESTO"];
const SOCIO: readonly TipoPlantilla[] = ["SOCIO"];
const PEDIDO: readonly TipoPlantilla[] = ["PEDIDO"];
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
  { clave: "lista_precios", etiqueta: "Lista de precios", descripcion: "Los productos del catálogo marcados «en lista de precios», con su precio en pesos (hasta 50).", grupo: "Consulta", tipos: CONSULTA, obtener: (c) => limpio(c.listaPrecios) },
  // Presupuesto (etapa 2)
  { clave: "presupuesto_numero", etiqueta: "Número de presupuesto", descripcion: "El número del presupuesto (se asigna al enviarlo por primera vez).", grupo: "Presupuesto", tipos: PRESUPUESTO, obtener: (c) => limpio(c.presupuesto?.numero) },
  { clave: "presupuesto_enlace", etiqueta: "Enlace al presupuesto", descripcion: "La dirección donde la persona ve y acepta el presupuesto.", grupo: "Presupuesto", tipos: PRESUPUESTO, obtener: (c) => limpio(c.presupuesto?.enlace) },
  { clave: "presupuesto_total", etiqueta: "Total del presupuesto", descripcion: "El total, en pesos (sin los opcionales).", grupo: "Presupuesto", tipos: PRESUPUESTO, obtener: (c) => limpio(c.presupuesto?.total) },
  { clave: "presupuesto_vence", etiqueta: "Vencimiento del presupuesto", descripcion: "El último día de validez, en dd/mm/aaaa.", grupo: "Presupuesto", tipos: PRESUPUESTO, obtener: (c) => limpio(c.presupuesto?.vence) },
  // Pedido (etapa 3)
  { clave: "pedido_numero", etiqueta: "Número de pedido", descripcion: "El número del pedido.", grupo: "Pedido", tipos: PEDIDO, obtener: (c) => limpio(c.pedido?.numero) },
  { clave: "pedido_enlace", etiqueta: "Enlace al pedido", descripcion: "La dirección donde la persona ve su pedido: plan de cuotas, saldo y recibos.", grupo: "Pedido", tipos: PEDIDO, obtener: (c) => limpio(c.pedido?.enlace) },
  { clave: "pedido_saldo", etiqueta: "Saldo del pedido", descripcion: "Lo que falta pagar del pedido, en pesos.", grupo: "Pedido", tipos: PEDIDO, obtener: (c) => limpio(c.pedido?.saldo) },
  { clave: "recibo_numero", etiqueta: "Número de recibo", descripcion: "El número del recibo del cobro (sólo al enviar un recibo).", grupo: "Pedido", tipos: PEDIDO, obtener: (c) => limpio(c.recibo?.numero) },
  { clave: "recibo_enlace", etiqueta: "Enlace al recibo", descripcion: "La dirección donde la persona ve e imprime el recibo (sólo al enviar un recibo).", grupo: "Pedido", tipos: PEDIDO, obtener: (c) => limpio(c.recibo?.enlace) },
  { clave: "recibo_importe", etiqueta: "Importe del recibo", descripcion: "Lo que se cobró, en pesos (sólo al enviar un recibo).", grupo: "Pedido", tipos: PEDIDO, obtener: (c) => limpio(c.recibo?.importe) },
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
