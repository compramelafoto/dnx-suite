/**
 * PURO. Las plantillas aprobadas de Meta que una persona puede mandar desde la Bandeja (fuera de la
 * ventana de 24 h): cómo se leen de la respuesta de Meta, qué valores se sugieren para sus
 * variables y cómo queda el texto. Sin base ni red: lo usan el servidor, la pantalla y las pruebas.
 */

export type CategoriaPlantilla = "MARKETING" | "UTILITY" | "AUTHENTICATION" | "OTRA";

export type PlantillaDisponible = {
  nombre: string;
  idioma: string;
  categoria: CategoriaPlantilla;
  /** Texto del cuerpo, con {{1}}, {{2}}… */
  cuerpo: string;
  /** Cuántas variables tiene el cuerpo (la mayor {{n}}). */
  variables: number;
  /** Ejemplos que se cargaron en Meta para cada variable (para mostrar como ayuda). */
  ejemplos: string[];
  /** Encabezado de texto fijo, si tiene. */
  encabezado: string | null;
  /** Pie de página, si tiene. */
  pie: string | null;
  /** Botón con enlace. `dinamico`: la dirección termina en {{1}} y hay que completarla. */
  boton: { texto: string; url: string; dinamico: boolean } | null;
  /** Otros botones (respuesta rápida, llamar): no llevan valores. */
  otrosBotones: string[];
};

/** Lo que recibe la pantalla del chat: la plantilla con los valores propuestos para ese chat. */
/** `sugeridoBoton`: el final del enlace del botón dinámico, cuando FOTOFFICE lo conoce (p. ej. el de la cotización). */
export type PlantillaParaElegir = PlantillaDisponible & { sugeridos: string[]; sugeridoBoton: string };

export const ETIQUETA_CATEGORIA: Record<CategoriaPlantilla, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticación",
  OTRA: "Otra",
};

/** Lo que conviene saber antes de enviar, según la categoría (Meta cobra cada envío). */
export const AVISO_CATEGORIA: Record<CategoriaPlantilla, string> = {
  MARKETING: "Plantilla de marketing: Meta cobra cada envío, y es la categoría más cara.",
  UTILITY: "Plantilla de utilidad: Meta cobra cada envío, más barato que marketing.",
  AUTHENTICATION: "Plantilla de autenticación: Meta cobra cada envío.",
  OTRA: "Meta cobra cada envío de plantilla.",
};

