/**
 * Human-readable participant / artwork status for public UX.
 * Never expose raw enums, pipeline or storage jargon.
 */

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger";

export type PresentedStatus = {
  label: string;
  description: string;
  tone: StatusTone;
  nextAction: string | null;
};

const REGISTRATION_MAP: Record<string, PresentedStatus> = {
  CONFIRMED: {
    label: "Inscripción confirmada",
    description: "Tu inscripción está registrada correctamente.",
    tone: "success",
    nextAction: "Revisar participación",
  },
  PENDING_PAYMENT: {
    label: "Pago pendiente",
    description: "Tu inscripción quedó registrada; falta completar el pago.",
    tone: "warning",
    nextAction: "Completar pago",
  },
  DRAFT: {
    label: "Borrador",
    description: "Todavía falta confirmar la inscripción.",
    tone: "neutral",
    nextAction: "Completar datos",
  },
  CANCELLED: {
    label: "Cancelada",
    description: "Esta inscripción fue cancelada.",
    tone: "danger",
    nextAction: null,
  },
  DISQUALIFIED: {
    label: "No admitida",
    description: "Esta participación no fue admitida según las bases.",
    tone: "danger",
    nextAction: null,
  },
};

const ENTRY_MAP: Record<string, PresentedStatus> = {
  CONFIRMED: {
    label: "Fotografía presentada",
    description: "Tu obra fue confirmada y forma parte de tu participación.",
    tone: "success",
    nextAction: "Revisar participación",
  },
  UPLOADED: {
    label: "Fotografía cargada",
    description: "El archivo está cargado; puede haber controles técnicos en curso.",
    tone: "primary",
    nextAction: "Revisar participación",
  },
  PENDING: {
    label: "Pendiente de carga",
    description: "Todavía no presentaste una fotografía.",
    tone: "warning",
    nextAction: "Cargar fotografía",
  },
  NEEDS_REVIEW: {
    label: "Requiere atención",
    description: "Hay una observación sobre tu obra. Revisá el mensaje del organizador.",
    tone: "warning",
    nextAction: "Revisar observación",
  },
  REJECTED: {
    label: "No admitida",
    description: "La obra no fue admitida. Revisá el motivo comunicado.",
    tone: "danger",
    nextAction: "Ver detalle",
  },
};

export function presentRegistrationStatus(status: string): PresentedStatus {
  return (
    REGISTRATION_MAP[status] ?? {
      label: "Participación",
      description: "Consultá el detalle de tu inscripción en el concurso.",
      tone: "neutral" as const,
      nextAction: "Continuar participación",
    }
  );
}

export function presentArtworkStatus(input: {
  hasEntry: boolean;
  entryStatus?: string | null;
  technicalSummaryStatus?: string | null;
  uploadOpen: boolean;
}): PresentedStatus {
  if (!input.hasEntry) {
    if (!input.uploadOpen) {
      return {
        label: "Carga aún no habilitada",
        description: "Tu inscripción está lista. La carga de fotografías se habilitará según el cronograma.",
        tone: "neutral",
        nextAction: null,
      };
    }
    return {
      label: "Pendiente de carga",
      description: "Podés cargar tu fotografía cuando estés listo/a.",
      tone: "warning",
      nextAction: "Cargar fotografía",
    };
  }

  const fromEntry = input.entryStatus ? ENTRY_MAP[input.entryStatus] : null;
  if (fromEntry) return fromEntry;

  const tech = (input.technicalSummaryStatus ?? "").toUpperCase();
  if (tech.includes("FAIL") || tech.includes("REJECT")) {
    return ENTRY_MAP.NEEDS_REVIEW!;
  }

  return {
    label: "Fotografía en revisión",
    description: "Tu archivo fue recibido y está siendo revisado.",
    tone: "primary",
    nextAction: "Revisar participación",
  };
}

export type ChecklistItemState = "done" | "pending" | "attention" | "blocked" | "upcoming";

export type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  state: ChecklistItemState;
  mark: string;
};

export function buildParticipantChecklist(input: {
  registered: boolean;
  registrationStatus: string;
  hasEntry: boolean;
  entryStatus?: string | null;
  uploadOpen: boolean;
}): ChecklistItem[] {
  const regOk =
    input.registered &&
    input.registrationStatus !== "CANCELLED" &&
    input.registrationStatus !== "DISQUALIFIED";
  const photoDone = Boolean(input.hasEntry && input.entryStatus === "CONFIRMED");
  const photoAttention =
    Boolean(input.hasEntry) &&
    (input.entryStatus === "NEEDS_REVIEW" || input.entryStatus === "REJECTED");

  return [
    {
      id: "account",
      title: "Cuenta",
      description: "Sesión iniciada en FotoRank.",
      state: "done",
      mark: "✓",
    },
    {
      id: "registration",
      title: "Datos e inscripción",
      description: regOk
        ? "Inscripción confirmada."
        : "Completá categoría, consentimientos y confirmación.",
      state: regOk ? "done" : "pending",
      mark: regOk ? "✓" : "2",
    },
    {
      id: "photo",
      title: "Fotografía",
      description: !input.uploadOpen
        ? "La carga se habilitará según el cronograma del concurso."
        : photoDone
          ? "Obra presentada."
          : photoAttention
            ? "Hay una observación sobre tu obra."
            : "Cargá y confirmá tu fotografía.",
      state: !input.uploadOpen
        ? "upcoming"
        : photoDone
          ? "done"
          : photoAttention
            ? "attention"
            : "pending",
      mark: !input.uploadOpen ? "…" : photoDone ? "✓" : photoAttention ? "!" : "3",
    },
    {
      id: "review",
      title: "Presentación",
      description: photoDone
        ? "Tu participación está presentada."
        : "Cuando confirmes la fotografía, tu participación quedará completa.",
      state: photoDone ? "done" : "upcoming",
      mark: photoDone ? "✓" : "4",
    },
  ];
}
