/**
 * Nombres para mostrar de los valores de Contactos DNX (tipos, nichos, regiones, estados…). Módulo
 * PURO: lo usan el panel (servidor y cliente) y el CSV. Si un valor no tiene nombre, se muestra tal cual.
 */
import type { EstadoContacto, FuenteDato, Plataforma, Region, TipoContacto } from "./tipos";

export const ETIQUETA_TIPO: Record<TipoContacto, string> = {
  FOTOGRAFO: "Fotógrafo",
  ESCUELA: "Escuela",
  CLUB: "Club",
  ORGANIZADOR_EVENTOS: "Organizador de eventos",
  ASOCIACION_FOTOGRAFOS: "Asociación de fotógrafos",
  ORGANIZADOR_MUESTRAS: "Organizador de muestras",
  EMPRESA_TURISMO: "Empresa de turismo",
  NEGOCIO_FOTOGRAFIA: "Negocio de fotografía",
  OTRO: "Otro",
};

export const ETIQUETA_NICHO: Record<string, string> = {
  ESCOLAR: "Escolar",
  DEPORTIVA: "Deportiva",
  TURISTICA: "Turística",
  SOCIAL: "Social",
  EVENTOS: "Eventos",
  FOTO_CARNET: "Foto carnet",
  CORPORATIVA: "Corporativa",
  MASCOTAS_NEWBORN_FAMILIA: "Mascotas, newborn y familia",
};

export const ETIQUETA_REGION: Record<Region, string> = {
  CENTRO: "Centro",
  BUENOS_AIRES_AMBA: "Buenos Aires y AMBA",
  CUYO: "Cuyo",
  NOA: "Noroeste (NOA)",
  NEA: "Noreste (NEA)",
  PATAGONIA: "Patagonia",
};

export const ETIQUETA_ESTADO: Record<EstadoContacto, string> = {
  NUEVO: "Nuevo",
  REVISADO: "Revisado",
  CONTACTADO: "Contactado",
  RESPONDIO: "Respondió",
  SE_SUMO: "Se sumó",
  NO_INTERESA: "No le interesa",
  DESCARTADO: "Descartado",
  NO_CONTACTAR: "No contactar",
};

export const VINCULOS_FILTRO = ["CONOCIDO_DNX_ESTUDIO", "USUARIO_CLF", "NINGUNO"] as const;
export type VinculoFiltro = (typeof VINCULOS_FILTRO)[number];

export const ETIQUETA_VINCULO: Record<VinculoFiltro, string> = {
  CONOCIDO_DNX_ESTUDIO: "Conocido de DNX Estudio",
  USUARIO_CLF: "Usuario de CLF",
  NINGUNO: "Sin vínculo",
};

export const ETIQUETA_FUENTE: Record<FuenteDato, string> = {
  SITIO_PROPIO: "Su propio sitio",
  WEB_SEARCH: "Búsqueda en la web",
  ALBOOM: "Clientes de DNX Estudio",
  MANUAL: "Cargado a mano",
  CLF: "CLF",
};

export const ETIQUETA_PLATAFORMA: Record<Plataforma, string> = {
  CLF: "ComprameLaFoto",
  INFOSPOT: "Infospot",
  MUESTRAS: "Muestras Fotográficas",
  FOTOFFICE: "FOTOFFICE",
};

export const ETIQUETA_CAMPO: Record<string, string> = {
  web: "Web",
  instagram: "Instagram",
  facebook: "Facebook",
  email: "Correo",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
};

/** Quién hizo algo: los agentes firman con su nombre. Las personas (userId) se resuelven aparte. */
export const ETIQUETA_AUTOR: Record<string, string> = {
  BUSCADOR: "el Buscador",
  MUESTRAS: "el agente de Muestras",
  RADAR: "el Radar",
  CARGA_INICIAL: "la carga inicial",
  SISTEMA: "el sistema",
  MANUAL: "a mano",
};

function de(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "";
  return mapa[valor] ?? valor;
}

export const etiquetaTipo = (v: string | null | undefined) => de(ETIQUETA_TIPO, v);
export const etiquetaRegion = (v: string | null | undefined) => de(ETIQUETA_REGION, v);
export const etiquetaEstado = (v: string | null | undefined) => de(ETIQUETA_ESTADO, v);
export const etiquetaVinculo = (v: string | null | undefined) => de(ETIQUETA_VINCULO, v ?? "NINGUNO");
export const etiquetaFuente = (v: string | null | undefined) => de(ETIQUETA_FUENTE, v);
export const etiquetaCampo = (v: string | null | undefined) => de(ETIQUETA_CAMPO, v);
export const etiquetaPlataforma = (v: string | null | undefined) => de(ETIQUETA_PLATAFORMA, v);

/** `OTRO:<texto>` se muestra como «Otro: texto». */
export function etiquetaNicho(v: string): string {
  if (v.startsWith("OTRO:")) return `Otro: ${v.slice(5).trim()}`;
  return ETIQUETA_NICHO[v] ?? v;
}
