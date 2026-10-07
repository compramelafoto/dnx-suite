import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { formatMoney } from "@/lib/format";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { puedeEnContexto } from "@/lib/access/policy";
import type { ConsultaResuelta, ContextoListado, DefinicionListado } from "@/lib/listado/tipos";
import { CLIENT_KINDS, CLIENT_STATUSES, IVA_CONDITION_LABELS, type IvaCondition } from "./constants";
import {
  aplicarEtiquetaEnLote,
  buscarEtiquetasDelFiltro,
  ChipsEtiquetas,
  elegiblesPorExistencia,
  opcionesDeEtiquetaEnLote,
  SELECT_ETIQUETAS,
  unirEtiquetasDeFila,
  validarEtiquetaDelFiltro,
} from "@/lib/ficha/etiquetas-listado";
import { camposParaListado, conCampos, restriccionDeCampos } from "@/lib/campos/listado";
import { clientDisplayName } from "./display";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import {
  CATEGORIA_CONTACTO_SIN_PERFIL,
  CATEGORIAS_CONTACTO,
  ETIQUETA_CATEGORIA_CONTACTO,
  esCategoriaContacto,
} from "@/lib/consultas/constantes";

const SELECT_FILA = {
  id: true,
  clientNumber: true,
  kind: true,
  firstName: true,
  lastName: true,
  businessName: true,
  docType: true,
  docNumber: true,
  ivaCondition: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  status: true,
  createdAt: true,
  member: { select: { memberNumber: true } },
  fotofficeTags: SELECT_ETIQUETAS,
  // Perfil ampliado (etapa 1). Sin fila, el cliente cuenta como CLIENTE.
  fotofficePerfil: { select: { category: true, mobile: true, province: true } },
} satisfies Prisma.ClientSelect;

export type FilaCliente = Prisma.ClientGetPayload<{ select: typeof SELECT_FILA }>;

/** Los ids que llegan de una dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

const ETIQUETA_TIPO: Record<string, string> = { PERSONA: "Persona", EMPRESA: "Empresa" };
const ETIQUETA_ESTADO: Record<string, string> = { ACTIVO: "Activo", INACTIVO: "Inactivo" };

const fechaAR = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
const etiquetaIva = (v: string) => IVA_CONDITION_LABELS[v as IvaCondition] ?? v;

/** Categoría de contacto de una fila (sin perfil = CLIENTE). */
export function categoriaDeFila(f: { fotofficePerfil?: { category: string } | null }): (typeof CATEGORIAS_CONTACTO)[number] {
  const c = f.fotofficePerfil?.category;
  return esCategoriaContacto(c) ? c : CATEGORIA_CONTACTO_SIN_PERFIL;
}

/** Año más viejo de un cumpleaños válido (`validarPerfil` no acepta antes de 1900). */
const PRIMER_ANIO_CUMPLE = 1900;

/**
 * Filtro "Cumple este mes" (mes de Buenos Aires). `birthday` es una fecha de calendario (DATE) y
 * Prisma no filtra por mes: se arma un rango por año, de 1900 al actual (las fechas válidas).
 */
