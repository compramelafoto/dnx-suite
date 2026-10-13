import { createHash } from "node:crypto";
import { huella } from "../huella";
import type { ActorCarga, FilaCarga, FuenteCruda, RepoCarga } from "./repositorio";
import { claveEtiqueta } from "./normalizar";
import type { Campos, Crudo, Decision, EntradaMapa, FilaMapa } from "./tipos";
import type { ProductoExistente } from "./traductores/productos";

/**
 * Repositorio en memoria SÓLO PARA PRUEBAS de `lib/alboom/carga`. Mismo contrato que el de Prisma: todo por
 * workspace, escritura del registro y su mapa juntas, una carga activa por workspace, turno con `lockedUntil`.
 */

type ConWs<T> = T & { workspaceId: string };

let secuencia = 0;
const nuevoId = (p: string) => `${p}${++secuencia}`;

export function crearRepoMemoria() {
  const d = {
    crudos: [] as ConWs<Crudo>[],
    mapa: [] as ConWs<EntradaMapa>[],
    cargas: [] as FilaCarga[],
    extraccionesActivas: new Set<string>(),
    miembros: [] as ConWs<{ userId: number; email: string | null }>[],
    origenes: [] as ConWs<{ id: string; name: string; order: number }>[],
    categorias: [] as ConWs<{ id: string; name: string; group: string; order: number; archivada?: boolean }>[],
    etiquetas: [] as ConWs<{ id: string; name: string; nameKey: string }>[],
    asignaciones: [] as ConWs<{ tagId: string; clientId: string }>[],
    circuitos: [] as ConWs<{ id: string; name: string; kind: string }>[],
    etapas: [] as ConWs<{ id: string; circuitId: string; name: string }>[],
    productos: [] as ConWs<ProductoExistente & { kind: string; categoryId: string | null }>[],
    categoriasProducto: [] as ConWs<{ id: string; name: string }>[],
    items: [] as ConWs<{ id: string; comboProductId: string; componentProductId: string; quantity: number; order: number }>[],
    costos: [] as ConWs<{ id: string; productId: string; concept: string; amountArs: string; daysFromEvent: number; supplierClientId: string | null; perUnit: boolean }>[],
    clientes: [] as ConWs<{ id: string; clientNumber: number; campos: Campos; creadoPor: ActorCarga }>[],
    /** Cantidad de escrituras (registros o mapa) hechas: la simulación tiene que dejarlo en 0. */
    escrituras: 0,
  };
  /** Para pruebas: hace fallar la escritura de un registro. */
  let fallar: ((clave: string, decision: Decision) => boolean) | null = null;

  const deWs = <T extends { workspaceId: string }>(xs: T[], ws: string) => xs.filter((x) => x.workspaceId === ws);
  const activa = (s: string) => s === "PENDIENTE" || s === "CORRIENDO";
  const libre = (c: FilaCarga, ahora: Date) => c.lockedUntil === null || c.lockedUntil.getTime() < ahora.getTime();

  function upsertMapa(ws: string, filas: FilaMapa[], targetId: string) {
    for (const f of filas) {
      d.escrituras++;
      const fila = { ...f, targetId: f.targetId ?? targetId, workspaceId: ws };
      const i = d.mapa.findIndex((m) => m.workspaceId === ws && m.entity === f.entity && m.alboomId === f.alboomId);
      if (i >= 0) d.mapa[i] = fila;
      else d.mapa.push(fila);
    }
  }

  function etiquetaPorNombre(ws: string, nombre: string): string {
    const nameKey = claveEtiqueta(nombre);
    const e = d.etiquetas.find((x) => x.workspaceId === ws && x.nameKey === nameKey);
    if (e) return e.id;
    const id = nuevoId("tag");
    d.etiquetas.push({ workspaceId: ws, id, name: nombre, nameKey });
    return id;
  }

  function categoriaProducto(ws: string, nombre: unknown): string | null {
    if (typeof nombre !== "string" || nombre === "") return null;
    const c = d.categoriasProducto.find((x) => x.workspaceId === ws && x.name.toLowerCase() === nombre.toLowerCase());
    if (c) return c.id;
    const id = nuevoId("pcat");
    d.categoriasProducto.push({ workspaceId: ws, id, name: nombre });
    return id;
  }

  const repo: RepoCarga = {
    async leerCrudos(ws, fuente: FuenteCruda, despuesDe, limite) {
      return deWs(d.crudos, ws)
        .filter((c) => c.entity === fuente.entity && (!fuente.prefijo || c.alboomId.startsWith(fuente.prefijo)) && (despuesDe === null || c.alboomId > despuesDe))
        .sort((a, b) => (a.alboomId < b.alboomId ? -1 : 1))
        .slice(0, limite)
        .map(({ entity, alboomId, payload, hash }) => ({ entity, alboomId, payload, hash }));
    },
    async huellaCrudos(ws, fuentes) {
      const h = createHash("sha256");
      let cantidad = 0;
      for (const f of fuentes) {
        for (const c of await repo.leerCrudos(ws, f, null, Infinity)) {
          h.update(`${c.entity}\t${c.alboomId}\t${c.hash}\n`);
          cantidad++;
        }
      }
      return { huella: h.digest("hex"), cantidad };
    },
    async leerMapa(ws, entities) {
      return deWs(d.mapa, ws)
        .filter((m) => entities.includes(m.entity))
        .map(({ workspaceId: _w, ...m }) => ({ ...m, fieldHashes: { ...m.fieldHashes } }));
    },
    async guardarMapa(ws, filas) {
      upsertMapa(ws, filas, "");
    },
    async miembros(ws) {
      return deWs(d.miembros, ws).map(({ userId, email }) => ({ userId, email }));
    },
    async origenes(ws) {
      return deWs(d.origenes, ws).map(({ id, name, order }) => ({ id, name, order }));
    },
    async categoriasConsulta(ws) {
      return deWs(d.categorias, ws).map(({ id, name, group, order }) => ({ id, name, group, order }));
    },
    async etiquetas(ws) {
      return deWs(d.etiquetas, ws).map(({ id, nameKey }) => ({ id, nameKey }));
    },
    async circuitos(ws) {
      return deWs(d.circuitos, ws).map(({ id, name, kind }) => ({ id, name, kind }));
    },
    async etapas(ws) {
      return deWs(d.etapas, ws).map(({ id, circuitId, name }) => ({ id, circuitId, name }));
    },
    async productos(ws) {
      return deWs(d.productos, ws).map(({ workspaceId: _w, kind: _k, categoryId: _c, ...p }) => ({ ...p }));
    },
    async itemsCombo(ws) {
      return deWs(d.items, ws).map(({ id, comboProductId, componentProductId, quantity }) => ({ id, comboProductId, componentProductId, quantity }));
    },
    async costos(ws) {
      return deWs(d.costos, ws).map(({ id, productId, concept, amountArs, daysFromEvent, supplierClientId }) => ({ id, productId, concept, amountArs, daysFromEvent, supplierClientId }));
    },
    async clientes(ws) {
      return deWs(d.clientes, ws).map((c) => ({
        id: c.id,
        campos: { ...c.campos },
        tagKeys: d.asignaciones.filter((a) => a.workspaceId === ws && a.clientId === c.id).map((a) => d.etiquetas.find((e) => e.id === a.tagId)!.nameKey),
      }));
    },

    async escribir(ws, clave, dec, filas, actor) {
      if (fallar?.(clave, dec)) throw Object.assign(new Error("falla simulada con datos sensibles ana@x.test"), { code: "P2002" });
      d.escrituras++;
      const v = dec.datos ?? {};
      let id = dec.targetId ?? "";
      const crear = dec.accion === "CREAR";
      switch (clave) {
        case "origenes":
          id = nuevoId("ori");
          d.origenes.push({ workspaceId: ws, id, name: String(v.name), order: Number(v.order) });
          break;
        case "categorias_consulta":
          if (crear) {
            id = nuevoId("cat");
            d.categorias.push({ workspaceId: ws, id, name: String(v.name), group: String(v.group), order: Number(v.order), archivada: v.archivada === true });
          } else Object.assign(d.categorias.find((c) => c.id === id)!, v);
          break;
        case "etiquetas":
          id = nuevoId("tag");
          d.etiquetas.push({ workspaceId: ws, id, name: String(v.name), nameKey: String(v.nameKey) });
          break;
        case "contactos": {
          if (crear) {
            id = nuevoId("cli");
            const numero = deWs(d.clientes, ws).reduce((m, c) => Math.max(m, c.clientNumber), 0) + 1;
            d.clientes.push({ workspaceId: ws, id, clientNumber: numero, campos: { ...v, category: v.category ?? "CLIENTE" }, creadoPor: actor });
          } else {
            const c = d.clientes.find((x) => x.id === id && x.workspaceId === ws)!;
            Object.assign(c.campos, v);
          }
          for (const n of (dec.extra?.etiquetas as string[] | undefined) ?? []) {
            const tagId = etiquetaPorNombre(ws, n);
            if (!d.asignaciones.some((a) => a.tagId === tagId && a.clientId === id)) d.asignaciones.push({ workspaceId: ws, tagId, clientId: id });
          }
          break;
        }
        case "productos": {
          const categoryId = "categoria" in v ? categoriaProducto(ws, v.categoria) : undefined;
          if (crear) {
            id = nuevoId("prod");
            d.productos.push({
              workspaceId: ws,
              id,
              name: String(v.name),
              kind: String(v.kind),
              sku: (v.sku as string | null) ?? null,
              description: (v.description as string | null) ?? null,
              priceArs: String(v.priceArs),
              costArs: (v.costArs as string | null) ?? null,
              isActive: v.isActive !== false,
              categoria: (v.categoria as string | null) ?? null,
              categoryId: categoryId ?? null,
              inPriceList: v.inPriceList === true,
              isCombo: v.isCombo === true,
            });
          } else {
            const p = d.productos.find((x) => x.id === id && x.workspaceId === ws)!;
            Object.assign(p, v, categoryId !== undefined ? { categoryId } : {});
          }
          break;
        }
        case "combos":
          if (crear) {
            id = nuevoId("item");
            d.items.push({ workspaceId: ws, id, comboProductId: String(v.comboProductId), componentProductId: String(v.componentProductId), quantity: Number(v.quantity), order: Number(v.order) });
          } else Object.assign(d.items.find((x) => x.id === id)!, v);
          break;
        case "costos":
          if (crear) {
            id = nuevoId("costo");
            d.costos.push({
              workspaceId: ws,
              id,
              productId: String(v.productId),
              concept: String(v.concept),
              amountArs: String(v.amountArs),
              daysFromEvent: Number(v.daysFromEvent),
              supplierClientId: (v.supplierClientId as string | null) ?? null,
              perUnit: false,
            });
          } else Object.assign(d.costos.find((x) => x.id === id)!, v);
          break;
        default:
          throw new Error(`Parte sin escritor: ${clave}`);
      }
      upsertMapa(ws, filas, id);
      return id;
    },

    async crearCarga(x) {
      if (d.cargas.some((c) => c.workspaceId === x.workspaceId && activa(c.status))) return { ok: false };
      const fila: FilaCarga = {
        id: nuevoId("carga"),
        workspaceId: x.workspaceId,
        mode: x.mode,
        status: "PENDIENTE",
        entities: [...x.entities],
        report: { entidades: {} },
        progress: x.progress,
        fingerprint: x.fingerprint,
        startedByUserId: x.startedByUserId,
        startedAt: new Date(Date.now() + secuencia),
        finishedAt: null,
        errorReason: null,
        lockedUntil: null,
        updatedAt: new Date(),
      };
      d.cargas.push(fila);
      return { ok: true, id: fila.id };
    },
    async cargaActiva(ws) {
      return d.cargas.find((c) => c.workspaceId === ws && activa(c.status)) ?? null;
    },
    async ultimaCarga(ws, mode) {
      const filas = d.cargas.filter((c) => c.workspaceId === ws && (!mode || c.mode === mode));
      return filas.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
    },
    async hayExtraccionActiva(ws) {
      return d.extraccionesActivas.has(ws);
    },
    async cargasParaCorrer(ahora, limite) {
      return d.cargas
        .filter((c) => activa(c.status) && libre(c, ahora))
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .slice(0, limite)
        .map((c) => ({ id: c.id, workspaceId: c.workspaceId }));
    },
    async reclamar(id, ws, ahora, turnoMs) {
      const c = d.cargas.find((x) => x.id === id && x.workspaceId === ws && activa(x.status) && libre(x, ahora));
      if (!c) return false;
      c.status = "CORRIENDO";
      c.lockedUntil = new Date(ahora.getTime() + turnoMs);
      return true;
    },
    async leerCarga(id, ws) {
      const c = d.cargas.find((x) => x.id === id && x.workspaceId === ws);
      return c ? { ...c, report: structuredClone(c.report), progress: structuredClone(c.progress) } : null;
    },
    async guardarAvance(id, ws, report, progress) {
      const c = d.cargas.find((x) => x.id === id && x.workspaceId === ws && x.status === "CORRIENDO");
      if (!c) return false;
      Object.assign(c, { report: structuredClone(report), progress: structuredClone(progress), updatedAt: new Date() });
      return true;
    },
    async soltar(id, ws, report, progress) {
      const c = d.cargas.find((x) => x.id === id && x.workspaceId === ws && x.status === "CORRIENDO");
      if (c) Object.assign(c, { report: structuredClone(report), progress: structuredClone(progress), lockedUntil: null, updatedAt: new Date() });
    },
    async soltarCancelada(id, ws) {
      const c = d.cargas.find((x) => x.id === id && x.workspaceId === ws && x.status === "CANCELADA");
      if (c) c.lockedUntil = null;
    },
    async terminar(id, ws, status, report, progress, errorReason, ahora) {
      const c = d.cargas.find((x) => x.id === id && x.workspaceId === ws && activa(x.status));
      if (c) Object.assign(c, { status, report: structuredClone(report), progress: structuredClone(progress), errorReason, finishedAt: ahora, lockedUntil: null, updatedAt: new Date() });
    },
    async cancelar(ws, ahora) {
      const filas = d.cargas.filter((c) => c.workspaceId === ws && activa(c.status));
      for (const c of filas) Object.assign(c, { status: "CANCELADA", finishedAt: ahora });
      return filas.length > 0;
    },
  };

  return {
    repo,
    datos: d,
    fallarCuando(f: ((clave: string, decision: Decision) => boolean) | null) {
      fallar = f;
    },
    /** Agrega un crudo con su huella calculada como en la 8A. */
    crudo(ws: string, entity: string, alboomId: string, payload: unknown) {
      const hash = huella(payload);
      const i = d.crudos.findIndex((c) => c.workspaceId === ws && c.entity === entity && c.alboomId === alboomId);
      const fila = { workspaceId: ws, entity, alboomId, payload, hash };
      if (i >= 0) d.crudos[i] = fila;
      else d.crudos.push(fila);
    },
  };
}

export type RepoMemoria = ReturnType<typeof crearRepoMemoria>;
