/**
 * Lo PURO de los formularios propios del sitio (bloques FORM y NEWSLETTER): validar un envío
 * contra la definición publicada, sacar los datos de contacto, armar lo que se muestra después de
 * enviar y lo que viaja al navegador. Sin base ni `server-only`: lo usan la vista (cliente), la
 * acción pública, la bandeja y el importador de Prosite.
 */
import {
  FORM_DEFAULT_THANKS,
  type FormBlock,
  type FormBlockConfig,
  type FormField,
  type NewsletterBlock,
  type WebsiteSections,
} from "./blocks";
import { enlaceDeBoton, type PaginasDelSitio } from "./button-href";

/** Un dato de un envío: la etiqueta del campo y lo que escribió la persona, en el orden del formulario. */
export type ParEnvio = { etiqueta: string; valor: string };
export type ContactoEnvio = { nombre: string | null; email: string | null; telefono: string | null };

/** Topes de largo por tipo de campo (el formulario es público: nadie inicia sesión). */
export const MAX_VALOR_CORTO = 300;
export const MAX_VALOR_LARGO = 4000;
export const MAX_EMAIL = 254;
export const MAX_TELEFONO = 40;
/** Tope de todo el envío junto (todas las respuestas). */
export const MAX_ENVIO_TOTAL = 20000;

