// Lógica pura (sin React) del globito de saludo, del enlace «?dnxbot=» y de la tarjeta de progreso escolar.
// Apta para el navegador: sólo importa de src/ui.
import { isInternalPath } from "./format";

export type GlobitoAccion = "CLICKED" | "DECLINED" | "DISMISSED";
export type GlobitoBoton = { label: string; mensaje: string | null; accion: GlobitoAccion };
export type Globito = { campaign: string; texto: string; botones: GlobitoBoton[] };

export type PasoEstado = "hecho" | "pendiente" | "no_aplica";
export type PasoProgreso = {
  n: number;
  id: string;
  titulo: string;
  estado: PasoEstado;
  opcional: boolean;
  enlace: string | null;
  detalle?: string;
};
/** Copia local del contrato `ProgresoEscolar` de la app (src/ui no puede importar de la app). */
export type ProgresoEscolar = {
  albumId: number | null;
  albumTitulo: string | null;
  schoolId: number | null;
  pasos: PasoProgreso[];
  hechos: number;
  total: number;
  siguiente: PasoProgreso | null;
  aMedias: boolean;
};

export const CAMPANIA_ESCOLAR = "escolar_en_curso";
const CAMPAIGN_RE = /^[a-z_]{1,40}$/;
const ACCIONES: readonly GlobitoAccion[] = ["CLICKED", "DECLINED", "DISMISSED"];
const ESTADOS: readonly PasoEstado[] = ["hecho", "pendiente", "no_aplica"];

/** Campaña pedida por el enlace del mail (`?dnxbot=<campaña>`); null si no hay o no es válida. */
export function parseDnxbotParam(search: string): string | null {
  const v = new URLSearchParams(search).get("dnxbot");
  return v && CAMPAIGN_RE.test(v) ? v : null;
}

/** La misma URL sin `dnxbot` (para que recargar la página no vuelva a abrir la ventana). */
export function stripDnxbotParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete("dnxbot");
  return u.pathname + u.search + u.hash;
}

/** Clave de sessionStorage donde queda la campaña del mail mientras la persona inicia sesión. */
export const DNXBOT_PENDIENTE_KEY = "dnxbot:pendiente";
/** Pasado este tiempo la campaña guardada ya no abre la ventana sola. */
export const DNXBOT_PENDIENTE_TTL_MS = 60 * 60 * 1000;

export type AlmacenSimple = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Campaña con la que arranca la burbuja. Si la URL trae `?dnxbot=` válido, la guarda en sessionStorage
 * (sobrevive al paso por el login, que pierde el parámetro) y la devuelve; si no, devuelve la guardada
 * y vigente. Cualquier error del almacenamiento se ignora.
 */
export function campaniaInicial(search: string, almacen: AlmacenSimple | null, now: number): string | null {
  const deUrl = parseDnxbotParam(search);
  if (deUrl) {
    try {
      almacen?.setItem(DNXBOT_PENDIENTE_KEY, JSON.stringify({ c: deUrl, t: now }));
    } catch {
      /* sin almacenamiento: sólo se usa la URL */
    }
    return deUrl;
  }
  try {
    const raw = almacen?.getItem(DNXBOT_PENDIENTE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { c?: unknown; t?: unknown };
    const c = typeof v.c === "string" ? parseDnxbotParam(`?dnxbot=${encodeURIComponent(v.c)}`) : null;
    const vigente = typeof v.t === "number" && now - v.t >= 0 && now - v.t < DNXBOT_PENDIENTE_TTL_MS;
    if (c && vigente) return c;
    almacen?.removeItem(DNXBOT_PENDIENTE_KEY);
    return null;
  } catch {
    return null;
  }
}

/** Se llama recién cuando la ventana se abrió con el bot habilitado. */
export function olvidarCampaniaPendiente(almacen: AlmacenSimple | null): void {
  try {
    almacen?.removeItem(DNXBOT_PENDIENTE_KEY);
  } catch {
    /* nada */
  }
}

export function estadoUrl(basePath: string, campaign: string | null): string {
  return campaign ? `${basePath}/estado?campaign=${encodeURIComponent(campaign)}` : `${basePath}/estado`;
}

/** Valida el globito que manda el servidor; cualquier cosa rara → null (no se muestra). */
export function parseGlobito(v: unknown): Globito | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Record<string, unknown>;
  if (typeof g.campaign !== "string" || typeof g.texto !== "string" || !g.texto.trim() || !Array.isArray(g.botones)) return null;
  const botones: GlobitoBoton[] = [];
  for (const b of g.botones as unknown[]) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    if (typeof r.label !== "string" || !r.label.trim()) continue;
    if (typeof r.accion !== "string" || !(ACCIONES as readonly string[]).includes(r.accion)) continue;
    const mensaje = typeof r.mensaje === "string" && r.mensaje.trim() ? r.mensaje : null;
    botones.push({ label: r.label, mensaje, accion: r.accion as GlobitoAccion });
  }
  return { campaign: g.campaign, texto: g.texto, botones };
}

/** Qué hace la burbuja al tocar un botón del globito. Con mensaje: registra, abre y lo manda. Sin mensaje: registra y oculta. */
export function botonGlobito(b: GlobitoBoton): { accion: GlobitoAccion; abrir: boolean; mensaje: string | null; ocultar: true } {
  return b.mensaje
    ? { accion: b.accion, abrir: true, mensaje: b.mensaje, ocultar: true }
    : { accion: b.accion === "CLICKED" ? "DECLINED" : b.accion, abrir: false, mensaje: null, ocultar: true };
}

