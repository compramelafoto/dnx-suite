import {
  formatConsultaPipelineStage,
  formatConsultaPriority,
  formatConsultaStatus,
} from "@/lib/cuantocobro/consulta/consulta-format";
import type {
  CuantoCobroConsultaPipelineStage,
  CuantoCobroConsultaPriority,
  CuantoCobroConsultaStatus,
} from "@prisma/client";

const STATUS_CLASS: Record<CuantoCobroConsultaStatus, string> = {
  OPEN: "cc-consulta-badge--open",
  WON: "cc-consulta-badge--won",
  LOST: "cc-consulta-badge--lost",
  ARCHIVED: "cc-consulta-badge--archived",
};

const STAGE_CLASS: Record<CuantoCobroConsultaPipelineStage, string> = {
  NEW: "cc-consulta-badge--stage-new",
  CONTACTED: "cc-consulta-badge--stage-contacted",
  QUALIFIED: "cc-consulta-badge--stage-qualified",
  PROPOSAL_SENT: "cc-consulta-badge--stage-proposal",
  NEGOTIATION: "cc-consulta-badge--stage-negotiation",
  WON: "cc-consulta-badge--won",
  LOST: "cc-consulta-badge--lost",
};

const PRIORITY_CLASS: Record<CuantoCobroConsultaPriority, string> = {
  LOW: "cc-consulta-badge--priority-low",
  NORMAL: "cc-consulta-badge--priority-normal",
  HIGH: "cc-consulta-badge--priority-high",
};

export function ConsultaStatusBadge({ status }: { status: CuantoCobroConsultaStatus }) {
  return (
    <span className={`cc-consulta-badge ${STATUS_CLASS[status]}`}>{formatConsultaStatus(status)}</span>
  );
}

export function ConsultaStageBadge({ stage }: { stage: CuantoCobroConsultaPipelineStage }) {
  return (
    <span className={`cc-consulta-badge ${STAGE_CLASS[stage]}`}>{formatConsultaPipelineStage(stage)}</span>
  );
}

export function ConsultaPriorityBadge({ priority }: { priority: CuantoCobroConsultaPriority }) {
  return (
    <span className={`cc-consulta-badge ${PRIORITY_CLASS[priority]}`}>
      {formatConsultaPriority(priority)}
    </span>
  );
}