const EMAIL_FORMAT = /^[^\s@"<>()[\],;:]+@[^\s@"<>()[\],;:]+\.[^\s@"<>()[\],;:]{2,}$/;

export function normalizarEmail(valor: string | null | undefined): string {
  return (valor ?? "").trim().toLowerCase();
}

export function emailValido(valor: string | null | undefined): boolean {
  const e = normalizarEmail(valor);
  return e.length > 0 && e.length <= MAX_EMAIL && EMAIL_FORMAT.test(e);
}

/** Un campo con la clave que usa su `<input name>`. */
export type CampoConClave = FormField & { clave: string; etiquetaVisible: string };

const CLAVE_SEGURA = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * La clave de cada campo: su id si es seguro y único; si no, `campo-<n>`. La calculan igual el
 * navegador y el servidor a partir de la MISMA config publicada, así que coinciden.
 */
export function camposConClave(fields: readonly FormField[]): CampoConClave[] {
  const usadas = new Set<string>();
  return fields.map((f, i) => {
    let clave = CLAVE_SEGURA.test(f.id) && !usadas.has(f.id) ? f.id : `campo-${i + 1}`;
    while (usadas.has(clave)) clave = `${clave}-${i + 1}`;
    usadas.add(clave);
    return { ...f, clave, etiquetaVisible: f.label.trim() || `Campo ${i + 1}` };
  });
}

/** El `name` del input de un campo en el `<form>`. */
export function nombreDelInput(clave: string): string {
  return `f_${clave}`;
}

/** Una lista sin opciones se dibuja (y se valida) como texto corto. */
export function tipoEfectivo(campo: Pick<FormField, "type" | "options">): FormField["type"] {
  return campo.type === "select" && campo.options.length === 0 ? "text" : campo.type;
}

export type ResultadoValidacion =
  | { ok: true; pares: ParEnvio[]; contacto: ContactoEnvio }
  | { ok: false; error: string };

/**
 * Valida lo que llegó contra la definición PUBLICADA del bloque: se leen sólo los campos que el
 * bloque define (lo demás que mande el navegador se ignora), con su tipo, su obligatoriedad y su
 * tope de largo. Devuelve los pares en el orden del formulario (los vacíos no se guardan) y los
 * datos de contacto para listar.
 */
export function validarEnvio(config: Pick<FormBlockConfig, "fields">, leer: (nombre: string) => string | null): ResultadoValidacion {
  const campos = camposConClave(config.fields);
  if (campos.length === 0) return { ok: false, error: "Este formulario todavía no tiene campos." };

  const pares: ParEnvio[] = [];
  let email: string | null = null;
  let telefono: string | null = null;
  let total = 0;

  for (const campo of campos) {
    const crudo = (leer(nombreDelInput(campo.clave)) ?? "").trim();
    const etiqueta = campo.etiquetaVisible;
    const tipo = tipoEfectivo(campo);
    let valor = crudo;

    if (tipo === "checkbox") {
      const marcado = crudo === "on" || crudo === "true" || crudo === "1";
      if (campo.required && !marcado) return { ok: false, error: `Marcá «${etiqueta}» para seguir.` };
      pares.push({ etiqueta, valor: marcado ? "Sí" : "No" });
      continue;
    }

    if (!valor) {
      if (campo.required) return { ok: false, error: `Completá «${etiqueta}».` };
      continue;
    }

    switch (tipo) {
      case "email":
        valor = normalizarEmail(valor);
        if (!emailValido(valor)) return { ok: false, error: `Revisá el correo de «${etiqueta}».` };
        email ??= valor;
        break;
      case "phone":
        if (valor.length > MAX_TELEFONO || !/^[0-9+()\-.\s/]+$/.test(valor) || (valor.match(/\d/g)?.length ?? 0) < 6) {
          return { ok: false, error: `Revisá el teléfono de «${etiqueta}».` };
        }
        telefono ??= valor;
        break;
      case "number": {
        const normal = valor.replace(",", ".");
        if (valor.length > 30 || !/^-?\d+(\.\d+)?$/.test(normal)) return { ok: false, error: `«${etiqueta}» tiene que ser un número.` };
        break;
      }
      case "date": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(`${valor}T12:00:00Z`))) {
          return { ok: false, error: `Revisá la fecha de «${etiqueta}».` };
        }
        const [y, m, d] = valor.split("-");
        valor = `${d}/${m}/${y}`;
        break;
      }
      case "select":
        if (!campo.options.includes(valor)) return { ok: false, error: `Elegí una opción de «${etiqueta}».` };
        break;
      case "textarea":
        if (valor.length > MAX_VALOR_LARGO) return { ok: false, error: `«${etiqueta}» puede tener hasta ${MAX_VALOR_LARGO} caracteres.` };
        break;
      default:
        if (valor.length > MAX_VALOR_CORTO) return { ok: false, error: `«${etiqueta}» puede tener hasta ${MAX_VALOR_CORTO} caracteres.` };
    }
    total += valor.length;
    if (total > MAX_ENVIO_TOTAL) return { ok: false, error: "El envío es demasiado largo." };
    pares.push({ etiqueta, valor });
  }

  const porEtiqueta = contactoPorEtiquetas(pares);
  return { ok: true, pares, contacto: { nombre: porEtiqueta.nombre, email: email ?? porEtiqueta.email, telefono: telefono ?? porEtiqueta.telefono } };
}

const ETIQUETA_NOMBRE = /^(nombre|nombre y apellido|nombre completo|tu nombre|name|full name|apellido y nombre|nome)\b/i;
const ETIQUETA_EMAIL = /(correo|e-?mail|mail)/i;
const ETIQUETA_TELEFONO = /(tel[eé]fono|telefone|celular|whats ?app|m[oó]vil|phone|cel\b|tel\b)/i;

/**
 * Nombre, correo y teléfono a partir de las etiquetas (formularios importados, o campos de texto
 * llamados «Nombre»). El correo sólo si tiene forma de correo; el teléfono, si tiene dígitos.
 */