/** Cuerpo del POST a /globito. */
export function globitoBody(campaign: string, accion: GlobitoAccion, answer?: string): string {
  return JSON.stringify(answer ? { campaign, accion, answer } : { campaign, accion });
}

function parsePaso(v: unknown): PasoProgreso | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.n !== "number" || typeof p.id !== "string" || typeof p.titulo !== "string") return null;
  if (typeof p.estado !== "string" || !(ESTADOS as readonly string[]).includes(p.estado)) return null;
  return {
    n: p.n,
    id: p.id,
    titulo: p.titulo,
    estado: p.estado as PasoEstado,
    opcional: p.opcional === true,
    enlace: typeof p.enlace === "string" ? p.enlace : null,
    ...(typeof p.detalle === "string" ? { detalle: p.detalle } : {}),
  };
}

/** Valida un `ProgresoEscolar` (del estado o del evento SSE `progreso`); si no tiene forma, null. */
export function parseProgreso(v: unknown): ProgresoEscolar | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  if (!Array.isArray(d.pasos)) return null;
  const pasos = (d.pasos as unknown[]).map(parsePaso);
  if (pasos.length === 0 || pasos.some((p) => p === null)) return null;
  const ok = pasos as PasoProgreso[];
  return {
    albumId: typeof d.albumId === "number" ? d.albumId : null,
    albumTitulo: typeof d.albumTitulo === "string" ? d.albumTitulo : null,
    schoolId: typeof d.schoolId === "number" ? d.schoolId : null,
    pasos: ok,
    hechos: typeof d.hechos === "number" ? d.hechos : ok.filter((p) => p.estado === "hecho").length,
    total: typeof d.total === "number" ? d.total : ok.length,
    siguiente: parsePaso(d.siguiente),
    aMedias: d.aMedias === true,
  };
}

/** Tarjeta de progreso inicial: sólo cuando el globito del estado es el del álbum escolar en curso. */
export function progresoInicial(estado: { globito?: unknown; progresoEscolar?: unknown } | null): ProgresoEscolar | null {
  const g = parseGlobito(estado?.globito);
  if (!g || g.campaign !== CAMPANIA_ESCOLAR) return null;
  return parseProgreso(estado?.progresoEscolar);
}

const QUERY_RE = /^[a-z0-9_-]+=[a-z0-9_-]*(?:&[a-z0-9_-]+=[a-z0-9_-]*)*$/;

/** Enlace interno seguro: ruta con el mismo criterio que `formatBotText`, más una query simple (`?tab=x&pub=y`). */
export function enlaceInterno(href: string | null | undefined): string | null {
  if (!href) return null;
  const q = href.indexOf("?");
  const path = q === -1 ? href : href.slice(0, q);
  const query = q === -1 ? "" : href.slice(q + 1);
  if (!isInternalPath(path)) return null;
  if (q !== -1 && !QUERY_RE.test(query)) return null;
  return href;
}

export type MarcaPaso = "✓" | "○" | "—";
export type FilaPaso = { n: number; titulo: string; marca: MarcaPaso; estadoTexto: string; opcional: boolean; esSiguiente: boolean; detalle?: string };
export type TarjetaProgreso = {
  encabezado: string;
  titulo: string | null;
  aviso: string | null;
  filas: FilaPaso[];
  siguiente: { n: number; titulo: string; enlace: string | null; mensaje: string } | null;
};

const MARCA: Record<PasoEstado, MarcaPaso> = { hecho: "✓", pendiente: "○", no_aplica: "—" };
const ESTADO_TEXTO: Record<PasoEstado, string> = { hecho: "hecho", pendiente: "pendiente", no_aplica: "no aplica" };

export function haceloPorMiMensaje(titulo: string): string {
  return `Hacé por mí el paso: ${titulo}`;
}

/** Elige el paso siguiente: el que manda el servidor si sigue pendiente; si no, el primer pendiente obligatorio, o el primer pendiente. */
export function pasoSiguiente(p: ProgresoEscolar): PasoProgreso | null {
  const delServidor = p.siguiente ? p.pasos.find((x) => x.n === p.siguiente!.n) : undefined;
  if (delServidor && delServidor.estado === "pendiente") return delServidor;
  return p.pasos.find((x) => x.estado === "pendiente" && !x.opcional) ?? p.pasos.find((x) => x.estado === "pendiente") ?? null;
}

/** Lo que muestra la tarjeta de progreso escolar. */
export function tarjetaProgreso(p: ProgresoEscolar): TarjetaProgreso {
  const sig = pasoSiguiente(p);
  return {
    encabezado: sig ? `Paso ${sig.n} de ${p.total}` : `Todos los pasos listos (${p.total} de ${p.total})`,
    titulo: p.albumTitulo,
    aviso: p.aMedias ? "El álbum está marcado como escolar pero no tiene escuela: queda a medias." : null,
    filas: p.pasos.map((x) => ({
      n: x.n,
      titulo: x.titulo,
      marca: MARCA[x.estado],
      estadoTexto: ESTADO_TEXTO[x.estado],
      opcional: x.opcional,
      esSiguiente: sig?.n === x.n,
      ...(x.detalle ? { detalle: x.detalle } : {}),
    })),
    siguiente: sig ? { n: sig.n, titulo: sig.titulo, enlace: enlaceInterno(sig.enlace), mensaje: haceloPorMiMensaje(sig.titulo) } : null,
  };
}
