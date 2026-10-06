import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto, type AccesoEfectivo } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { soloDigitos } from "@/lib/clients/match";
import { diffCampos, type Actor } from "@/lib/ficha/eventos";
import {
  CATEGORIA_CONTACTO_SIN_PERFIL,
  esCategoriaContacto,
  type CategoriaContacto,
} from "@/lib/consultas/constantes";

/**
 * Perfil ampliado del contacto (`FotofficeContactoPerfil`, 1:1 con `Client`): categoría, celular,
 * segundo correo, cumpleaños, web, provincia, país, código postal y "Sobre".
 *
 * `Client` no recibe columnas (el esquema es compartido): estos datos viven aparte. Un cliente
 * sin perfil es uno de antes de la etapa 1 y cuenta como CLIENTE.
 */

export type CtxContacto = {
  workspaceId: string;
  userId: number;
  userLabel: string;
  role: string | null;
  acceso?: AccesoEfectivo;
};

export type PerfilContacto = {
  category: CategoriaContacto;
  mobile: string | null;
  email2: string | null;
  /** "aaaa-mm-dd" (columna DATE: es una fecha de calendario, sin hora). */
  birthday: string | null;
  website: string | null;
  province: string | null;
  country: string | null;
  postalCode: string | null;
  about: string | null;
  /** false: el cliente no tiene fila de perfil (se muestran los valores por defecto). */
  tienePerfil: boolean;
};

/** Lo que llega del formulario. Un campo ausente (undefined) no se toca; "" lo borra. */
export type DatosPerfil = Partial<Record<Exclude<keyof PerfilContacto, "tienePerfil">, unknown>>;

export type ResultadoPerfil =
  | { ok: true }
  | { ok: false; error: string; errores?: Record<string, string> };

export const MENSAJES_PERFIL = {
  sinPermiso: "No tenés permiso para hacer esto.",
  noEncontrado: "No encontramos ese contacto.",
  revisar: "Revisá los campos marcados.",
  categoria: "Elegí una categoría de la lista.",
  celular: "Escribí un celular válido (sólo números, de 6 a 20).",
  correo: "Escribí un correo válido.",
  fecha: "Escribí una fecha válida.",
  web: "Escribí una dirección web válida.",
  largo: "Es demasiado largo.",
} as const;

/** Campos del perfil que van al historial del cliente (`ClientAudit`), con su etiqueta. */
export const CAMPOS_AUDITADOS_PERFIL = [
  "category",
  "mobile",
  "email2",
  "birthday",
  "website",
  "province",
  "country",
  "postalCode",
  "about",
] as const;
type CampoPerfil = (typeof CAMPOS_AUDITADOS_PERFIL)[number];

const MAX_LARGO: Record<Exclude<CampoPerfil, "category" | "birthday" | "mobile">, number> = {
  email2: 200,
  website: 500,
  province: 100,
  country: 100,
  postalCode: 20,
  about: 4000,
};

/** Tope de ids por lectura en lote (una página de listado nunca llega). */
const MAX_IDS = 500;

const PERFIL_VACIO: Omit<PerfilContacto, "tienePerfil"> = {
  category: CATEGORIA_CONTACTO_SIN_PERFIL,
  mobile: null,
  email2: null,
  birthday: null,
  website: null,
  province: null,
  country: null,
  postalCode: null,
  about: null,
};

const SELECT_PERFIL = {
  clientId: true,
  category: true,
  mobile: true,
  email2: true,
  birthday: true,
  website: true,
  province: true,
  country: true,
  postalCode: true,
  about: true,
} as const;

type FilaPerfil = {
  category: string;
  mobile: string | null;
  email2: string | null;
  birthday: Date | null;
  website: string | null;
  province: string | null;
  country: string | null;
  postalCode: string | null;
  about: string | null;
};

function aPerfil(f: FilaPerfil | null): PerfilContacto {
  if (!f) return { ...PERFIL_VACIO, tienePerfil: false };
  return {
    category: esCategoriaContacto(f.category) ? f.category : CATEGORIA_CONTACTO_SIN_PERFIL,
    mobile: f.mobile,
    email2: f.email2,
    birthday: f.birthday ? f.birthday.toISOString().slice(0, 10) : null,
    website: f.website,
    province: f.province,
    country: f.country,
    postalCode: f.postalCode,
    about: f.about,
    tienePerfil: true,
  };
}

