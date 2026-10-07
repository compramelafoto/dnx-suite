import "server-only";
import { contarPor, crearCatalogo } from "./catalogo";

/** Roles de los participantes de una consulta (Fotógrafo principal, Salón, DJ…): spec §3.4. */
const catalogo = crearCatalogo({
  tabla: "fotofficeRolParticipante",
  conGrupo: false,
  minimoActivos: 0,
  textos: {
    noEncontrado: "No encontramos ese rol.",
    repetido: "Ya hay un rol con ese nombre.",
    yaSeUso: "Este rol ya se usó en alguna consulta: archivalo.",
  },
  usos: (db, workspaceId, ids) => contarPor(db, "fotofficeConsultaParticipante", "roleId", workspaceId, ids),
});

export const listarRoles = catalogo.listar;
export const crearRol = (ctx: Parameters<typeof catalogo.crear>[0], datos: { nombre: unknown }) => catalogo.crear(ctx, datos);
export const editarRol = (ctx: Parameters<typeof catalogo.editar>[0], id: unknown, cambios: { nombre?: unknown }) =>
  catalogo.editar(ctx, id, { nombre: cambios?.nombre });
export const reordenarRoles = catalogo.reordenar;
export const archivarRol = catalogo.archivar;
export const desarchivarRol = catalogo.desarchivar;
export const borrarRol = catalogo.borrar;