export function whereCumpleEnMes(ahora: Date = new Date()): Prisma.FotofficeContactoPerfilWhereInput {
  const [anio, mes] = hoyEnBuenosAires(ahora).split("-").map(Number) as [number, number];
  const rangos: Prisma.FotofficeContactoPerfilWhereInput[] = [];
  for (let y = PRIMER_ANIO_CUMPLE; y <= anio; y++) {
    rangos.push({ birthday: { gte: new Date(Date.UTC(y, mes - 1, 1)), lt: new Date(Date.UTC(y, mes, 1)) } });
  }
  return { OR: rangos };
}

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre, primero. */
export function whereClientes(workspaceId: string, c: ConsultaResuelta, ahora: Date = new Date()): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = { workspaceId };
  const campos = restriccionDeCampos(c);
  const q = c.q.trim();
  if (q) {
    const or: Prisma.ClientWhereInput[] = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { businessName: { contains: q, mode: "insensitive" } },
      { docNumber: { contains: q.replace(/[.\-\s]/g, "") } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
    if (/^\d{1,9}$/.test(q)) or.push({ clientNumber: Number(q) });
    if (campos.buscar) or.push(campos.buscar);
    where.OR = or;
  }
  if (campos.acotar) where.AND = [campos.acotar];
  if (c.filtros.tipo) where.kind = c.filtros.tipo;
  if (c.filtros.estado) where.status = c.filtros.estado;
  const alta = c.periodos.alta;
  if (alta) where.createdAt = { gte: alta.desde, lte: alta.hasta };
  if (c.filtros.etiqueta) where.fotofficeTags = { some: { tagId: c.filtros.etiqueta } };
  if (c.filtros.movimientos === "si") where.movements = { some: {} };
  else if (c.filtros.movimientos === "no") where.movements = { none: {} };
  // Perfil ampliado. Los dos filtros pueden ir juntos: van como AND sobre la relación.
  const perfil: Prisma.ClientWhereInput[] = [];
  const categoria = c.filtros.categoria;
  if (esCategoriaContacto(categoria)) {
    perfil.push(
      categoria === CATEGORIA_CONTACTO_SIN_PERFIL
        ? { OR: [{ fotofficePerfil: { is: null } }, { fotofficePerfil: { is: { category: categoria } } }] }
        : { fotofficePerfil: { is: { category: categoria } } },
    );
  }
  if (c.filtros.cumple === "este-mes") perfil.push({ fotofficePerfil: { is: whereCumpleEnMes(ahora) } });
  if (perfil.length > 0) where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...perfil];
  return where;
}

function ordenarPor(c: ConsultaResuelta): Prisma.ClientOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  // `id` desempata para que la paginación no repita ni saltee filas.
  switch (c.orden.campo) {
    case "nombre":
      return [{ lastName: dir }, { firstName: dir }, { businessName: dir }, { id: dir }];
    case "alta":
      return [{ createdAt: dir }, { id: dir }];
    default:
      return [{ clientNumber: dir }];
  }
}