/**
 * Perfiles de varios clientes del workspace, en una sola lectura. Todo id pedido tiene entrada
 * (los que no tienen perfil, con los valores por defecto); los de otro workspace o inválidos no.
 */
export async function perfilDe(workspaceId: string, clientIds: readonly unknown[]): Promise<Map<string, PerfilContacto>> {
  const ids = [...new Set(clientIds.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 100))]
    .slice(0, MAX_IDS);
  const out = new Map<string, PerfilContacto>();
  if (ids.length === 0) return out;
  const [clientes, perfiles] = await Promise.all([
    prisma.client.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true } }),
    prisma.fotofficeContactoPerfil.findMany({ where: { workspaceId, clientId: { in: ids } }, select: SELECT_PERFIL }),
  ]);
  const porCliente = new Map(perfiles.map((p) => [p.clientId, p]));
  for (const c of clientes) out.set(c.id, aPerfil(porCliente.get(c.id) ?? null));
  return out;
}

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "" o null → null; otro valor → texto recortado. undefined → undefined (no se toca). */
function texto(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  return v.trim() || null;
}

type Normalizados = Partial<Record<CampoPerfil, string | null>>;

/** Valida y normaliza lo que llega. Devuelve los errores por campo. */
export function validarPerfil(datos: DatosPerfil): { ok: true; valores: Normalizados } | { ok: false; errores: Record<string, string> } {
  const errores: Record<string, string> = {};
  const valores: Normalizados = {};
  if (!datos || typeof datos !== "object") return { ok: false, errores: { _: MENSAJES_PERFIL.revisar } };

  for (const campo of CAMPOS_AUDITADOS_PERFIL) {
    const crudo = datos[campo];
    if (crudo === undefined) continue;
    if (crudo !== null && typeof crudo !== "string") {
      errores[campo] = MENSAJES_PERFIL.revisar;
      continue;
    }
    const v = texto(crudo) ?? null;

    if (campo === "category") {
      if (!esCategoriaContacto(v)) errores[campo] = MENSAJES_PERFIL.categoria;
      else valores.category = v;
      continue;
    }
    if (v === null) {
      valores[campo] = null;
      continue;
    }
    if (campo === "mobile") {
      const d = soloDigitos(v);
      if (d.length < 6 || d.length > 20) errores[campo] = MENSAJES_PERFIL.celular;
      else valores.mobile = d;
      continue;
    }
    if (campo === "birthday") {
      const m = RE_FECHA.exec(v);
      const fecha = m ? new Date(`${v}T00:00:00.000Z`) : null;
      const valida =
        fecha !== null &&
        !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === v &&
        Number(m![1]) >= 1900 &&
        fecha.getTime() <= Date.now();
      if (!valida) errores[campo] = MENSAJES_PERFIL.fecha;
      else valores.birthday = v;
      continue;
    }
    if (v.length > MAX_LARGO[campo]) {
      errores[campo] = MENSAJES_PERFIL.largo;
      continue;
    }
    if (campo === "email2") {
      if (!RE_CORREO.test(v)) errores[campo] = MENSAJES_PERFIL.correo;
      else valores.email2 = v.toLowerCase();
      continue;
    }
    if (campo === "website") {
      const conProtocolo = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      let url: URL | null = null;
      try {
        url = new URL(conProtocolo);
      } catch {
        url = null;
      }
      if (!url || !url.hostname.includes(".") || /\s/.test(v)) errores[campo] = MENSAJES_PERFIL.web;
      else valores.website = conProtocolo;
      continue;
    }
    valores[campo] = v;
  }
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, valores };
}

/** El perfil como valores comparables del historial (fecha como "aaaa-mm-dd"). */
function comparable(p: PerfilContacto): Record<CampoPerfil, string | null> {
  const { tienePerfil: _ignorado, ...resto } = p;
  return resto;
}

