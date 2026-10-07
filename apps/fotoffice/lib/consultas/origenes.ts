import "server-only";
import { contarPor, crearCatalogo } from "./catalogo";

/** Orígenes de las consultas ("¿Cómo nos conociste?"): nombre, orden y archivar (spec §3.4). */
const catalogo = crearCatalogo({
  tabla: "fotofficeOrigen",
  conGrupo: false,
  minimoActivos: 0,
  textos: {
    noEncontrado: "No encontramos ese origen.",
    repetido: "Ya hay un origen con ese nombre.",
    yaSeUso: "Este origen ya se usó en alguna consulta: archivalo.",
  },
  usos: (db, workspaceId, ids) => contarPor(db, "fotofficeConsulta", "originId", workspaceId, ids),
});

export const listarOrigenes = catalogo.listar;
export const crearOrigen = (ctx: Parameters<typeof catalogo.crear>[0], datos: { nombre: unknown }) => catalogo.crear(ctx, datos);
export const editarOrigen = (ctx: Parameters<typeof catalogo.editar>[0], id: unknown, cambios: { nombre?: unknown }) =>
  catalogo.editar(ctx, id, { nombre: cambios?.nombre });
export const reordenarOrigenes = catalogo.reordenar;
export const archivarOrigen = catalogo.archivar;
export const desarchivarOrigen = catalogo.desarchivar;
export const borrarOrigen = catalogo.borrar;
