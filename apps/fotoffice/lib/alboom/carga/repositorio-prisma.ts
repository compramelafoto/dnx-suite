import "server-only";
import { createHash } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { crearClienteConNumero, type DatosAltaCliente } from "@/lib/clients/alta";
import { claveEtiqueta } from "./normalizar";
import type { ActorCarga, FilaCarga, FuenteCruda, RepoCarga } from "./repositorio";
import { huellaCampo } from "./campos";
import type { Campos, EntradaMapa, EstadoCarga, FilaMapa, ModoCarga, Valor } from "./tipos";
import { CAMPOS_CLIENTE, CAMPOS_PERFIL } from "./traductores/contactos";

/**
 * `RepoCarga` con Prisma. Todas las consultas llevan `workspaceId`. Cada escritura de un registro va en una
 * transacción junto con sus filas de `FotofficeAlboomMapa`. Nunca escribe en `FotofficeAlboomCrudo` ni llama a Alboom.
 */

type Tx = Prisma.TransactionClient;
const ACTIVA = { in: ["PENDIENTE", "CORRIENDO"] };
const PAGINA_HUELLA = 5000;

const json = (v: unknown) => v as Prisma.InputJsonValue;
const dec = (v: { toFixed(n: number): string } | null) => (v === null ? null : v.toFixed(2));
const fechaDb = (v: unknown) => (typeof v === "string" && v ? new Date(`${v}T00:00:00Z`) : null);

function soloDe(v: Campos, campos: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(v).filter(([k]) => campos.includes(k)));
}

async function upsertMapa(tx: Tx, ws: string, filas: FilaMapa[], targetId: string) {
  for (const f of filas) {
    const id = f.targetId ?? targetId;
    await tx.fotofficeAlboomMapa.upsert({
      where: { workspaceId_entity_alboomId: { workspaceId: ws, entity: f.entity, alboomId: f.alboomId } },
      create: { workspaceId: ws, entity: f.entity, alboomId: f.alboomId, targetType: f.targetType, targetId: id, payloadHash: f.payloadHash, fieldHashes: json(f.fieldHashes) },
      update: { targetType: f.targetType, targetId: id, payloadHash: f.payloadHash, fieldHashes: json(f.fieldHashes) },
    });
  }
}

/** Actualiza sólo si el registro es del workspace; si no, es un error (nunca se toca otro workspace). */
function unoSolo(r: { count: number }) {
  if (r.count !== 1) throw Object.assign(new Error("registro ajeno o inexistente"), { code: "P2025" });
}

async function asignarEtiquetas(tx: Tx, ws: string, clientId: string, nombres: string[], actor: ActorCarga) {
  for (const name of nombres) {
    const nameKey = claveEtiqueta(name);
    const tag = await tx.fotofficeTag.upsert({
      where: { workspaceId_nameKey: { workspaceId: ws, nameKey } },
      create: { workspaceId: ws, name, nameKey },
      update: {},
      select: { id: true },
    });
    const ya = await tx.fotofficeTagAssignment.findFirst({ where: { workspaceId: ws, tagId: tag.id, clientId }, select: { id: true } });
    if (!ya) await tx.fotofficeTagAssignment.create({ data: { workspaceId: ws, tagId: tag.id, clientId, createdByUserId: actor.userId } });
  }
}

/** Los cambios cuyo campo sigue con el valor que se vio al decidir (`previos`); sin `previos`, todos. */
function sigueIgual(v: Campos, previos: Campos | undefined, hoy: Record<string, unknown>): Campos {
  if (!previos) return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !(k in previos) || huellaCampo(previos[k]) === huellaCampo((hoy[k] ?? null) as Valor)));
}

function datosPerfil(v: Campos): Record<string, unknown> {
  const p = soloDe(v, CAMPOS_PERFIL);
  if ("birthday" in p) p.birthday = fechaDb(p.birthday);
  return p;
}

async function categoriaProducto(tx: Tx, ws: string, nombre: unknown): Promise<string | null> {
  if (typeof nombre !== "string" || nombre === "") return null;
  const ya = await tx.productCategory.findFirst({ where: { workspaceId: ws, name: { equals: nombre, mode: "insensitive" } }, select: { id: true } });
  if (ya) return ya.id;
  const ultima = await tx.productCategory.findFirst({ where: { workspaceId: ws }, orderBy: { order: "desc" }, select: { order: true } });
  const c = await tx.productCategory.create({ data: { workspaceId: ws, name: nombre, order: (ultima?.order ?? -1) + 1 }, select: { id: true } });
  return c.id;
}