export function contactoPorEtiquetas(pares: readonly ParEnvio[]): ContactoEnvio {
  let nombre: string | null = null;
  let email: string | null = null;
  let telefono: string | null = null;
  for (const { etiqueta, valor } of pares) {
    const v = valor.trim();
    if (!v) continue;
    if (!email && ETIQUETA_EMAIL.test(etiqueta) && emailValido(v)) email = normalizarEmail(v);
    else if (!telefono && ETIQUETA_TELEFONO.test(etiqueta) && (v.match(/\d/g)?.length ?? 0) >= 6) telefono = v.slice(0, MAX_TELEFONO);
    else if (!nombre && ETIQUETA_NOMBRE.test(etiqueta.trim())) nombre = v.replace(/\s+/g, " ").slice(0, 120);
  }
  // Sin etiqueta de correo: el primer valor que tenga forma de correo.
  if (!email) {
    const conForma = pares.find((p) => emailValido(p.valor));
    if (conForma) email = normalizarEmail(conForma.valor);
  }
  return { nombre, email, telefono };
}

/** El texto de la consulta que se crea a partir de un envío: «Etiqueta: valor», uno por línea. */
export function mensajeDeConsulta(titulo: string, pares: readonly ParEnvio[], max = 4000): string {
  const cuerpo = pares.map((p) => `${p.etiqueta}: ${p.valor}`).join("\n");
  return `Formulario del sitio «${titulo}»\n${cuerpo}`.slice(0, max);
}

/**
 * Lo que viaja al navegador con la página: la config SIN el contenido oculto ni la categoría y el
 * origen de la consulta (no le sirven a quien visita). El oculto lo devuelve el servidor recién
 * después de un envío válido.
 */
export function configPublicaDelFormulario(config: FormBlockConfig): FormBlockConfig {
  return { ...config, revealText: "", revealLinkLabel: "", revealLinkUrl: "", categoryId: "", origenId: "" };
}

/** Sólo una página del sitio (`/…`, nunca `//…`) o un enlace https. */
export function enlaceSeguroDelFormulario(valor: string | null | undefined, paginas?: PaginasDelSitio): string | null {
  const href = enlaceDeBoton(valor, paginas);
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) return href;
  return /^https:\/\/[^\s]+$/i.test(href) ? href : null;
}

export type ContenidoRevelado = { texto: string; enlace: { etiqueta: string; href: string } | null };

/** El contenido oculto de un bloque, listo para devolver después de un envío válido. */
export function contenidoRevelado(config: FormBlockConfig, paginas?: PaginasDelSitio): ContenidoRevelado | null {
  if (config.afterSubmit !== "reveal") return null;
  const href = enlaceSeguroDelFormulario(config.revealLinkUrl, paginas);
  const texto = config.revealText.trim();
  if (!texto && !href) return null;
  return { texto, enlace: href ? { etiqueta: config.revealLinkLabel.trim() || "Abrir", href } : null };
}

/** El mensaje de agradecimiento que corresponde (también si la redirección no tiene destino válido). */
export function mensajeDeGracias(config: Pick<FormBlockConfig, "thanksMessage">): string {
  return config.thanksMessage.trim() || FORM_DEFAULT_THANKS;
}

/** Busca un bloque por id en las secciones PUBLICADAS. Sólo los visibles cuentan. */
export function buscarBloquePublicado<T extends "FORM" | "NEWSLETTER">(
  sections: WebsiteSections,
  blockId: string,
  tipo: T,
): { block: T extends "FORM" ? FormBlock : NewsletterBlock; pageKey: string } | null {
  for (const [pageKey, blocks] of Object.entries(sections.pages)) {
    for (const b of blocks) {
      if (b.id === blockId && b.type === tipo && b.visible) {
        return { block: b as T extends "FORM" ? FormBlock : NewsletterBlock, pageKey };
      }
    }
  }
  return null;
}

/** La dirección pública de una página del sitio (`/w/<slug>` o `/w/<slug>/<página>`). */
export function paginaUrlDe(workspaceSlug: string, sections: WebsiteSections, pageKey: string): string {
  const base = `/w/${workspaceSlug}`;
  if (pageKey === "home") return base;
  const slug = sections.pageMeta[pageKey]?.slug;
  return slug ? `${base}/${slug}` : base;
}

