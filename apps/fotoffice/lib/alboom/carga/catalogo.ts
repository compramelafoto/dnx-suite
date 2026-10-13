import { randomBytes } from "node:crypto";
import type { FuenteCruda, RepoCarga } from "./repositorio";
import type { Crudo, Decision, EntradaMapa } from "./tipos";
import { PREFIJO_CATEGORIA, TIPO_CATEGORIA, registrarCategoria, traducirCategoria, type CtxCategorias } from "./traductores/categorias";
import { TIPO_CIRCUITO, TIPO_ETAPA, traducirCircuito, traducirEtapa, type CtxCircuitos, type CtxEtapas } from "./traductores/circuitos";
import { TIPO_CLIENTE, compartidos, crearCtxContactos, registrarContacto, traducirContacto, type CtxContactos, type Visto } from "./traductores/contactos";
import { TIPO_ETIQUETA, registrarEtiqueta, traducirEtiqueta, type CtxEtiquetas } from "./traductores/etiquetas";
import { TIPO_ORIGEN, registrarOrigen, traducirOrigen, type CtxOrigenes } from "./traductores/origenes";
import {
  TIPO_COSTO,
  TIPO_ITEM_COMBO,
  TIPO_PRODUCTO,
  registrarCosto,
  registrarItemCombo,
  registrarProducto,
  traducirCosto,
  traducirItemCombo,
  traducirProducto,
  nombresDeProductos,
  previosDe,
  type CtxCombos,
  type CtxCostos,
  type CtxProductos,
} from "./traductores/productos";
import { TIPO_USUARIO, traducirUsuario, type CtxUsuarios } from "./traductores/usuarios";

/**
 * Qué se carga en 8B-1, en orden de dependencias. Cada parte lee una o más entidades crudas de la 8A, arma su
 * contexto (lo que ya existe en FOTOFFICE + el mapa) y traduce registro por registro. Sin `server-only`: el motor
 * recibe el repositorio.
 */

/** Avance de una simulación o carga (`FotofficeAlboomCarga.progress`). Sin datos personales. */
export type Progreso = {
  /** Índice (en `entities`) de la parte en curso. */
  indice: number;
  /** Índice de la fuente cruda dentro de la parte. */
  fuente: number;
  /** Último id de Alboom procesado de esa fuente. */
  cursor: string | null;
  /** Correos vistos (por huella con sal) → contactos que lo usaron (nombre cifrado): duplicados entre tandas. */
  vistos: Record<string, Visto[]>;
  /** Sal de esta corrida para las huellas de `vistos` (no reversibles con un diccionario de correos). */
  sal: string;
  /** Sólo en la simulación: lo que se habría creado o vinculado, para que las partes que dependen lo vean. */
  simulados: Record<string, Record<string, string>>;
  /** Fallas inesperadas seguidas (la base, por ejemplo). */
  reintentos: number;
  /** En una CARGA: la simulación que la habilitó. */
  simulacionId?: string;
};

export function progresoInicial(extra: Partial<Progreso> = {}): Progreso {
  return { indice: 0, fuente: 0, cursor: null, vistos: {}, sal: randomBytes(16).toString("hex"), simulados: {}, reintentos: 0, ...extra };
}

export function leerProgreso(json: unknown): Progreso {
  const p = typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Partial<Progreso>) : {};
  return {
    indice: typeof p.indice === "number" ? p.indice : 0,
    fuente: typeof p.fuente === "number" ? p.fuente : 0,
    cursor: typeof p.cursor === "string" ? p.cursor : null,
    vistos: typeof p.vistos === "object" && p.vistos !== null ? p.vistos : {},
    sal: typeof p.sal === "string" ? p.sal : "",
    simulados: typeof p.simulados === "object" && p.simulados !== null ? p.simulados : {},
    reintentos: typeof p.reintentos === "number" ? p.reintentos : 0,
    ...(typeof p.simulacionId === "string" ? { simulacionId: p.simulacionId } : {}),
  };
}