export const MAXIMO_VALOR = 200;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** La mayor {{n}} del texto (0 si no tiene). Las variables con nombre ({{nombre}}) no se cuentan. */
export function contarVariables(t: string): number {
  let max = 0;
  for (const m of t.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

const tieneVariablesConNombre = (t: string) => /\{\{\s*[A-Za-z_][\w]*\s*\}\}/.test(t);

function categoriaDe(v: unknown): CategoriaPlantilla {
  return v === "MARKETING" || v === "UTILITY" || v === "AUTHENTICATION" ? v : "OTRA";
}

/**
 * Las plantillas que se pueden mandar desde la Bandeja, de la respuesta de
 * `GET /{waba}/message_templates`. Quedan afuera las que no están aprobadas y las que FOTOFFICE
 * todavía no sabe completar: encabezado con imagen, video, documento o variable; variables con
 * nombre; botones de código, formulario o más de un enlace.
 */
export function parsearPlantillas(respuesta: unknown): PlantillaDisponible[] {
  const datos = esObjeto(respuesta) && Array.isArray(respuesta.data) ? respuesta.data : [];
  const out: PlantillaDisponible[] = [];
  for (const p of datos) {
    if (!esObjeto(p) || p.status !== "APPROVED") continue;
    const nombre = texto(p.name);
    const idioma = texto(p.language);
    if (!nombre || !idioma || !Array.isArray(p.components)) continue;
    let cuerpo: string | null = null;
    let ejemplos: string[] = [];
    let encabezado: string | null = null;
    let pie: string | null = null;
    let boton: PlantillaDisponible["boton"] = null;
    const otrosBotones: string[] = [];
    let sirve = true;
    for (const c of p.components) {
      if (!esObjeto(c)) continue;
      if (c.type === "BODY") {
        cuerpo = texto(c.text);
        const ej = esObjeto(c.example) && Array.isArray(c.example.body_text) && Array.isArray(c.example.body_text[0]) ? c.example.body_text[0] : [];
        ejemplos = ej.map((x: unknown) => (typeof x === "string" ? x : ""));
      } else if (c.type === "HEADER") {
        const t = texto(c.text);
        if (c.format !== "TEXT" || !t || contarVariables(t) > 0) sirve = false;
        else encabezado = t;
      } else if (c.type === "FOOTER") {
        pie = texto(c.text);
      } else if (c.type === "BUTTONS" && Array.isArray(c.buttons)) {
        for (const b of c.buttons) {
          if (!esObjeto(b)) continue;
          const t = texto(b.text) ?? "";
          if (b.type === "URL") {
            const url = texto(b.url);
            if (!url || boton) {
              sirve = false;
              continue;
            }
            const n = contarVariables(url);
            if (n > 1) sirve = false;
            boton = { texto: t, url, dinamico: n === 1 };
          } else if (b.type === "QUICK_REPLY" || b.type === "PHONE_NUMBER") {
            otrosBotones.push(t);
          } else {
            sirve = false;
          }
        }
      }
    }
    if (!sirve || !cuerpo || tieneVariablesConNombre(cuerpo)) continue;
    out.push({ nombre, idioma, categoria: categoriaDe(p.category), cuerpo, variables: contarVariables(cuerpo), ejemplos, encabezado, pie, boton, otrosBotones });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** El cuerpo con los valores puestos (las variables vacías quedan como [n] para que se note). */
export function armarTexto(cuerpo: string, valores: readonly string[]): string {
  return cuerpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n: string) => {
    const v = valores[Number(n) - 1]?.trim();
    return v ? v : `[${n}]`;
  });
}

/** El valor del botón con enlace dinámico: lo que va después de la parte fija. */
export function urlDelBoton(url: string, valor: string): string {
  return url.replace(/\{\{\s*1\s*\}\}/, valor.trim());
}

export type DatosParaSugerir = {
  /** Nombre del cliente o del perfil de WhatsApp. */
  nombre: string | null;
  /** Categoría de su última consulta (XV, Boda…). */
  categoria: string | null;
  /** Fecha del evento de esa consulta. */
  fechaEvento: Date | null;
  /** Próxima cita en la Agenda. */
  proximaCita: Date | null;
  /** Lo que va después de la dirección fija en el enlace de su última cotización abierta ("w/<slug>/presupuesto/<token>"). */
  enlaceCotizacion?: string | null;
};

/** Las plantillas de ventas van primero, en este orden; el resto, por nombre. */
const ORDEN_VENTAS = ["retomar_consulta", "seguimiento_cotizacion", "coordinar_entrevista", "recordatorio_entrevista"];

/** Puro: el final del enlace del botón dinámico que FOTOFFICE puede completar solo ("" si no lo conoce). */
export function sugerirBoton(p: Pick<PlantillaDisponible, "nombre" | "boton">, d: DatosParaSugerir): string {
  if (!p.boton?.dinamico) return "";
  if (p.nombre === "seguimiento_cotizacion") return d.enlaceCotizacion ?? "";
  return "";
}

/**
 * Puro: lo que se ofrece en el chat. Una plantilla con botón de enlace dinámico que FOTOFFICE no sabe
 * completar (el de un pedido, un fotolibro…) no se ofrece: nadie conoce ese final de memoria.
 */
export function paraElegir(plantillas: readonly PlantillaDisponible[], d: DatosParaSugerir): PlantillaParaElegir[] {
  const rango = (n: string) => {
    const i = ORDEN_VENTAS.indexOf(n);
    return i === -1 ? ORDEN_VENTAS.length : i;
  };
  return plantillas
    .map((p) => ({ ...p, sugeridos: sugerirValores(p, d), sugeridoBoton: sugerirBoton(p, d) }))
    .filter((p) => !p.boton?.dinamico || p.sugeridoBoton !== "")
    .sort((a, b) => rango(a.nombre) - rango(b.nombre) || a.nombre.localeCompare(b.nombre));
}

const ZONA = "America/Argentina/Buenos_Aires";
const fechaEventoUTC = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const diaSemanaCita = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "long" });
const diaMesCita = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit" });
/** "viernes 20/11", en hora argentina. */
const diaCita = { format: (d: Date) => `${diaSemanaCita.format(d)} ${diaMesCita.format(d)}` };
const horaCita = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function nombreDePila(nombre: string | null): string {
  return nombre?.trim().split(/\s+/)[0] ?? "";
}

