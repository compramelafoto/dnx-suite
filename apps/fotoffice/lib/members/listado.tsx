import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { MemberConcurrencyError, updateMember } from "@repo/db/fotoffice-members";
import {
  isMemberAccessFilter,
  MEMBER_ACCESS_FILTER_LABELS,
  memberAccessWhere,
  type MemberAccessFilter,
} from "@repo/db/fotoffice-member-access-filter";
import { formatMoney } from "@/lib/format";
import { cargoImpagoWhere } from "@/lib/membership/dues-overview";
import type { ConsultaResuelta, ContextoListado, DefinicionListado, Opcion, ResultadoLote } from "@/lib/listado/tipos";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
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
import { auditActorFrom, type AuditActorUser } from "./audit";
import { normalizeDocument } from "./documents";
import { inviteOneMember } from "./invite-member";
import { INVITE_BATCH_MAX, MEMBER_ACCESS_LABELS, memberAccessStatus } from "./invitations";
import type { MemberStatus } from "./status-labels";

const SELECT_FILA = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  documentType: true,
  documentNumber: true,
  email: true,
  phone: true,
  birthDate: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  joinedAt: true,
  status: true,
  notes: true,
  userId: true,
  category: { select: { name: true } },
  // Las etiquetas del socio y las del cliente vinculado (ahí viven las nuevas).
  fotofficeTags: SELECT_ETIQUETAS,
  clientLink: { select: { fotofficeTags: SELECT_ETIQUETAS } },
  // Sólo la última: de ella sale el estado de acceso de la fila, como en la pantalla anterior.
  invitations: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { acceptedAt: true, revokedAt: true, expiresAt: true, sentAt: true, sendFailedAt: true },
  },
} satisfies Prisma.MemberSelect;

export type FilaSocio = Prisma.MemberGetPayload<{ select: typeof SELECT_FILA }>;

/** Los ids que llegan de una dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

const ESTADOS: readonly MemberStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];
const ETIQUETA_ESTADO: Record<MemberStatus, string> = { ACTIVE: "Activo", SUSPENDED: "Suspendido", INACTIVE: "Baja" };
const COLOR_ESTADO: Record<MemberStatus, string> = {
  ACTIVE: "text-[var(--fo-success)]",
  SUSPENDED: "text-[var(--fo-text)]",
  INACTIVE: "text-[var(--fo-muted)]",
};
const ACCESOS = Object.keys(MEMBER_ACCESS_FILTER_LABELS) as MemberAccessFilter[];

const fechaAR = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
// Ingreso y nacimiento son días de calendario guardados a medianoche UTC: se leen en UTC, como
// hacía la pantalla anterior, para no mostrarlos un día antes.
const diaUTC = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

/** El mismo día de calendario al mediodía UTC: la exportación lo formatea en hora argentina sin correrlo. */
function diaCalendario(d: Date | null): Date | null {
  return d ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)) : null;
}

const etiquetaEstado = (s: string) => ETIQUETA_ESTADO[s as MemberStatus] ?? s;
const nombreCompleto = (f: { lastName: string; firstName: string }) => `${f.lastName}, ${f.firstName}`;

function etiquetaAcceso(f: FilaSocio): string {
  if (!f.email?.trim() && f.userId === null) return "Sin email";
  return MEMBER_ACCESS_LABELS[memberAccessStatus(f, f.invitations[0])];
}

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre, primero. */
export function whereSocios(workspaceId: string, c: ConsultaResuelta): Prisma.MemberWhereInput {
  const where: Prisma.MemberWhereInput = { workspaceId };
  const campos = restriccionDeCampos(c);
  const q = c.q.trim();
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { memberNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      ...(campos.buscar ? [campos.buscar] : []),
    ];
  }
  const estado = c.filtros.estado;
  if (estado && (ESTADOS as readonly string[]).includes(estado)) where.status = estado as MemberStatus;
  if (c.filtros.categoria) where.categoryId = c.filtros.categoria;
  const acceso = c.filtros.acceso;
  // Dentro de un AND y no desparramado: "Sin email" es un OR y pisaría el de la búsqueda.
  const and: Prisma.MemberWhereInput[] = [];
  if (acceso && isMemberAccessFilter(acceso)) and.push(memberAccessWhere(acceso));
  // Las etiquetas viven en el socio o en su cliente vinculado; también dentro del AND por el OR de la búsqueda.
  const etiqueta = c.filtros.etiqueta;
  if (etiqueta) and.push({ OR: [{ fotofficeTags: { some: { tagId: etiqueta } } }, { clientLink: { fotofficeTags: { some: { tagId: etiqueta } } } }] });
  if (campos.acotar) and.push(campos.acotar);
  if (and.length > 0) where.AND = and;
  if (c.filtros.deuda === "si") where.charges = { some: cargoImpagoWhere(workspaceId) };
  else if (c.filtros.deuda === "no") where.charges = { none: cargoImpagoWhere(workspaceId) };
  return where;
}