type Ctx = unknown;

export type ParteCarga = {
  clave: string;
  nombre: string;
  fuentes: FuenteCruda[];
  /** Partes que tienen que estar cargadas antes (se suman solas al elegir). */
  depende: string[];
  targetType: string;
  /** Otras partes usan sus ids (en la simulación se guardan en `simulados`). */
  exporta: boolean;
  contexto(repo: RepoCarga, workspaceId: string, progreso: Progreso): Promise<Ctx>;
  traducir(c: Crudo, ctx: Ctx): Decision;
  registrar?(ctx: Ctx, c: Crudo, d: Decision, targetId: string): void;
};

function porAlboomId(filas: EntradaMapa[], entity: string): Map<string, EntradaMapa> {
  return new Map(filas.filter((f) => f.entity === entity).map((f) => [f.alboomId, f]));
}

/** Id de Alboom → id de FOTOFFICE de una entidad: el mapa y, en una simulación, lo simulado. */
async function idsDe(repo: RepoCarga, ws: string, progreso: Progreso, entity: string, conPrefijo = false): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const f of await repo.leerMapa(ws, [entity])) m.set(conPrefijo ? `${entity}/${f.alboomId}` : f.alboomId, f.targetId);
  for (const [id, target] of Object.entries(progreso.simulados[entity] ?? {})) m.set(conPrefijo ? `${entity}/${id}` : id, target);
  return m;
}

const siguienteOrden = (filas: { order: number }[]) => filas.reduce((m, f) => Math.max(m, f.order), -1) + 1;