export const ESTADOS_ENVIO = ["NUEVO", "LEIDO", "ARCHIVADO"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export function esEstadoEnvio(v: unknown): v is EstadoEnvio {
  return typeof v === "string" && (ESTADOS_ENVIO as readonly string[]).includes(v);
}

/**
 * Lo que se guarda en `datosJson`: la lista de pares, o `{ pares, fechaDesconocida: true }` para un
 * envío importado que vino sin fecha (su `createdAt` es el día de la importación, no el real).
 */
export function datosDeEnvioJson(pares: ParEnvio[], fechaDesconocida: boolean): ParEnvio[] | { pares: ParEnvio[]; fechaDesconocida: true } {
  return fechaDesconocida ? { pares, fechaDesconocida: true } : pares;
}

/** ¿El envío vino sin fecha? (ver `datosDeEnvioJson`). */
export function fechaDesconocidaDeJson(raw: unknown): boolean {
  return !!raw && typeof raw === "object" && !Array.isArray(raw) && (raw as { fechaDesconocida?: unknown }).fechaDesconocida === true;
}

/** Los pares guardados en `datosJson` (lista u objeto con `pares`), tolerando cualquier cosa rara. */
export function paresDeJson(datos: unknown): ParEnvio[] {
  const raw = datos && typeof datos === "object" && !Array.isArray(datos) ? (datos as { pares?: unknown }).pares : datos;
  if (!Array.isArray(raw)) return [];
  const out: ParEnvio[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const { etiqueta, valor } = item as { etiqueta?: unknown; valor?: unknown };
      if (typeof etiqueta === "string" && (typeof valor === "string" || typeof valor === "number")) out.push({ etiqueta, valor: String(valor) });
    }
  }
  return out;
}

export type FiltrosBandeja = {
  vista: "envios" | "suscriptores";
  formularioId: string | null;
  estado: EstadoEnvio | "TODOS" | null;
  estadoSuscriptor: "ACTIVO" | "BAJA" | "TODOS";
  q: string;
  pagina: number;
  envioId: string | null;
};

const ID_PARAM = /^[a-z0-9]{8,40}$/i;

/** Los filtros de Sitio web → Formularios a partir de la dirección, validados. */
export function filtrosDeLaBandeja(sp: Record<string, string | string[] | undefined>): FiltrosBandeja {
  const uno = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const formulario = uno("formulario");
  const estado = uno("estado").toUpperCase();
  const estadoSuscriptor = uno("estado").toUpperCase();
  const pagina = Number.parseInt(uno("pagina"), 10);
  const envio = uno("envio");
  const vista = uno("vista") === "suscriptores" ? "suscriptores" : "envios";
  return {
    vista,
    formularioId: ID_PARAM.test(formulario) ? formulario : null,
    estado: estado === "TODOS" ? "TODOS" : esEstadoEnvio(estado) ? estado : null,
    estadoSuscriptor: estadoSuscriptor === "BAJA" || estadoSuscriptor === "TODOS" ? estadoSuscriptor : "ACTIVO",
    q: uno("q").slice(0, 100),
    pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 10000) : 1,
    envioId: ID_PARAM.test(envio) ? envio : null,
  };
}

/** La dirección de la bandeja con estos filtros (sólo los que no son el valor por omisión). */
export function hrefDeLaBandeja(f: Partial<FiltrosBandeja>): string {
  const p = new URLSearchParams();
  if (f.vista === "suscriptores") {
    p.set("vista", "suscriptores");
    if (f.estadoSuscriptor && f.estadoSuscriptor !== "ACTIVO") p.set("estado", f.estadoSuscriptor);
  } else {
    if (f.formularioId) p.set("formulario", f.formularioId);
    if (f.estado) p.set("estado", f.estado);
    if (f.envioId) p.set("envio", f.envioId);
  }
  if (f.q) p.set("q", f.q);
  if (f.pagina && f.pagina > 1) p.set("pagina", String(f.pagina));
  const qs = p.toString();
  return `/website/formularios${qs ? `?${qs}` : ""}`;
}