/** Columnas a escribir a partir de los valores normalizados. */
function columnas(v: Normalizados): Prisma.FotofficeContactoPerfilUncheckedUpdateInput {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    out[k] = k === "birthday" ? (x === null ? null : new Date(`${x}T00:00:00.000Z`)) : x;
  }
  return out as Prisma.FotofficeContactoPerfilUncheckedUpdateInput;
}

/**
 * Guarda el perfil de un cliente del workspace. Exige `operar` en Clientes. Valida todo antes de
 * escribir; en la misma transacción crea o actualiza el perfil y anota en `ClientAudit` sólo los
 * campos que cambiaron, como el resto de la ficha. Sin cambios, no escribe nada.
 */
export async function guardarPerfil(ctx: CtxContacto, clientId: unknown, datos: DatosPerfil): Promise<ResultadoPerfil> {
  if (!puedeEnContexto(ctx, "operar", CLIENTS_MODULE_KEY)) return { ok: false, error: MENSAJES_PERFIL.sinPermiso };
  if (typeof clientId !== "string" || !clientId || clientId.length > 100) return { ok: false, error: MENSAJES_PERFIL.noEncontrado };
  const validado = validarPerfil(datos);
  if (!validado.ok) return { ok: false, error: MENSAJES_PERFIL.revisar, errores: validado.errores };
  const actor: Actor = { userId: ctx.userId, label: ctx.userLabel };

  return prisma.$transaction(async (tx) => {
    const cliente = await tx.client.findFirst({ where: { id: clientId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!cliente) return { ok: false as const, error: MENSAJES_PERFIL.noEncontrado };
    const fila = await tx.fotofficeContactoPerfil.findFirst({
      where: { clientId, workspaceId: ctx.workspaceId },
      select: SELECT_PERFIL,
    });
    const antes = comparable(aPerfil(fila));
    const despues = { ...antes, ...validado.valores };
    const cambios = diffCampos(antes, despues, CAMPOS_AUDITADOS_PERFIL);
    if (Object.keys(cambios).length === 0) return { ok: true as const };

    const data = columnas(Object.fromEntries(Object.keys(cambios).map((k) => [k, despues[k as CampoPerfil]])));
    if (fila) {
      await tx.fotofficeContactoPerfil.update({ where: { clientId }, data, select: { id: true } });
    } else {
      await tx.fotofficeContactoPerfil.create({
        data: { ...(data as Record<string, unknown>), workspaceId: ctx.workspaceId, clientId } as Prisma.FotofficeContactoPerfilUncheckedCreateInput,
        select: { id: true },
      });
    }
    await tx.clientAudit.create({
      data: {
        workspaceId: ctx.workspaceId,
        clientId,
        action: "UPDATED",
        actorUserId: actor.userId,
        actorLabel: actor.label,
        changesJson: cambios as Prisma.InputJsonValue,
      },
    });
    return { ok: true as const };
  });
}

/**
 * Una consulta ganada pasa a su contacto de CONTACTO a CLIENTE (spec §3.3). Las otras
 * categorías no se tocan, y un cliente sin perfil ya cuenta como CLIENTE. Corre en la
 * transacción de quien llama y anota el cambio en el historial. Devuelve si cambió.
 */
export async function marcarClienteSiGana(
  tx: Prisma.TransactionClient,
  clientId: string,
  actor: Actor = { userId: null, label: "Sistema" },
): Promise<boolean> {
  const perfil = await tx.fotofficeContactoPerfil.findFirst({
    where: { clientId, category: "CONTACTO" },
    select: { workspaceId: true },
  });
  if (!perfil) return false;
  // Con la categoría en el `where`: si otro cambio ganó la carrera, no se pisa.
  const { count } = await tx.fotofficeContactoPerfil.updateMany({
    where: { clientId, category: "CONTACTO" },
    data: { category: "CLIENTE" },
  });
  if (count === 0) return false;
  await tx.clientAudit.create({
    data: {
      workspaceId: perfil.workspaceId,
      clientId,
      action: "UPDATED",
      actorUserId: actor.userId,
      actorLabel: actor.label,
      changesJson: { category: { before: "CONTACTO", after: "CLIENTE" } } as Prisma.InputJsonValue,
    },
  });
  return true;
}
