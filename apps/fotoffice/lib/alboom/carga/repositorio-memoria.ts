import { createHash } from "node:crypto";
import { huella } from "../huella";
import type { ActorCarga, CatalogosHistoricos, FilaCarga, FuenteCruda, RepoCarga } from "./repositorio";
import { huellaCampo } from "./campos";
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
    correosEstudio: [] as ConWs<{ email: string }>[],
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
    /** Lo histórico de la 8B-2 (consultas, pedidos, cobros…): una fila por registro creado. */
    historicos: [] as ConWs<{ clave: string; tipo: string; id: string; datos: Campos; extra: Record<string, unknown> }>[],
    /** Cuotas y citas marcadas como "ya avisadas" (lo que hace el escritor real para que los crons no avisen). */
    recordatoriosCuota: [] as ConWs<{ cuotaId: string; dueDate: string }>[],
    recordatoriosCita: [] as ConWs<{ citaId: string; startAt: string }>[],
    /** Movimientos de la Caja operativa: ninguna parte de la carga escribe acá. */
    movimientosCaja: [] as ConWs<{ id: string }>[],
    /** Lo que ya existe en FOTOFFICE para los contextos de la 8B-2. */
    catalogos: {} as Record<string, Partial<CatalogosHistoricos>>,
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

  /** Tipo de registro de FOTOFFICE de lo que escribe cada parte de la 8B-2. */
  const TIPO_DE: Record<string, string> = {
    consultas: "CONSULTA",
    consultas_historial: "JOURNEY_STEP",
    proyectos_historial: "JOURNEY_STEP",
    consultas_notas: "NOTE",
    consultas_actividades: "PERSON_EVENT",
    consultas_correos: "MESSAGE",
    presupuestos: "PRESUPUESTO",
    pedidos: "PEDIDO",
    cuotas: "PEDIDO_CUOTA",
    costos_pedido: "CUENTA_PAGAR",
    cuentas_pagar: "CUENTA_PAGAR",
    pagos: "CUENTA_PAGAR",
    cobros: "FINANZA_HISTORICA",
    cuentas_cobrar: "FINANZA_HISTORICA",
    movimientos_bancos: "FINANZA_HISTORICA",
    contratos: "CONTRATO",
    proyectos: "PROYECTO",
    proyectos_participantes: "PROYECTO_PARTICIPANTE",
    citas: "CITA",
    tareas: "TAREA",
  };

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
    async correosDelEstudio(ws) {
      return [...deWs(d.miembros, ws).map((m) => m.email), ...deWs(d.correosEstudio, ws).map((c) => c.email)].filter((m): m is string => !!m);
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

    async idsExistentes(ws, tipo) {
      const ids = deWs(d.historicos, ws).filter((h) => h.tipo === tipo).map((h) => h.id);
      return new Set(ids);
    },
    async catalogosHistoricos(ws) {
      const c = d.catalogos[ws] ?? {};
      const pedidos = deWs(d.historicos, ws).filter((h) => h.tipo === "PEDIDO");
      return {
        numerosPedido: [...(c.numerosPedido ?? []), ...pedidos.map((h) => String(h.datos.number))],
        numerosProyecto: [...(c.numerosProyecto ?? []), ...deWs(d.historicos, ws).filter((h) => h.tipo === "PROYECTO").map((h) => String(h.datos.number))],
        numerosContrato: [...(c.numerosContrato ?? []), ...deWs(d.historicos, ws).filter((h) => h.tipo === "CONTRATO").map((h) => String(h.datos.number))],
        presupuestosConPedido: [...(c.presupuestosConPedido ?? []), ...pedidos.map((h) => h.datos.presupuestoId).filter((x): x is string => typeof x === "string")],
        categoriasNota: c.categoriasNota ?? [],
        tiposCita: c.tiposCita ?? [],
        rolesProyecto: c.rolesProyecto ?? [],
        rubrosEgreso: c.rubrosEgreso ?? [],
        imputado: (() => {
          const out: Record<string, number> = { ...(c.imputado ?? {}) };
          for (const h of deWs(d.historicos, ws).filter((x) => x.tipo === "COBRO")) {
            for (const i of (h.extra.imputaciones as { cuotaId: string; amountArs: string }[] | undefined) ?? []) out[i.cuotaId] = (out[i.cuotaId] ?? 0) + Math.round(Number(i.amountArs) * 100);
          }
          return out;
        })(),
      };
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
            // Como el de Prisma: sólo lo que sigue igual a lo visto al decidir.
            const previos = dec.previos;
            Object.assign(c.campos, previos ? Object.fromEntries(Object.entries(v).filter(([k]) => !(k in previos) || huellaCampo(previos[k]) === huellaCampo(c.campos[k] ?? null))) : v);
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
        case "circuitos":
          id = nuevoId("circ");
          d.circuitos.push({ workspaceId: ws, id, name: String(v.name), kind: String(v.kind) });
          break;
        case "etapas":
          if (!d.circuitos.some((x) => x.workspaceId === ws && x.id === v.circuitId)) throw Object.assign(new Error("circuito ajeno"), { code: "P2025" });
          id = nuevoId("etapa");
          d.etapas.push({ workspaceId: ws, id, circuitId: String(v.circuitId), name: String(v.name) });
          break;
        default: {
          const tipoBase = TIPO_DE[clave];
          if (!tipoBase || !crear) throw new Error(`Parte sin escritor: ${clave}`);
          // Como el de Prisma: los cobros sin pedido van al libro Histórico Alboom, no a Caja.
          const tipo = tipoBase;
          id = nuevoId(tipo.toLowerCase());
          d.historicos.push({ workspaceId: ws, clave, tipo, id, datos: { ...v }, extra: structuredClone((dec.extra ?? {}) as Record<string, unknown>) });
          if (clave === "cuotas") {
            d.recordatoriosCuota.push({ workspaceId: ws, cuotaId: id, dueDate: String(v.dueDate) });
            // Como el de Prisma: la cuota cobrada trae su cobro (sin Caja), imputado entero a ella.
            if (v.cobrada === true) {
              const pedido = d.historicos.find((h) => h.workspaceId === ws && h.id === v.pedidoId);
              d.historicos.push({
                workspaceId: ws,
                clave,
                tipo: "COBRO",
                id: nuevoId("cobro"),
                datos: { pedidoId: v.pedidoId ?? null, clientId: pedido?.datos.clientId ?? null, paidAt: v.paidAt ?? null, method: v.method ?? null, amountArs: v.amountArs ?? null, receiptNumber: v.receiptNumber ?? null },
                extra: { imputaciones: [{ cuotaId: id, amountArs: String(v.amountArs) }] },
              });
            }
          }
          if (clave === "citas") d.recordatoriosCita.push({ workspaceId: ws, citaId: id, startAt: String(v.startAt) });
        }
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
