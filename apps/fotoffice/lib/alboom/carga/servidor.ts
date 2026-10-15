import "server-only";
import { cancelarCarga, correrCargas, estadoCargas, iniciarCarga, iniciarSimulacion, type DepsCorrida } from "./cargas";
import { repoPrisma } from "./repositorio-prisma";

/**
 * La carga desde Alboom con la base real (Prisma). Lo usan la pantalla, sus acciones y el cron; la lógica vive en
 * `cargas.ts` y `motor.ts`, que reciben el repositorio.
 */

export const simularAlboom = (workspaceId: string, userId: number, entidades: readonly string[]) => iniciarSimulacion(repoPrisma, workspaceId, userId, entidades);
export const cargarAlboom = (workspaceId: string, userId: number) => iniciarCarga(repoPrisma, workspaceId, userId);
export const cancelarCargaAlboom = (workspaceId: string) => cancelarCarga(repoPrisma, workspaceId);
export const estadoCargaAlboom = (workspaceId: string) => estadoCargas(repoPrisma, workspaceId);
export const hayCargaAlboomActiva = async (workspaceId: string) => (await repoPrisma.cargaActiva(workspaceId)) !== null;
export const correrCargasAlboom = (deps?: DepsCorrida) => correrCargas(repoPrisma, deps);