function ordenarPor(c: ConsultaResuelta): Prisma.MemberOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  // `id` desempata para que la paginación no repita ni saltee filas.
  switch (c.orden.campo) {
    case "numero":
      return [{ memberNumber: dir }, { id: dir }];
    case "categoria":
      return [{ category: { name: dir } }, { lastName: "asc" }, { firstName: "asc" }, { id: "asc" }];
    case "alta":
      return [{ joinedAt: dir }, { id: dir }];
    default:
      return [{ lastName: dir }, { firstName: dir }, { id: dir }];
  }
}

/** Nunca una etiqueta vacía en el historial. */
function etiquetaDelLote(ctx: ContextoListado): string {
  return ctx.userLabel.trim() || `Usuario ${ctx.userId}`;
}

/** Actor de la auditoría, con la forma que devuelve `auditActorFrom`. */
function actorDelLote(ctx: ContextoListado): ReturnType<typeof auditActorFrom> {
  return { userId: ctx.userId, label: etiquetaDelLote(ctx) };
}

/** Quien invita: sin correo inventado; `auditActorFrom` toma el nombre. */
function usuarioDelLote(ctx: ContextoListado): AuditActorUser {
  return { id: ctx.userId, name: etiquetaDelLote(ctx), email: null };
}

async function categoriasActivas(ctx: ContextoListado): Promise<Opcion[]> {
  const cats = await prisma.memberCategory.findMany({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  return cats.map((c) => ({ valor: c.id, etiqueta: c.name }));
}

async function cambiarCategoria(ctx: ContextoListado, ids: string[], parametro: string | null): Promise<ResultadoLote> {
  // El motor ya validó la opción; se revalida acá porque esto escribe.
  const categoria =
    parametro && ID_VALIDO.test(parametro)
      ? await prisma.memberCategory.findFirst({
          where: { id: parametro, workspaceId: ctx.workspaceId, isActive: true },
          select: { id: true },
        })
      : null;
  if (!categoria) return { aplicados: 0, fallidos: ids.map((id) => ({ id, error: "categoría no válida" })), detalle: [] };

  const anteriores = await prisma.member.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: ids } },
    select: { id: true, categoryId: true },
  });
  const antes = new Map(anteriores.map((m) => [m.id, m.categoryId]));
  const actor = actorDelLote(ctx);
  const r: ResultadoLote = { aplicados: 0, fallidos: [], detalle: [] };
  // De a uno: cada cambio con su transacción, su auditoría y su control de concurrencia. Quien
  // cambió mientras tanto queda afuera sin frenar al resto.
  for (const id of ids) {
    try {
      const hecho = await updateMember(ctx.workspaceId, id, { categoryId: categoria.id }, { actor, action: "UPDATED", source: "MANUAL" });
      if (!hecho) {
        r.fallidos.push({ id, error: "no encontrado" });
        continue;
      }
      r.aplicados += 1;
      r.detalle.push({ id, antes: antes.get(id) ?? null, despues: categoria.id });
    } catch (e) {
      if (e instanceof MemberConcurrencyError) {
        r.fallidos.push({ id, error: "se modificó mientras tanto" });
        continue;
      }
      // Cada fila ya guardada quedó firme en su propia transacción: cortar acá dejaría un lote
      // a medias sin registro. Se anota, se sigue y el lote se registra entero.
      console.error("[listado socios] cambio de categoría falló", { memberId: id, error: e instanceof Error ? e.name : "desconocido" });
      r.fallidos.push({ id, error: "error inesperado" });
    }
  }
  return r;
}