export const PARTES: readonly ParteCarga[] = [
  {
    clave: "usuarios",
    nombre: "Usuarios del equipo",
    fuentes: [{ entity: "usuarios" }],
    depende: [],
    targetType: TIPO_USUARIO,
    exporta: false,
    async contexto(repo, ws): Promise<CtxUsuarios> {
      return { miembros: await repo.miembros(ws), mapa: porAlboomId(await repo.leerMapa(ws, ["usuarios"]), "usuarios") };
    },
    traducir: (c, ctx) => traducirUsuario(c, ctx as CtxUsuarios),
  },
  {
    clave: "origenes",
    nombre: "Orígenes de consulta",
    fuentes: [{ entity: "origenes" }],
    depende: [],
    targetType: TIPO_ORIGEN,
    exporta: false,
    async contexto(repo, ws): Promise<CtxOrigenes> {
      const origenes = await repo.origenes(ws);
      return { origenes, ordenBase: siguienteOrden(origenes), mapa: porAlboomId(await repo.leerMapa(ws, ["origenes"]), "origenes") };
    },
    traducir: (c, ctx) => traducirOrigen(c, ctx as CtxOrigenes),
    registrar: (ctx, _c, d, id) => registrarOrigen(ctx as CtxOrigenes, d, id),
  },
  {
    clave: "categorias_consulta",
    nombre: "Categorías de consulta",
    fuentes: [{ entity: "categorias", prefijo: PREFIJO_CATEGORIA }],
    depende: [],
    targetType: TIPO_CATEGORIA,
    exporta: false,
    async contexto(repo, ws): Promise<CtxCategorias> {
      const categorias = await repo.categoriasConsulta(ws);
      return { categorias, ordenBase: siguienteOrden(categorias), mapa: porAlboomId(await repo.leerMapa(ws, ["categorias"]), "categorias") };
    },
    traducir: (c, ctx) => traducirCategoria(c, ctx as CtxCategorias),
    registrar: (ctx, _c, d, id) => registrarCategoria(ctx as CtxCategorias, d, id),
  },
  {
    clave: "etiquetas",
    nombre: "Etiquetas de contactos",
    fuentes: [{ entity: "etiquetas" }],
    depende: [],
    targetType: TIPO_ETIQUETA,
    exporta: false,
    async contexto(repo, ws): Promise<CtxEtiquetas> {
      return { etiquetas: await repo.etiquetas(ws), mapa: porAlboomId(await repo.leerMapa(ws, ["etiquetas"]), "etiquetas") };
    },
    traducir: (c, ctx) => traducirEtiqueta(c, ctx as CtxEtiquetas),
    registrar: (ctx, _c, d, id) => registrarEtiqueta(ctx as CtxEtiquetas, d, id),
  },
  {
    clave: "circuitos",
    nombre: "Embudos y flujos de trabajo",
    fuentes: [{ entity: "embudos" }, { entity: "flujos_proyecto" }],
    depende: [],
    targetType: TIPO_CIRCUITO,
    exporta: true,
    async contexto(repo, ws): Promise<CtxCircuitos> {
      const mapa = await repo.leerMapa(ws, ["embudos", "flujos_proyecto"]);
      // Las dos entidades tienen ids propios: el mapa del contexto se arma por entidad en `traducir`.
      return { circuitos: await repo.circuitos(ws), mapa: new Map(mapa.map((f) => [`${f.entity}/${f.alboomId}`, f])) };
    },
    traducir: (c, ctx) => {
      const x = ctx as CtxCircuitos;
      const propia = x.mapa.get(`${c.entity}/${c.alboomId}`);
      return traducirCircuito(c, { ...x, mapa: new Map(propia ? [[c.alboomId, propia]] : []) });
    },
  },
  {
    clave: "etapas",
    nombre: "Etapas de embudos y flujos",
    fuentes: [{ entity: "etapas_embudo" }, { entity: "etapas_flujo" }],
    depende: ["circuitos"],
    targetType: TIPO_ETAPA,
    exporta: false,
    async contexto(repo, ws, progreso): Promise<CtxEtapas> {
      const circuitoDe = new Map([...(await idsDe(repo, ws, progreso, "embudos", true)), ...(await idsDe(repo, ws, progreso, "flujos_proyecto", true))]);
      const mapa = await repo.leerMapa(ws, ["etapas_embudo", "etapas_flujo"]);
      return { circuitoDe, etapas: await repo.etapas(ws), mapa: new Map(mapa.map((f) => [`${f.entity}/${f.alboomId}`, f])) };
    },
    traducir: (c, ctx) => {
      const x = ctx as CtxEtapas;
      const propia = x.mapa.get(`${c.entity}/${c.alboomId}`);
      return traducirEtapa(c, { ...x, mapa: new Map(propia ? [[c.alboomId, propia]] : []) });
    },
  },
  {
    clave: "contactos",
    nombre: "Contactos",
    fuentes: [{ entity: "contactos" }],
    depende: [],
    targetType: TIPO_CLIENTE,
    exporta: true,
    async contexto(repo, ws, progreso): Promise<CtxContactos> {
      const etiquetas = new Map((await repo.etiquetas(ws)).map((e) => [e.nameKey, e.id]));
      // Correos y teléfonos que usan varios contactos de nombres distintos: se miran todos los crudos.
      const payloads: unknown[] = [];
      for (let cursor: string | null = null; ; ) {
        const lote = await repo.leerCrudos(ws, { entity: "contactos" }, cursor, 1000);
        if (lote.length === 0) break;
        for (const c of lote) payloads.push(c.payload);
        cursor = lote[lote.length - 1]!.alboomId;
      }
      const { correos, telefonos } = compartidos(payloads);
      return crearCtxContactos({
        sal: progreso.sal,
        delEstudio: await repo.correosDelEstudio(ws),
        correosCompartidos: correos,
        telefonosCompartidos: telefonos,
        clientes: await repo.clientes(ws),
        etiquetas,
        mapa: porAlboomId(await repo.leerMapa(ws, ["contactos"]), "contactos"),
        // El motor vuelve a guardar `vistos` en el avance después de cada lote.
        vistos: new Map(Object.entries(progreso.vistos)),
      });
    },
    traducir: (c, ctx) => traducirContacto(c, ctx as CtxContactos),
    registrar: (ctx, c, d, id) => registrarContacto(ctx as CtxContactos, c, d, id),
  },
  {
    clave: "productos",
    nombre: "Productos y servicios",
    fuentes: [{ entity: "productos" }],
    depende: [],
    targetType: TIPO_PRODUCTO,
    exporta: true,
    async contexto(repo, ws): Promise<CtxProductos> {
      const productos = await repo.productos(ws);
      const mapa = porAlboomId(await repo.leerMapa(ws, ["productos"]), "productos");
      const crudos: { alboomId: string; payload: unknown }[] = [];
      for (let cursor: string | null = null; ; ) {
        const lote = await repo.leerCrudos(ws, { entity: "productos" }, cursor, 1000);
        if (lote.length === 0) break;
        crudos.push(...lote);
        cursor = lote[lote.length - 1]!.alboomId;
      }
      return { productos, mapa, previos: previosDe(productos.map((p) => p.id), mapa.values()), nombresAlboom: nombresDeProductos(crudos) };
    },
    traducir: (c, ctx) => traducirProducto(c, ctx as CtxProductos),
    registrar: (ctx, _c, d, id) => registrarProducto(ctx as CtxProductos, d, id),
  },
  {
    clave: "combos",
    nombre: "Contenido de los combos",
    fuentes: [{ entity: "combos" }],
    depende: ["productos"],
    targetType: TIPO_ITEM_COMBO,
    exporta: false,
    async contexto(repo, ws, progreso): Promise<CtxCombos> {
      return {
        productoDe: await idsDe(repo, ws, progreso, "productos"),
        ...(await (async () => {
          const items = await repo.itemsCombo(ws);
          const mapa = porAlboomId(await repo.leerMapa(ws, ["combos"]), "combos");
          return { items, mapa, previos: previosDe(items.map((i) => i.id), mapa.values()) };
        })()),
      };
    },
    traducir: (c, ctx) => traducirItemCombo(c, ctx as CtxCombos),
    registrar: (ctx, _c, d, id) => registrarItemCombo(ctx as CtxCombos, d, id),
  },
  {
    clave: "costos",
    nombre: "Costos de los productos",
    fuentes: [{ entity: "costos_producto" }],
    depende: ["productos"],
    targetType: TIPO_COSTO,
    exporta: false,
    async contexto(repo, ws, progreso): Promise<CtxCostos> {
      return {
        productoDe: await idsDe(repo, ws, progreso, "productos"),
        contactoDe: await idsDe(repo, ws, progreso, "contactos"),
        ...(await (async () => {
          const costos = await repo.costos(ws);
          const mapa = porAlboomId(await repo.leerMapa(ws, ["costos_producto"]), "costos_producto");
          return { costos, mapa, previos: previosDe(costos.map((x) => x.id), mapa.values()) };
        })()),
      };
    },
    traducir: (c, ctx) => traducirCosto(c, ctx as CtxCostos),
    registrar: (ctx, _c, d, id) => registrarCosto(ctx as CtxCostos, d, id),
  },
];

export const CLAVES_CARGA = PARTES.map((p) => p.clave);

/** Las partes elegidas más sus dependencias, en el orden del catálogo. Las claves desconocidas se ignoran. */
export function conDependencias(elegidas: readonly string[]): string[] {
  const set = new Set(elegidas.filter((c) => CLAVES_CARGA.includes(c)));
  if (set.size === 0) return [...CLAVES_CARGA];
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const p of PARTES) if (set.has(p.clave)) for (const d of p.depende) if (!set.has(d)) (set.add(d), (cambio = true));
  }
  return CLAVES_CARGA.filter((c) => set.has(c));
}

export function fuentesDe(claves: readonly string[]): FuenteCruda[] {
  return PARTES.filter((p) => claves.includes(p.clave)).flatMap((p) => p.fuentes);
}

export function parte(clave: string): ParteCarga | undefined {
  return PARTES.find((p) => p.clave === clave);
}
