/**
 * Lógica de progreso del concurso por módulo.
 * Calcula estado y completitud de cada módulo.
 */

import { getEditPermission, getRestrictionMessage, type ContestContext } from "../contest-permissions";
import { MODULE_STATUS } from "./contestStatus";

export type ContestModuleId =
  | "datos"
  | "fechas"
  | "categorias"
  | "jurado"
  | "premios"
  | "comercializacion"
  | "bases"
  | "publicacion";

export type ModuleVisualState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "LOCKED" | "RESTRICTED";

export type ModuleInfo = {
  id: ContestModuleId;
  label: string;
  description: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  visualState: ModuleVisualState;
  cta: "Configurar" | "Editar" | "Completar" | "Ver";
  progress: number;
  editPermission: "full" | "partial" | "readonly" | "locked";
  restrictionMessage: string | null;
};

type ContestWithRelations = {
  id: string;
  title: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  startAt: Date | null;
  submissionDeadline: Date | null;
  judgingStartAt: Date | null;
  judgingEndAt: Date | null;
  resultsAt: Date | null;
  status: string;
  rulesText: string | null;
  categories: { id: string; name: string }[];
};

export function getModuleStatus(
  contest: ContestWithRelations,
  moduleId: ContestModuleId
): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" {
  switch (moduleId) {
    case "datos":
      return contest.title && contest.shortDescription
        ? MODULE_STATUS.COMPLETE
        : contest.title || contest.shortDescription
          ? MODULE_STATUS.IN_PROGRESS
          : MODULE_STATUS.NOT_STARTED;

    case "fechas":
      const hasAnyDate =
        contest.startAt ||
        contest.submissionDeadline ||
        contest.judgingStartAt ||
        contest.judgingEndAt ||
        contest.resultsAt;
      const hasKeyDates = !!contest.submissionDeadline;
      return hasKeyDates ? MODULE_STATUS.COMPLETE : hasAnyDate ? MODULE_STATUS.IN_PROGRESS : MODULE_STATUS.NOT_STARTED;

    case "categorias":
      const count = contest.categories?.length ?? 0;
      return count >= 1 ? MODULE_STATUS.COMPLETE : count > 0 ? MODULE_STATUS.IN_PROGRESS : MODULE_STATUS.NOT_STARTED;

    case "jurado":
      // Placeholder: no implementado
      return MODULE_STATUS.NOT_STARTED;

    case "premios":
      // Placeholder: no implementado
      return MODULE_STATUS.NOT_STARTED;

    case "comercializacion":
      // Placeholder: no implementado
      return MODULE_STATUS.NOT_STARTED;

    case "bases":
      return contest.rulesText ? MODULE_STATUS.COMPLETE : MODULE_STATUS.NOT_STARTED;

    case "publicacion":
      return contest.status === "PUBLISHED" || contest.status === "ACTIVE" || contest.status === "CLOSED"
        ? MODULE_STATUS.COMPLETE
        : contest.status === "READY_TO_PUBLISH"
          ? MODULE_STATUS.IN_PROGRESS
          : MODULE_STATUS.NOT_STARTED;

    default:
      return MODULE_STATUS.NOT_STARTED;
  }
}

export function getModuleProgress(contest: ContestWithRelations, moduleId: ContestModuleId): number {
  const status = getModuleStatus(contest, moduleId);
  if (status === MODULE_STATUS.COMPLETE) return 100;
  if (status === MODULE_STATUS.IN_PROGRESS) {
    switch (moduleId) {
      case "datos":
        let n = 0;
        if (contest.title) n++;
        if (contest.shortDescription) n++;
        if (contest.fullDescription) n++;
        return Math.round((n / 3) * 100);
      case "fechas":
        const dates = [
          contest.startAt,
          contest.submissionDeadline,
          contest.judgingStartAt,
          contest.judgingEndAt,
          contest.resultsAt,
        ].filter(Boolean).length;
        return Math.round((dates / 5) * 100);
      case "categorias":
        return contest.categories?.length ? 50 : 0;
      default:
        return 50;
    }
  }
  return 0;
}

const MODULE_CONFIG: Record<
  ContestModuleId,
  { label: string; description: string }
> = {
  datos: {
    label: "Datos generales",
    description: "Título, descripción, imagen de portada y visibilidad.",
  },
  fechas: {
    label: "Fechas",
    description: "Calendario: inicio, cierre de inscripciones, evaluación, resultados.",
  },
  categorias: {
    label: "Categorías",
    description: "Definir categorías para las obras participantes.",
  },
  jurado: {
    label: "Jurado",
    description: "Integrantes del jurado y criterios de evaluación.",
  },
  premios: {
    label: "Premios y reconocimientos",
    description: "Premios por categoría y modalidad de entrega.",
  },
  comercializacion: {
    label: "Comercialización de obras",
    description: "Opciones de venta, márgenes y participación del organizador.",
  },
  bases: {
    label: "Bases y condiciones",
    description: "Bases legales generadas a partir de la configuración del concurso.",
  },
  publicacion: {
    label: "Publicación",
    description: "Publicar el concurso cuando todo esté listo.",
  },
};

function getModuleCta(
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE",
  editPermission: "full" | "partial" | "readonly" | "locked"
): "Configurar" | "Editar" | "Completar" | "Ver" {
  if (editPermission === "locked") return "Ver";
  if (status === MODULE_STATUS.COMPLETE) return "Editar";
  if (status === MODULE_STATUS.IN_PROGRESS) return "Completar";
  return "Configurar";
}

function getVisualState(
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE",
  editPermission: "full" | "partial" | "readonly" | "locked"
): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "LOCKED" | "RESTRICTED" {
  if (editPermission === "locked") return "LOCKED";
  if (editPermission === "partial") return "RESTRICTED";
  return status;
}

export function getAllModules(contest: ContestWithRelations): ModuleInfo[] {
  const ids: ContestModuleId[] = [
    "datos",
    "fechas",
    "categorias",
    "jurado",
    "premios",
    "comercializacion",
    "bases",
    "publicacion",
  ];
  return ids.map((id) => {
    const status = getModuleStatus(contest, id);
    const config = MODULE_CONFIG[id];
    const editPermission = getEditPermission(id, contest.status);
    const restrictionMessage = getRestrictionMessage(id, contest.status);
    const visualState = getVisualState(status, editPermission);
    return {
      id,
      label: config.label,
      description: config.description,
      status,
      visualState,
      cta: getModuleCta(status, editPermission),
      progress: getModuleProgress(contest, id),
      editPermission,
      restrictionMessage,
    };
  });
}

export function getOverallProgress(contest: ContestWithRelations): number {
  const modules = getAllModules(contest);
  const total = modules.reduce((acc, m) => acc + m.progress, 0);
  return Math.round(total / modules.length);
}
