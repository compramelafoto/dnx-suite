/**
 * Control remoto desde el celular para pantallas que se proyectan (presentaciones, sorteos).
 *
 * La pantalla grande publica qué se puede hacer (`EstadoPantalla`) y el celular manda órdenes
 * (`Comando`). Las dos partes se consultan cada pocos cientos de milisegundos contra la base: no
 * hay canal en vivo en DNX y una charla no necesita más que eso.
 *
 * Archivo puro (sin servidor): lo usan la pantalla, el celular y las rutas de la API. Hay una copia
 * idéntica en ComprameLaFoto (`apps/compramelafoto/lib/control-remoto/protocolo.ts`).
 */

/** Cuánto vive una sesión de control desde que se abre el QR. */
export const DURACION_SESION_MS = 6 * 60 * 60 * 1000;
/** Cada cuánto pregunta la pantalla si llegaron órdenes. */
export const INTERVALO_PANTALLA_MS = 700;
/** Cada cuánto el celular vuelve a leer qué muestra la pantalla. */
export const INTERVALO_CELULAR_MS = 1000;
/** Sin noticias de la otra parte en este tiempo, se la da por desconectada. */
export const SIN_LATIDO_MS = 10_000;

export type BotonRemoto = {
  id: string;
  etiqueta: string;
  tono?: "principal" | "secundario" | "peligro";
  deshabilitado?: boolean;
  /** Pregunta que el celular hace antes de mandar la orden. */
  confirmar?: string;
};

export type ItemRemoto = { id: string; etiqueta: string; grupo?: string; nota?: string };

export type EstadoPantalla = {
  titulo: string;
  /** «Placa 3 de 40». */
  posicion?: { actual: number; total: number; nombre: string };
  /** Lo que se ve ahora en grande. */
  detalle?: string;
  /** Texto de apoyo para quien presenta (no lo ve el público). */
  nota?: string;
  /** Un aviso pasajero: «Sorteando…». */
  aviso?: string;
  navegacion?: { anterior: boolean; siguiente: boolean };
  botones?: BotonRemoto[];
  lista?: { titulo: string; actual: string | null; items: ItemRemoto[] };
};

export type Comando =
  | { tipo: "anterior" }
  | { tipo: "siguiente" }
  | { tipo: "ir"; id: string }
  | { tipo: "boton"; id: string };

export type ComandoNumerado = { seq: number; comando: Comando };

const corto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Lo que manda el celular, ya validado (o null si no es una orden conocida). */
export function sanearComando(v: unknown): Comando | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (c.tipo === "anterior" || c.tipo === "siguiente") return { tipo: c.tipo };
  if ((c.tipo === "ir" || c.tipo === "boton") && typeof c.id === "string" && c.id && c.id.length <= 120) {
    return { tipo: c.tipo, id: c.id };
  }
  return null;
}

/** Lo que publica la pantalla, recortado para que no crezca sin límite. */
export function sanearEstado(v: unknown): EstadoPantalla | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const titulo = corto(e.titulo, 160);
  if (!titulo) return null;
  const pos = e.posicion as Record<string, unknown> | undefined;
  const nav = e.navegacion as Record<string, unknown> | undefined;
  const lista = e.lista as Record<string, unknown> | undefined;
  return {
    titulo,
    posicion:
      pos && Number.isInteger(pos.actual) && Number.isInteger(pos.total)
        ? { actual: Number(pos.actual), total: Number(pos.total), nombre: corto(pos.nombre, 40) ?? "" }
        : undefined,
    detalle: corto(e.detalle, 300),
    nota: corto(e.nota, 1500),
    aviso: corto(e.aviso, 160),
    navegacion: nav ? { anterior: Boolean(nav.anterior), siguiente: Boolean(nav.siguiente) } : undefined,
    botones: Array.isArray(e.botones)
      ? e.botones.slice(0, 12).flatMap((b): BotonRemoto[] => {
          const x = b as Record<string, unknown>;
          const id = corto(x?.id, 120);
          const etiqueta = corto(x?.etiqueta, 80);
          if (!id || !etiqueta) return [];
          const tono = x.tono === "principal" || x.tono === "peligro" ? x.tono : "secundario";
          return [{ id, etiqueta, tono, deshabilitado: Boolean(x.deshabilitado), confirmar: corto(x.confirmar, 200) }];
        })
      : undefined,
    lista:
      lista && Array.isArray(lista.items)
        ? {
            titulo: corto(lista.titulo, 60) ?? "Lista",
            actual: corto(lista.actual, 120) ?? null,
            items: lista.items.slice(0, 200).flatMap((i): ItemRemoto[] => {
              const x = i as Record<string, unknown>;
              const id = corto(x?.id, 120);
              const etiqueta = corto(x?.etiqueta, 160);
              return id && etiqueta ? [{ id, etiqueta, grupo: corto(x.grupo, 80), nota: corto(x.nota, 120) }] : [];
            }),
          }
        : undefined,
  };
}