/** "los 15", "el casamiento", "el evento": el tipo de evento con artículo. */
export function eventoConArticulo(categoria: string | null): string {
  const c = (categoria ?? "").trim().toLowerCase();
  if (!c || c === "evento" || c === "eventos") return "tu evento";
  if (/\b(15|xv|quince)\b/.test(c)) return "los 15";
  if (/casamiento|boda/.test(c)) return "el casamiento";
  if (/sesi[oó]n/.test(c)) return "la sesión de fotos";
  if (/graduaci[oó]n|colaci[oó]n/.test(c)) return "la graduación";
  if (/bautismo/.test(c)) return "el bautismo";
  if (/comuni[oó]n/.test(c)) return "la comunión";
  if (/cumplea/.test(c)) return "el cumpleaños";
  return "tu evento";
}

/** "los 15 del 12/12/2026" (sin fecha, sólo el tipo). Las fechas del evento se guardan sin hora (UTC). */
export function describirEvento(categoria: string | null, fecha: Date | null): string {
  const base = eventoConArticulo(categoria);
  return fecha ? `${base} del ${fechaEventoUTC.format(fecha)}` : base;
}

/**
 * Los valores que se proponen para cada variable. {{1}} es siempre el nombre de pila (así están
 * escritas todas las plantillas de DNX). Para las plantillas conocidas se completan las demás con
 * los datos de la consulta o de la próxima cita; el resto queda vacío para que lo complete la persona.
 */
export function sugerirValores(p: Pick<PlantillaDisponible, "nombre" | "variables">, d: DatosParaSugerir): string[] {
  const valores = Array.from({ length: p.variables }, () => "");
  if (p.variables >= 1) valores[0] = nombreDePila(d.nombre);
  if (p.nombre === "retomar_consulta" && p.variables >= 2) valores[1] = describirEvento(d.categoria, d.fechaEvento);
  if (p.nombre === "seguimiento_cotizacion" && p.variables >= 2) {
    const c = eventoConArticulo(d.categoria);
    valores[1] = c === "los 15" ? "tus 15" : c === "el casamiento" ? "tu casamiento" : c.replace(/^(el|la|los|las) /, "tu ");
  }
  if (p.nombre === "recordatorio_entrevista" && d.proximaCita) {
    if (p.variables >= 2) valores[1] = diaCita.format(d.proximaCita);
    if (p.variables >= 3) valores[2] = horaCita.format(d.proximaCita);
  }
  return valores;
}

/** Valida los valores que llegan del navegador: tantos como variables, sin vacíos y sin saltos de línea (Meta los rechaza). */
export function validarValores(variables: number, valores: unknown): { ok: true; valores: string[] } | { ok: false; error: string } {
  if (!Array.isArray(valores) || valores.length !== variables) return { ok: false, error: "Completá todos los datos de la plantilla." };
  const limpios: string[] = [];
  for (const v of valores) {
    const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    if (!t) return { ok: false, error: "Completá todos los datos de la plantilla." };
    if (t.length > MAXIMO_VALOR) return { ok: false, error: `Cada dato puede tener hasta ${MAXIMO_VALOR} caracteres.` };
    limpios.push(t);
  }
  return { ok: true, valores: limpios };
}