async function panelCliente(ctx: ContextoListado, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  const c = await prisma.client.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { ...SELECT_FILA, member: { select: { id: true, memberNumber: true } } },
  });
  if (!c) return null;
  // Como el Consumo de main: los movimientos sólo con Caja encendida y Ver en Caja.
  const conCaja =
    puedeEnContexto(ctx, "verDinero", CASH_MODULE_KEY) &&
    (await isModuleEnabledForWorkspace(ctx.workspaceId, CASH_MODULE_KEY));
  const movimientos = conCaja
    ? await prisma.cashMovement.findMany({
        where: { workspaceId: ctx.workspaceId, clientId: c.id },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 5,
        select: { id: true, kind: true, amountArs: true, occurredAt: true, description: true },
      })
    : null;

  const datos: [string, string | null][] = [
    ["Tipo", ETIQUETA_TIPO[c.kind] ?? c.kind],
    ["Documento", c.docNumber ? `${c.docType ?? ""} ${c.docNumber}`.trim() : null],
    ["Condición IVA", etiquetaIva(c.ivaCondition)],
    ["Correo", c.email],
    ["Teléfono", c.phone],
    ["Domicilio", [c.address, c.city].filter(Boolean).join(", ") || null],
  ];

  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold text-[var(--fo-text)]">{clientDisplayName(c)}</h3>
      <dl className="space-y-2">
        {datos.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-[var(--fo-muted)]">{k}</dt>
            <dd className="text-right text-[var(--fo-text)]">{v ?? "—"}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fo-muted)]">Socio</dt>
          <dd className="text-right">
            {c.member ? (
              <Link href={`/members/${c.member.id}`} className="font-medium text-[var(--fo-accent)] hover:underline">
                Socio {c.member.memberNumber}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      {movimientos ? (
        <div className="space-y-2">
          <h4 className="font-semibold text-[var(--fo-text)]">Últimos movimientos de Caja</h4>
          {movimientos.length === 0 ? (
            <p className="text-[var(--fo-muted)]">Todavía no tiene movimientos.</p>
          ) : (
            <ul className="divide-y divide-[var(--fo-border)]">
              {movimientos.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-xs text-[var(--fo-muted)]">{fechaAR.format(m.occurredAt)}</span>
                    <span className="block truncate">{m.description}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {m.kind === "EGRESO" ? "−" : "+"}
                    {formatMoney(m.amountArs, "ARS")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const listadoClientes: DefinicionListado<FilaCliente> = {
  clave: "clientes",
  titulo: "Clientes",
  sustantivo: { singular: "cliente", plural: "clientes" },
  placeholderBusqueda: "Buscar por nombre, documento, correo o teléfono",
  columnas: [
    { clave: "numero", titulo: "N°", orden: "numero", celda: (f) => <span className="font-mono text-xs text-[var(--fo-muted)]">{f.clientNumber}</span> },
    {
      clave: "nombre",
      titulo: "Nombre",
      orden: "nombre",
      celda: (f) => (
        <Link href={`/clientes/${f.id}`} className="font-medium text-[var(--fo-text)] hover:underline">
          {clientDisplayName(f)}
        </Link>
      ),
    },
    { clave: "documento", titulo: "Documento", celda: (f) => f.docNumber ?? "—" },
    { clave: "correo", titulo: "Correo", secundaria: true, celda: (f) => f.email ?? "—" },
    { clave: "telefono", titulo: "Teléfono", secundaria: true, celda: (f) => f.phone ?? "—" },
    { clave: "socio", titulo: "Socio", celda: (f) => f.member?.memberNumber ?? "—" },
    {
      clave: "categoria",
      titulo: "Categoría",
      celda: (f) => (
        <span className="rounded-full bg-[var(--fo-accent-soft)] px-2 py-0.5 text-xs text-[var(--fo-text)]">
          {ETIQUETA_CATEGORIA_CONTACTO[categoriaDeFila(f)]}
        </span>
      ),
    },
    { clave: "celular", titulo: "Celular", secundaria: true, celda: (f) => f.fotofficePerfil?.mobile ?? "—" },
    { clave: "provincia", titulo: "Provincia", secundaria: true, celda: (f) => f.fotofficePerfil?.province ?? "—" },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => (
        <span className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
          {ETIQUETA_ESTADO[f.status] ?? f.status}
        </span>
      ),
    },
    { clave: "etiquetas", titulo: "Etiquetas", secundaria: true, celda: (f) => <ChipsEtiquetas etiquetas={unirEtiquetasDeFila(f.fotofficeTags)} /> },
    { clave: "alta", titulo: "Alta", orden: "alta", secundaria: true, celda: (f) => fechaAR.format(f.createdAt) },
  ],
  filtros: [
    { tipo: "opcion", clave: "tipo", etiqueta: "Tipo", opciones: CLIENT_KINDS.map((v) => ({ valor: v, etiqueta: ETIQUETA_TIPO[v] })) },
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: CLIENT_STATUSES.map((v) => ({ valor: v, etiqueta: ETIQUETA_ESTADO[v] })) },
    {
      tipo: "opcion",
      clave: "categoria",
      etiqueta: "Categoría de contacto",
      opciones: CATEGORIAS_CONTACTO.map((v) => ({ valor: v, etiqueta: ETIQUETA_CATEGORIA_CONTACTO[v] })),
    },
    { tipo: "opcion", clave: "cumple", etiqueta: "Cumpleaños", opciones: [{ valor: "este-mes", etiqueta: "Cumple este mes" }] },
    { tipo: "relacion", clave: "etiqueta", etiqueta: "Etiqueta", conBuscador: true },
    { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    // Plata de Caja: sólo con Ver en Caja, como el Consumo de main.
    { tipo: "siNo", clave: "movimientos", etiqueta: "Movimientos", si: "Con movimientos", no: "Sin movimientos", dinero: CASH_MODULE_KEY },
  ],
  ordenes: ["numero", "nombre", "alta"],
  ordenPorDefecto: { campo: "numero", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/clientes/${id}`,
  contar: (ctx, c) => prisma.client.count({ where: whereClientes(ctx.workspaceId, c) }),
  traer: (ctx, c, { skip, take }) =>
    prisma.client.findMany({ where: whereClientes(ctx.workspaceId, c), select: SELECT_FILA, orderBy: ordenarPor(c), skip, take }),
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.client.findMany({
      where: whereClientes(ctx.workspaceId, c),
      select: { id: true },
      orderBy: ordenarPor(c),
      take: tope,
    });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => {
    const validos = ids.filter((id) => ID_VALIDO.test(id));
    if (validos.length === 0) return [];
    const filas = await prisma.client.findMany({
      where: { workspaceId: ctx.workspaceId, id: { in: validos } },
      select: SELECT_FILA,
    });
    const porId = new Map(filas.map((f) => [f.id, f]));
    return validos.flatMap((id) => porId.get(id) ?? []);
  },
  validarRelacion: async (ctx, clave, id) => (clave === "etiqueta" ? validarEtiquetaDelFiltro(ctx, id) : null),
  buscarRelacion: async (ctx, clave, texto) => (clave === "etiqueta" ? buscarEtiquetasDelFiltro(ctx, texto) : []),
  acciones: [
    {
      clave: "etiqueta",
      etiqueta: "Agregar o quitar etiqueta",
      capacidad: "operar",
      maximo: 1000,
      confirmacion: "Vas a aplicar el cambio de etiqueta ({parametro}) a {n} clientes.",
      parametro: { etiqueta: "Etiqueta", opciones: opcionesDeEtiquetaEnLote },
      elegibles: async (ctx, ids) => {
        const filas = await prisma.client.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: ids } }, select: { id: true } });
        return elegiblesPorExistencia(ids, filas.map((f) => f.id));
      },
      aplicar: (ctx, ids, parametro) =>
        aplicarEtiquetaEnLote(ctx, ids, parametro, async (aCargar) => {
          const filas = await prisma.client.findMany({
            where: { workspaceId: ctx.workspaceId, id: { in: aCargar } },
            select: { id: true, memberId: true },
          });
          return filas.map((f) => ({ id: f.id, persona: { clientId: f.id, memberId: f.memberId } }));
        }),
    },
  ],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "numero", valor: (f) => f.clientNumber },
      { titulo: "Tipo", tipo: "texto", valor: (f) => ETIQUETA_TIPO[f.kind] ?? f.kind },
      { titulo: "Nombre", tipo: "texto", valor: (f) => clientDisplayName(f) },
      { titulo: "Razón social", tipo: "texto", valor: (f) => f.businessName },
      { titulo: "Tipo de documento", tipo: "texto", valor: (f) => f.docType },
      { titulo: "Documento", tipo: "texto", valor: (f) => f.docNumber },
      { titulo: "Condición IVA", tipo: "texto", valor: (f) => etiquetaIva(f.ivaCondition) },
      { titulo: "Correo", tipo: "texto", valor: (f) => f.email },
      { titulo: "Teléfono", tipo: "texto", valor: (f) => f.phone },
      { titulo: "Domicilio", tipo: "texto", valor: (f) => f.address },
      { titulo: "Ciudad", tipo: "texto", valor: (f) => f.city },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO[f.status] ?? f.status },
      { titulo: "Socio N°", tipo: "texto", valor: (f) => f.member?.memberNumber ?? null },
      { titulo: "Categoría de contacto", tipo: "texto", valor: (f) => ETIQUETA_CATEGORIA_CONTACTO[categoriaDeFila(f)] },
      { titulo: "Celular", tipo: "texto", valor: (f) => f.fotofficePerfil?.mobile ?? null },
      { titulo: "Provincia", tipo: "texto", valor: (f) => f.fotofficePerfil?.province ?? null },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
  panel: panelCliente,
};

/** La lista con los campos personalizados del workspace (columnas, filtros, búsqueda y exportación). */
export async function cargarListadoClientes(ctx: ContextoListado) {
  return conCampos(listadoClientes, await camposParaListado(ctx, "CLIENTE"));
}