async function invitar(ctx: ContextoListado, ids: string[]): Promise<ResultadoLote> {
  const actor = usuarioDelLote(ctx);
  const r: ResultadoLote = { aplicados: 0, fallidos: [], detalle: [] };
  // Secuencial, como la tanda de siempre: el proveedor de correo limita los envíos por segundo.
  for (const id of ids) {
    const res = await inviteOneMember({ id: ctx.workspaceId }, actor, id);
    if (res.ok) {
      r.aplicados += 1;
      r.detalle.push({ id });
    } else r.fallidos.push({ id, error: res.error ?? "No se pudo invitar." });
  }
  return r;
}

async function panelSocio(ctx: ContextoListado, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  const m = await prisma.member.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: SELECT_FILA });
  if (!m) return null;
  const [deuda, carnet, pagos] = await Promise.all([
    prisma.membershipCharge.aggregate({
      where: { ...cargoImpagoWhere(ctx.workspaceId), memberId: m.id },
      _sum: { balanceArs: true },
      _count: true,
    }),
    prisma.memberCard.findFirst({
      where: { workspaceId: ctx.workspaceId, memberId: m.id },
      orderBy: { issuedAt: "desc" },
      select: { cardNumber: true, validUntil: true, revokedAt: true },
    }),
    prisma.membershipPayment.findMany({
      where: { workspaceId: ctx.workspaceId, memberId: m.id, status: "ACREDITADO" },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, amountArs: true, paidAt: true, createdAt: true },
    }),
  ]);
  const ahora = Date.now();
  const estadoCarnet = !carnet
    ? null
    : carnet.revokedAt
      ? "Dado de baja"
      : carnet.validUntil.getTime() <= ahora
        ? "Vencido"
        : "Vigente";
  const impagas = deuda._count;

  const datos: [string, string][] = [
    ["N°", m.memberNumber],
    ["Estado", etiquetaEstado(m.status)],
    ["Categoría", m.category?.name ?? "—"],
    [
      "Deuda",
      impagas
        ? `${formatMoney(deuda._sum.balanceArs ?? 0, "ARS")} (${impagas} ${impagas === 1 ? "cuota impaga" : "cuotas impagas"})`
        : "Al día",
    ],
    ["Último carnet", carnet ? `${carnet.cardNumber} · ${estadoCarnet}` : "—"],
    ["Acceso al portal", etiquetaAcceso(m)],
  ];

  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold text-[var(--fo-text)]">{nombreCompleto(m)}</h3>
      <dl className="space-y-2">
        {datos.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-[var(--fo-muted)]">{k}</dt>
            <dd className="text-right text-[var(--fo-text)]">{val}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2">
        <h4 className="font-semibold text-[var(--fo-text)]">Últimos pagos</h4>
        {pagos.length === 0 ? (
          <p className="text-[var(--fo-muted)]">Todavía no tiene pagos acreditados.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {pagos.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="text-[var(--fo-muted)]">{fechaAR.format(p.paidAt ?? p.createdAt)}</span>
                <span className="font-medium tabular-nums">{formatMoney(p.amountArs, "ARS")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Los textos dependen de cómo llama cada workspace a su gente: por eso es una función. */
export function listadoSocios(v: PersonVocabulary): DefinicionListado<FilaSocio> {
  return {
    clave: "socios",
    titulo: v.Plural,
    sustantivo: { singular: v.singular, plural: v.plural },
    placeholderBusqueda: "Buscar por nombre, apellido, número, correo o documento",
    columnas: [
      { clave: "numero", titulo: "N°", orden: "numero", celda: (f) => <span className="font-mono text-xs text-[var(--fo-muted)]">{f.memberNumber}</span> },
      {
        clave: "nombre",
        titulo: "Apellido y nombre",
        orden: "apellido",
        celda: (f) => (
          <Link href={`/members/${f.id}`} className="font-medium text-[var(--fo-text)] hover:underline">
            {nombreCompleto(f)}
          </Link>
        ),
      },
      { clave: "categoria", titulo: "Categoría", orden: "categoria", celda: (f) => f.category?.name ?? "—" },
      {
        clave: "estado",
        titulo: "Estado",
        celda: (f) => (
          <span className={`rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs ${COLOR_ESTADO[f.status] ?? ""}`}>
            {etiquetaEstado(f.status)}
          </span>
        ),
      },
      { clave: "correo", titulo: "Correo", secundaria: true, celda: (f) => f.email ?? "—" },
      { clave: "acceso", titulo: "Acceso al portal", secundaria: true, celda: (f) => etiquetaAcceso(f) },
      { clave: "etiquetas", titulo: "Etiquetas", secundaria: true, celda: (f) => <ChipsEtiquetas etiquetas={unirEtiquetasDeFila(f.fotofficeTags, f.clientLink?.fotofficeTags)} /> },
      { clave: "alta", titulo: "Alta", orden: "alta", secundaria: true, celda: (f) => diaUTC.format(f.joinedAt) },
    ],
    filtros: [
      { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: ESTADOS.map((s) => ({ valor: s, etiqueta: ETIQUETA_ESTADO[s] })) },
      { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
      { tipo: "relacion", clave: "etiqueta", etiqueta: "Etiqueta", conBuscador: true },
      { tipo: "opcion", clave: "acceso", etiqueta: "Acceso al portal", opciones: ACCESOS.map((a) => ({ valor: a, etiqueta: MEMBER_ACCESS_FILTER_LABELS[a] })) },
      { tipo: "siNo", clave: "deuda", etiqueta: "Deuda", si: "Con deuda", no: "Al día" },
    ],
    ordenes: ["apellido", "numero", "categoria", "alta"],
    ordenPorDefecto: { campo: "apellido", desc: false },
    idDe: (f) => f.id,
    hrefFicha: (id) => `/members/${id}`,
    contar: (ctx, c) => prisma.member.count({ where: whereSocios(ctx.workspaceId, c) }),
    traer: (ctx, c, { skip, take }) =>
      prisma.member.findMany({ where: whereSocios(ctx.workspaceId, c), select: SELECT_FILA, orderBy: ordenarPor(c), skip, take }),
    traerIds: async (ctx, c, tope) => {
      const filas = await prisma.member.findMany({
        where: whereSocios(ctx.workspaceId, c),
        select: { id: true },
        orderBy: ordenarPor(c),
        take: tope,
      });
      return filas.map((f) => f.id);
    },
    traerPorIds: async (ctx, ids) => {
      const validos = ids.filter((id) => ID_VALIDO.test(id));
      if (validos.length === 0) return [];
      const filas = await prisma.member.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: validos } }, select: SELECT_FILA });
      const porId = new Map(filas.map((f) => [f.id, f]));
      return validos.flatMap((id) => porId.get(id) ?? []);
    },
    // El filtro incluye también categorías inactivas: sirve para encontrar a quien quedó en una vieja.
    opcionesRelacion: async (ctx, clave) => {
      if (clave !== "categoria") return [];
      const cats = await prisma.memberCategory.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      });
      return cats.map((c) => ({ valor: c.id, etiqueta: c.name }));
    },
    buscarRelacion: async (ctx, clave, texto) => (clave === "etiqueta" ? buscarEtiquetasDelFiltro(ctx, texto) : []),
    validarRelacion: async (ctx, clave, id) => {
      if (clave === "etiqueta") return validarEtiquetaDelFiltro(ctx, id);
      if (clave !== "categoria" || !ID_VALIDO.test(id)) return null;
      const cat = await prisma.memberCategory.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { name: true } });
      return cat?.name ?? null;
    },
    acciones: [
      {
        clave: "categoria",
        etiqueta: "Cambiar categoría",
        capacidad: "operar",
        maximo: 5000,
        confirmacion: aplicarVocabulario("Vas a cambiar la categoría de {n} {personas} a {parametro}.", v),
        parametro: { etiqueta: "Categoría", opciones: categoriasActivas },
        elegibles: async (ctx, ids, parametro) => {
          const filas = await prisma.member.findMany({
            where: { workspaceId: ctx.workspaceId, id: { in: ids } },
            select: { id: true, categoryId: true },
          });
          const porId = new Map(filas.map((f) => [f.id, f]));
          const elegibles: string[] = [];
          const excluidos: { id: string; motivo: string }[] = [];
          for (const id of ids) {
            const f = porId.get(id);
            if (!f) excluidos.push({ id, motivo: "no encontrado" });
            else if (f.categoryId === parametro) excluidos.push({ id, motivo: "ya tiene esa categoría" });
            else elegibles.push(id);
          }
          return { elegibles, excluidos };
        },
        aplicar: cambiarCategoria,
      },
      {
        clave: "etiqueta",
        etiqueta: "Agregar o quitar etiqueta",
        capacidad: "operar",
        maximo: 1000,
        confirmacion: aplicarVocabulario("Vas a aplicar el cambio de etiqueta ({parametro}) a {n} {personas}.", v),
        parametro: { etiqueta: "Etiqueta", opciones: opcionesDeEtiquetaEnLote },
        elegibles: async (ctx, ids) => {
          const filas = await prisma.member.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: ids } }, select: { id: true } });
          return elegiblesPorExistencia(ids, filas.map((f) => f.id));
        },
        // Con cliente vinculado la etiqueta va sobre el cliente (el dueño); la lectura mira los dos lados.
        aplicar: (ctx, ids, parametro) =>
          aplicarEtiquetaEnLote(ctx, ids, parametro, async (aCargar) => {
            const filas = await prisma.member.findMany({
              where: { workspaceId: ctx.workspaceId, id: { in: aCargar } },
              select: { id: true, clientLink: { select: { id: true } } },
            });
            return filas.map((f) => ({ id: f.id, persona: { clientId: f.clientLink?.id ?? null, memberId: f.id } }));
          }),
      },
      {
        clave: "invitar",
        etiqueta: "Invitar al portal",
        capacidad: "operar",
        // Manda correos: conserva el tope de la tanda de siempre.
        maximo: INVITE_BATCH_MAX,
        confirmacion: aplicarVocabulario("Vas a invitar al portal a {n} {personas}.", v),
        elegibles: async (ctx, ids) => {
          const filas = await prisma.member.findMany({
            where: { workspaceId: ctx.workspaceId, id: { in: ids } },
            select: { id: true, email: true, userId: true, status: true },
          });
          const porId = new Map(filas.map((f) => [f.id, f]));
          const elegibles: string[] = [];
          const excluidos: { id: string; motivo: string }[] = [];
          for (const id of ids) {
            const f = porId.get(id);
            if (!f) excluidos.push({ id, motivo: "no encontrado" });
            else if (!f.email?.trim()) excluidos.push({ id, motivo: "no tiene correo" });
            else if (f.userId !== null) excluidos.push({ id, motivo: "ya tiene acceso" });
            // Sólo se invita a quien está activo: la invitación lo rechazaría igual.
            else if (f.status !== "ACTIVE") excluidos.push({ id, motivo: "no está activo" });
            else elegibles.push(id);
          }
          return { elegibles, excluidos };
        },
        aplicar: (ctx, ids) => invitar(ctx, ids),
      },
    ],
    // Mismas columnas y mismo orden que el CSV del padrón (`buildMembersCsv`), con títulos legibles.
    exportar: {
      columnas: [
        { titulo: "N°", tipo: "texto", valor: (f) => f.memberNumber },
        { titulo: "Nombre", tipo: "texto", valor: (f) => f.firstName },
        { titulo: "Apellido", tipo: "texto", valor: (f) => f.lastName },
        { titulo: "Tipo de documento", tipo: "texto", valor: (f) => normalizeDocument(f.documentType, f.documentNumber).canonicalType ?? null },
        { titulo: "Documento", tipo: "texto", valor: (f) => normalizeDocument(f.documentType, f.documentNumber).normalizedNumber ?? null },
        { titulo: "Correo", tipo: "texto", valor: (f) => f.email },
        { titulo: "Teléfono", tipo: "texto", valor: (f) => f.phone },
        { titulo: "Nacimiento", tipo: "fecha", valor: (f) => diaCalendario(f.birthDate) },
        { titulo: "Domicilio", tipo: "texto", valor: (f) => f.address },
        { titulo: "Ciudad", tipo: "texto", valor: (f) => f.city },
        { titulo: "Provincia", tipo: "texto", valor: (f) => f.province },
        { titulo: "Código postal", tipo: "texto", valor: (f) => f.postalCode },
        { titulo: "Ingreso", tipo: "fecha", valor: (f) => diaCalendario(f.joinedAt) },
        { titulo: "Estado", tipo: "texto", valor: (f) => etiquetaEstado(f.status) },
        { titulo: "Categoría", tipo: "texto", valor: (f) => f.category?.name ?? null },
        { titulo: "Observaciones", tipo: "texto", valor: (f) => f.notes },
      ],
    },
    panel: panelSocio,
  };
}

/** La lista con los campos personalizados del workspace (columnas, filtros, búsqueda y exportación). */
export async function cargarListadoSocios(ctx: ContextoListado, v: PersonVocabulary) {
  return conCampos(listadoSocios(v), await camposParaListado(ctx, "SOCIO"));
}
