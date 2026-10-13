import type { CategoriaExistente } from "./traductores/categorias";
import type { CircuitoExistente, EtapaExistente } from "./traductores/circuitos";
import type { ClienteExistente } from "./traductores/contactos";
import type { OrigenExistente } from "./traductores/origenes";
import type { CostoExistente, ItemComboExistente, ProductoExistente } from "./traductores/productos";
import type { Crudo, Decision, EntradaMapa, EstadoCarga, FilaMapa, ModoCarga } from "./tipos";

/**
 * Lo que el motor de la carga necesita de la base. Una implementación con Prisma (`repositorio-prisma.ts`, de
 * servidor) y otra en memoria para las pruebas (`repositorio-memoria.ts`). Toda operación lleva `workspaceId`.
 *
 * La simulación sólo usa las lecturas y el ciclo de vida de `FotofficeAlboomCarga`: nunca `escribir` ni
 * `guardarMapa`.
 */

export type FuenteCruda = { entity: string; prefijo?: string };

export type FilaCarga = {
  id: string;
  workspaceId: string;
  mode: ModoCarga;
  status: EstadoCarga;
  entities: string[];
  report: unknown;
  progress: unknown;
  fingerprint: string | null;
  startedByUserId: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  errorReason: string | null;
  lockedUntil: Date | null;
  updatedAt: Date;
};

export type ActorCarga = { userId: number | null; label: string };

export interface RepoCarga {
  // ── Datos crudos (sólo lectura) ──
  leerCrudos(workspaceId: string, fuente: FuenteCruda, despuesDe: string | null, limite: number): Promise<Crudo[]>;
  /** Huella de lo crudo (ids + huellas, en orden) de esas fuentes, y cuántos registros son. */
  huellaCrudos(workspaceId: string, fuentes: FuenteCruda[]): Promise<{ huella: string; cantidad: number }>;

  // ── Mapa de ids ──
  leerMapa(workspaceId: string, entities: string[]): Promise<EntradaMapa[]>;
  /** Sólo filas del mapa (vínculos con registros que ya existen). Upsert por (workspaceId, entity, alboomId). */
  guardarMapa(workspaceId: string, filas: EntradaMapa[]): Promise<void>;

  // ── Lo que ya existe en FOTOFFICE (contexto de los traductores) ──
  miembros(workspaceId: string): Promise<{ userId: number; email: string | null }[]>;
  origenes(workspaceId: string): Promise<(OrigenExistente & { order: number })[]>;
  categoriasConsulta(workspaceId: string): Promise<(CategoriaExistente & { order: number })[]>;
  etiquetas(workspaceId: string): Promise<{ id: string; nameKey: string }[]>;
  circuitos(workspaceId: string): Promise<CircuitoExistente[]>;
  etapas(workspaceId: string): Promise<EtapaExistente[]>;
  productos(workspaceId: string): Promise<ProductoExistente[]>;
  itemsCombo(workspaceId: string): Promise<ItemComboExistente[]>;
  costos(workspaceId: string): Promise<CostoExistente[]>;
  clientes(workspaceId: string): Promise<ClienteExistente[]>;

  /**
   * Aplica un CREAR o ACTUALIZAR de la entidad `clave` y escribe sus filas del mapa en la MISMA transacción (si se
   * corta a mitad, no queda un registro sin su fila del mapa, que lo duplicaría al reintentar). Devuelve el id del
   * registro de FOTOFFICE.
   */
  escribir(workspaceId: string, clave: string, d: Decision, mapa: FilaMapa[], actor: ActorCarga): Promise<string>;

  // ── Ciclo de vida de FotofficeAlboomCarga ──
  crearCarga(d: {
    workspaceId: string;
    mode: ModoCarga;
    entities: string[];
    fingerprint: string;
    startedByUserId: number;
    progress: unknown;
  }): Promise<{ ok: true; id: string } | { ok: false }>;
  cargaActiva(workspaceId: string): Promise<FilaCarga | null>;
  ultimaCarga(workspaceId: string, mode?: ModoCarga): Promise<FilaCarga | null>;
  hayExtraccionActiva(workspaceId: string): Promise<boolean>;
  /** Activas que nadie está corriendo, las más demoradas primero. Recorre todos los workspaces a propósito. */
  cargasParaCorrer(ahora: Date, limite: number): Promise<{ id: string; workspaceId: string }[]>;
  /** Toma el turno (pasa a CORRIENDO). `false` si otra tanda la tiene o ya no está activa. */
  reclamar(id: string, workspaceId: string, ahora: Date, turnoMs: number): Promise<boolean>;
  leerCarga(id: string, workspaceId: string): Promise<FilaCarga | null>;
  /** `false` si ya no está CORRIENDO (la cancelaron): el motor frena. */
  guardarAvance(id: string, workspaceId: string, report: unknown, progress: unknown): Promise<boolean>;
  /** Suelta el turno sin terminar (se acabó el tiempo de la tanda). */
  soltar(id: string, workspaceId: string, report: unknown, progress: unknown): Promise<void>;
  soltarCancelada(id: string, workspaceId: string): Promise<void>;
  terminar(id: string, workspaceId: string, status: "LISTA" | "ERROR", report: unknown, progress: unknown, errorReason: string | null, ahora: Date): Promise<void>;
  cancelar(workspaceId: string, ahora: Date): Promise<boolean>;
}
