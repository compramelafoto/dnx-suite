import type { Prisma } from "@repo/db";
import type { TipoSujeto } from "../constantes";

/** El registro que recorre un circuito: una consulta de Captación, más adelante un proyecto, etc. */
export type Sujeto = { tipo: TipoSujeto; id: string };

export type NombreDeSujeto = { titulo: string; subtitulo?: string; href: string };

/**
 * Lo que el motor necesita saber de cada tipo de registro. El motor no conoce las tablas de los
 * módulos: pregunta al adaptador si el registro existe, cómo se llama y cómo actualizar su
 * estado compatible cuando cambia de etapa.
 */
export type Adaptador = {
  /** Módulo que tiene que estar encendido para operar sobre este tipo de registro. */
  moduleKey: string;
  /** Pantalla donde se ven todos los registros de este tipo (se revalida después de cada cambio). */
  rutaTablero: string;
  /** Ficha de un registro. */
  rutaFicha(id: string): string;
  /** El registro existe y es de este workspace. */
  existe(tx: Prisma.TransactionClient, workspaceId: string, id: string): Promise<boolean>;
  /** Nombre, detalle y enlace a la ficha de cada id (sólo los del workspace). */
  nombre(workspaceId: string, ids: string[]): Promise<Map<string, NombreDeSujeto>>;
  /**
   * Se llama dentro de la misma transacción del movimiento. `etapa` es la etapa de destino
   * (null al cerrar) y `salida` el resultado del cierre (null al mover).
   */
  alCambiarEtapa?(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    etapa: { leadStatus: string | null } | null,
    salida: string | null,
  ): Promise<void>;
};
