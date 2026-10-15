"use client";

import { useMemo } from "react";
import {
  borrarAdjuntoAction, confirmarSubidaAdjuntoAction, enlaceDeDescargaAdjuntoAction, pedirSubidaAdjuntoAction, restaurarAdjuntoAction,
} from "@/app/actions/proyectos";
import { Adjuntos, type CanalDeAdjuntos } from "@/components/ficha/adjuntos";
import type { AdjuntoVista } from "@/components/ficha/tipos";

/**
 * Adjuntos privados del proyecto: el mismo componente que las fichas de personas, con el canal
 * de las acciones del proyecto. Todos los que ven el proyecto descargan; con "Gestionar" suben y
 * borran, y un administrador restaura (30 días).
 */
export function AdjuntosProyecto({
  proyectoId,
  adjuntos,
  habilitados,
  puedeEditar,
  esConfigurador,
}: {
  proyectoId: string;
  adjuntos: AdjuntoVista[];
  habilitados: boolean;
  puedeEditar: boolean;
  esConfigurador: boolean;
}) {
  const canal = useMemo<CanalDeAdjuntos>(
    () => ({
      pedir: (archivo) => pedirSubidaAdjuntoAction(proyectoId, archivo),
      confirmar: (id) => confirmarSubidaAdjuntoAction(proyectoId, id),
      enlace: (id) => enlaceDeDescargaAdjuntoAction(proyectoId, id),
      borrar: (id) => borrarAdjuntoAction(proyectoId, id),
      restaurar: (id) => restaurarAdjuntoAction(proyectoId, id),
    }),
    [proyectoId],
  );
  return <Adjuntos canal={canal} adjuntos={adjuntos} habilitados={habilitados} esConfigurador={esConfigurador} puedeEditar={puedeEditar} />;
}