function fila(f: {
  id: string;
  workspaceId: string;
  mode: string;
  status: string;
  entities: Prisma.JsonValue;
  report: Prisma.JsonValue;
  progress: Prisma.JsonValue;
  fingerprint: string | null;
  startedByUserId: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  errorReason: string | null;
  lockedUntil: Date | null;
  updatedAt: Date;
}): FilaCarga {
  return {
    ...f,
    mode: f.mode as ModoCarga,
    status: f.status as EstadoCarga,
    entities: Array.isArray(f.entities) ? f.entities.filter((e): e is string => typeof e === "string") : [],
  };
}

const libre = (ahora: Date) => [{ lockedUntil: null }, { lockedUntil: { lt: ahora } }];

export const repoPrisma: RepoCarga = {
  async leerCrudos(ws, fuente: FuenteCruda, despuesDe, limite) {
    const filas = await prisma.fotofficeAlboomCrudo.findMany({
      where: {
        workspaceId: ws,
        entity: fuente.entity,
        alboomId: { ...(fuente.prefijo ? { startsWith: fuente.prefijo } : {}), ...(despuesDe !== null ? { gt: despuesDe } : {}) },
      },
      orderBy: { alboomId: "asc" },
      take: limite,
      select: { entity: true, alboomId: true, payload: true, hash: true },
    });
    return filas.map((f) => ({ entity: f.entity, alboomId: f.alboomId, payload: f.payload as unknown, hash: f.hash }));
  },

  async huellaCrudos(ws, fuentes) {
    const h = createHash("sha256");
    let cantidad = 0;
    for (const f of fuentes) {
      let cursor: string | null = null;
      for (;;) {
        const filas: { alboomId: string; hash: string }[] = await prisma.fotofficeAlboomCrudo.findMany({
          where: {
            workspaceId: ws,
            entity: f.entity,
            alboomId: { ...(f.prefijo ? { startsWith: f.prefijo } : {}), ...(cursor !== null ? { gt: cursor } : {}) },
          },
          orderBy: { alboomId: "asc" },
          take: PAGINA_HUELLA,
          select: { alboomId: true, hash: true },
        });
        for (const x of filas) h.update(`${f.entity}\t${x.alboomId}\t${x.hash}\n`);
        cantidad += filas.length;
        if (filas.length < PAGINA_HUELLA) break;
        cursor = filas[filas.length - 1]!.alboomId;
      }
    }
    return { huella: h.digest("hex"), cantidad };
  },

  async leerMapa(ws, entities) {
    const filas = await prisma.fotofficeAlboomMapa.findMany({
      where: { workspaceId: ws, entity: { in: entities } },
      select: { entity: true, alboomId: true, targetType: true, targetId: true, payloadHash: true, fieldHashes: true },
    });
    return filas.map((f) => ({
      ...f,
      fieldHashes: typeof f.fieldHashes === "object" && f.fieldHashes !== null && !Array.isArray(f.fieldHashes) ? (f.fieldHashes as Record<string, string>) : {},
    }));
  },

  async guardarMapa(ws, filas: EntradaMapa[]) {
    await prisma.$transaction((tx) => upsertMapa(tx, ws, filas, ""));
  },

  async miembros(ws) {
    const filas = await prisma.workspaceMembership.findMany({ where: { workspaceId: ws }, select: { userId: true, user: { select: { email: true } } } });
    return filas.map((f) => ({ userId: f.userId, email: f.user.email }));
  },

  async correosDelEstudio(ws) {
    const [miembros, branding] = await Promise.all([
      repoPrisma.miembros(ws),
      prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId: ws }, select: { contactEmail: true } }),
    ]);
    return [...miembros.map((m) => m.email), branding?.contactEmail ?? null].filter((m): m is string => !!m);
  },

  async origenes(ws) {
    return prisma.fotofficeOrigen.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, order: true } });
  },

  async categoriasConsulta(ws) {
    return prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, group: true, order: true } });
  },

  async etiquetas(ws) {
    return prisma.fotofficeTag.findMany({ where: { workspaceId: ws }, select: { id: true, nameKey: true } });
  },

  async circuitos(ws) {
    return prisma.fotofficeCircuit.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, kind: true } });
  },

  async etapas(ws) {
    const filas = await prisma.fotofficeStage.findMany({
      where: { circuit: { workspaceId: ws }, archivedAt: null },
      orderBy: [{ circuitId: "asc" }, { order: "asc" }],
      select: { id: true, circuitId: true, name: true },
    });
    return filas;
  },

  async productos(ws) {
    const filas = await prisma.product.findMany({
      where: { workspaceId: ws },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        priceArs: true,
        costArs: true,
        isActive: true,
        category: { select: { name: true } },
        fotofficeCatalogo: { select: { inPriceList: true, isCombo: true } },
      },
    });
    return filas.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      priceArs: p.priceArs.toFixed(2),
      costArs: dec(p.costArs),
      isActive: p.isActive,
      categoria: p.category?.name ?? null,
      inPriceList: p.fotofficeCatalogo?.inPriceList ?? false,
      isCombo: p.fotofficeCatalogo?.isCombo ?? false,
    }));
  },

  async itemsCombo(ws) {
    return prisma.fotofficeComboItem.findMany({ where: { workspaceId: ws }, select: { id: true, comboProductId: true, componentProductId: true, quantity: true } });
  },

  async costos(ws) {
    const filas = await prisma.fotofficeCostoPlantilla.findMany({
      where: { workspaceId: ws },
      select: { id: true, productId: true, concept: true, amountArs: true, daysFromEvent: true, supplierClientId: true },
    });
    return filas.map((c) => ({ ...c, amountArs: c.amountArs.toFixed(2) }));
  },

  async clientes(ws) {
    const filas = await prisma.client.findMany({
      where: { workspaceId: ws },
      select: {
        id: true,
        kind: true,
        firstName: true,
        lastName: true,
        businessName: true,
        docType: true,
        docNumber: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        fotofficePerfil: {
          select: { category: true, mobile: true, email2: true, birthday: true, website: true, province: true, country: true, postalCode: true, about: true },
        },
        fotofficeTags: { select: { tag: { select: { nameKey: true } } } },
      },
    });
    return filas.map(({ id, fotofficePerfil: p, fotofficeTags, ...c }) => ({
      id,
      campos: {
        ...c,
        category: p?.category ?? null,
        mobile: p?.mobile ?? null,
        email2: p?.email2 ?? null,
        birthday: p?.birthday ? p.birthday.toISOString().slice(0, 10) : null,
        website: p?.website ?? null,
        province: p?.province ?? null,
        country: p?.country ?? null,
        postalCode: p?.postalCode ?? null,
        about: p?.about ?? null,
      },
      tagKeys: fotofficeTags.map((t) => t.tag.nameKey),
    }));
  },

  async escribir(ws, clave, d, mapa, actor) {
    const v = d.datos ?? {};
    const crear = d.accion === "CREAR";

    if (clave === "contactos") {
      const etiquetas = Array.isArray(d.extra?.etiquetas) ? (d.extra.etiquetas as string[]) : [];
      if (crear) {
        const perfil = datosPerfil(v);
        const id = await crearClienteConNumero(ws, soloDe(v, CAMPOS_CLIENTE) as DatosAltaCliente, actor, async (tx, clientId) => {
          await tx.fotofficeContactoPerfil.create({ data: { workspaceId: ws, clientId, ...perfil, category: (perfil.category as string | undefined) ?? "CLIENTE" } });
          await asignarEtiquetas(tx, ws, clientId, etiquetas, actor);
          await upsertMapa(tx, ws, mapa, clientId);
        });
        if (!id) throw Object.assign(new Error("sin número de cliente"), { code: "P2002" });
        return id;
      }
      const clientId = d.targetId!;
      await prisma.$transaction(async (tx) => {
        const antes = await tx.client.findFirst({
          where: { id: clientId, workspaceId: ws },
          select: {
            id: true, email: true, phone: true, firstName: true, lastName: true, businessName: true, docType: true, docNumber: true, address: true, city: true, kind: true,
            fotofficePerfil: { select: { category: true, mobile: true, email2: true, birthday: true, website: true, province: true, country: true, postalCode: true, about: true } },
          },
        });
        if (!antes) unoSolo({ count: 0 });
        // Sólo los campos que siguen como estaban cuando se decidió: si alguien los editó en el medio, no se pisan.
        const { fotofficePerfil, ...base } = antes!;
        const hoy: Record<string, unknown> = {
          ...base,
          ...(fotofficePerfil ?? {}),
          birthday: fotofficePerfil?.birthday ? fotofficePerfil.birthday.toISOString().slice(0, 10) : null,
        };
        const vigentes = sigueIgual(v, d.previos, hoy);
        const cliente = soloDe(vigentes, CAMPOS_CLIENTE);
        const perfil = datosPerfil(vigentes);
        if (Object.keys(cliente).length > 0) {
          unoSolo(await tx.client.updateMany({ where: { id: clientId, workspaceId: ws }, data: cliente }));
          const cambios = Object.fromEntries(Object.entries(cliente).map(([k, after]) => [k, { before: (antes as Record<string, unknown>)[k] ?? null, after }]));
          await tx.clientAudit.create({ data: { workspaceId: ws, clientId, action: "UPDATED", actorUserId: actor.userId, actorLabel: actor.label, changesJson: json(cambios) } });
        }
        if (Object.keys(perfil).length > 0) {
          await tx.fotofficeContactoPerfil.upsert({
            where: { clientId },
            create: { workspaceId: ws, clientId, ...perfil, category: (perfil.category as string | undefined) ?? "CLIENTE" },
            update: perfil,
          });
        }
        await asignarEtiquetas(tx, ws, clientId, etiquetas, actor);
        await upsertMapa(tx, ws, mapa, clientId);
      });
      return clientId;
    }

    return prisma.$transaction(async (tx) => {
      let id = d.targetId ?? "";
      switch (clave) {
        case "origenes": {
          id = (await tx.fotofficeOrigen.create({ data: { workspaceId: ws, name: String(v.name), order: Number(v.order) }, select: { id: true } })).id;
          break;
        }
        case "categorias_consulta": {
          if (crear) {
            const c = await tx.fotofficeConsultaCategoria.create({
              data: { workspaceId: ws, name: String(v.name), group: String(v.group), order: Number(v.order), archivedAt: v.archivada === true ? new Date() : null },
              select: { id: true },
            });
            id = c.id;
          } else if (typeof v.group === "string") {
            unoSolo(await tx.fotofficeConsultaCategoria.updateMany({ where: { id, workspaceId: ws }, data: { group: v.group } }));
          }
          break;
        }
        case "etiquetas": {
          id = (await tx.fotofficeTag.create({ data: { workspaceId: ws, name: String(v.name), nameKey: String(v.nameKey) }, select: { id: true } })).id;
          break;
        }
        case "productos": {
          const categoryId = "categoria" in v ? await categoriaProducto(tx, ws, v.categoria) : undefined;
          const producto: Record<string, unknown> = {
            ...soloDe(v, ["sku", "description", "priceArs", "costArs", "isActive"]),
            ...(categoryId !== undefined ? { categoryId } : {}),
          };
          const catalogo = soloDe(v, ["inPriceList", "isCombo"]);
          if (crear) {
            const p = await tx.product.create({
              data: {
                workspaceId: ws,
                name: String(v.name),
                kind: String(v.kind),
                tracksStock: false,
                createdByUserId: actor.userId,
                priceArs: String(v.priceArs),
                ...producto,
              } as Prisma.ProductUncheckedCreateInput,
              select: { id: true },
            });
            id = p.id;
            await tx.fotofficeProductoCatalogo.create({ data: { workspaceId: ws, productId: id, inPriceList: v.inPriceList === true, isCombo: v.isCombo === true } });
          } else {
            if (Object.keys(producto).length > 0) unoSolo(await tx.product.updateMany({ where: { id, workspaceId: ws }, data: producto }));
            if (Object.keys(catalogo).length > 0) {
              const propio = await tx.product.findFirst({ where: { id, workspaceId: ws }, select: { id: true } });
              if (!propio) unoSolo({ count: 0 });
              await tx.fotofficeProductoCatalogo.upsert({ where: { productId: id }, create: { workspaceId: ws, productId: id, ...catalogo }, update: catalogo });
            }
          }
          break;
        }
        case "combos": {
          if (crear) {
            const propios = await tx.product.count({ where: { workspaceId: ws, id: { in: [String(v.comboProductId), String(v.componentProductId)] } } });
            if (propios !== 2) unoSolo({ count: 0 });
            id = (
              await tx.fotofficeComboItem.create({
                data: { workspaceId: ws, comboProductId: String(v.comboProductId), componentProductId: String(v.componentProductId), quantity: Number(v.quantity), order: Number(v.order) },
                select: { id: true },
              })
            ).id;
          } else {
            unoSolo(await tx.fotofficeComboItem.updateMany({ where: { id, workspaceId: ws }, data: { quantity: Number(v.quantity) } }));
          }
          break;
        }
        case "costos": {
          const datos = soloDe(v, ["concept", "amountArs", "daysFromEvent", "supplierClientId"]);
          if (crear) {
            const propio = await tx.product.findFirst({ where: { id: String(v.productId), workspaceId: ws }, select: { id: true } });
            if (!propio) unoSolo({ count: 0 });
            id = (
              await tx.fotofficeCostoPlantilla.create({
                data: {
                  workspaceId: ws,
                  productId: String(v.productId),
                  concept: String(v.concept),
                  amountArs: String(v.amountArs),
                  daysFromEvent: Number(v.daysFromEvent),
                  supplierClientId: typeof v.supplierClientId === "string" ? v.supplierClientId : null,
                  perUnit: false,
                  order: Number(v.order),
                },
                select: { id: true },
              })
            ).id;
          } else {
            unoSolo(await tx.fotofficeCostoPlantilla.updateMany({ where: { id, workspaceId: ws }, data: datos }));
          }
          break;
        }
        default:
          throw new Error("parte sin escritor");
      }
      await upsertMapa(tx, ws, mapa, id);
      return id;
    });
  },

  async crearCarga(x) {
    try {
      const f = await prisma.fotofficeAlboomCarga.create({
        data: { workspaceId: x.workspaceId, mode: x.mode, status: "PENDIENTE", entities: json(x.entities), fingerprint: x.fingerprint, startedByUserId: x.startedByUserId, progress: json(x.progress) },
        select: { id: true },
      });
      return { ok: true, id: f.id };
    } catch (error) {
      // Otra pestaña la arrancó entre el chequeo y el alta: el índice parcial lo frenó.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false };
      throw error;
    }
  },

  async cargaActiva(ws) {
    const f = await prisma.fotofficeAlboomCarga.findFirst({ where: { workspaceId: ws, status: ACTIVA } });
    return f ? fila(f) : null;
  },

  async ultimaCarga(ws, mode) {
    const f = await prisma.fotofficeAlboomCarga.findFirst({ where: { workspaceId: ws, ...(mode ? { mode } : {}) }, orderBy: { startedAt: "desc" } });
    return f ? fila(f) : null;
  },

  async hayExtraccionActiva(ws) {
    return (await prisma.fotofficeAlboomExtraccion.findFirst({ where: { workspaceId: ws, status: ACTIVA }, select: { id: true } })) !== null;
  },

  async cargasParaCorrer(ahora, limite) {
    return prisma.fotofficeAlboomCarga.findMany({
      where: { status: ACTIVA, OR: libre(ahora) },
      orderBy: { updatedAt: "asc" },
      take: limite,
      select: { id: true, workspaceId: true },
    });
  },

  async reclamar(id, ws, ahora, turnoMs) {
    const r = await prisma.fotofficeAlboomCarga.updateMany({
      where: { id, workspaceId: ws, status: ACTIVA, OR: libre(ahora) },
      data: { status: "CORRIENDO", lockedUntil: new Date(ahora.getTime() + turnoMs) },
    });
    return r.count === 1;
  },

  async leerCarga(id, ws) {
    const f = await prisma.fotofficeAlboomCarga.findFirst({ where: { id, workspaceId: ws } });
    return f ? fila(f) : null;
  },

  async guardarAvance(id, ws, report, progress) {
    const r = await prisma.fotofficeAlboomCarga.updateMany({ where: { id, workspaceId: ws, status: "CORRIENDO" }, data: { report: json(report), progress: json(progress) } });
    return r.count === 1;
  },

  async soltar(id, ws, report, progress) {
    await prisma.fotofficeAlboomCarga.updateMany({ where: { id, workspaceId: ws, status: "CORRIENDO" }, data: { report: json(report), progress: json(progress), lockedUntil: null } });
  },

  async soltarCancelada(id, ws) {
    await prisma.fotofficeAlboomCarga.updateMany({ where: { id, workspaceId: ws, status: "CANCELADA" }, data: { lockedUntil: null } });
  },

  async terminar(id, ws, status, report, progress, errorReason, ahora) {
    await prisma.fotofficeAlboomCarga.updateMany({
      where: { id, workspaceId: ws, status: ACTIVA },
      data: { status, report: json(report), progress: json(progress), errorReason: errorReason ? errorReason.slice(0, 500) : null, finishedAt: ahora, lockedUntil: null },
    });
  },

  async cancelar(ws, ahora) {
    const r = await prisma.fotofficeAlboomCarga.updateMany({ where: { workspaceId: ws, status: ACTIVA }, data: { status: "CANCELADA", finishedAt: ahora } });
    return r.count > 0;
  },
};
