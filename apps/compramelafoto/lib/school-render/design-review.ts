import { prisma } from "@/lib/prisma";

export type DesignReviewResult = {
  ok: boolean;
  status?: string;
  error?: string;
  httpStatus?: number;
};

export async function approveDesignProject(params: {
  designProjectId: number;
  userId: number;
  note?: string | null;
}): Promise<DesignReviewResult> {
  const project = await prisma.designProject.findUnique({
    where: { id: params.designProjectId },
    select: { id: true, status: true },
  });
  if (!project) {
    return { ok: false, error: "not_found", httpStatus: 404 };
  }
  if (project.status === "APPROVED_FOR_EXPORT") {
    return { ok: true, status: project.status };
  }
  if (project.status !== "PENDING_PHOTOGRAPHER_APPROVAL") {
    console.warn("[school_design_review] invalid_transition", {
      designProjectId: params.designProjectId,
      from: project.status,
      to: "APPROVED_FOR_EXPORT",
    });
    return { ok: false, error: "invalid_transition", httpStatus: 409 };
  }

  const updated = await prisma.designProject.update({
    where: { id: params.designProjectId },
    data: {
      status: "APPROVED_FOR_EXPORT",
      approvedAt: new Date(),
      approvedByUserId: params.userId,
      reviewNote: params.note ?? null,
      rejectedAt: null,
      rejectedByUserId: null,
      reviewReason: null,
    },
    select: { status: true },
  });
  console.info("[school_design_review] photographer_approved", {
    designProjectId: params.designProjectId,
  });
  return { ok: true, status: updated.status };
}

export async function rejectDesignProject(params: {
  designProjectId: number;
  userId: number;
  reason: string;
  note?: string | null;
}): Promise<DesignReviewResult> {
  const project = await prisma.designProject.findUnique({
    where: { id: params.designProjectId },
    select: { id: true, status: true },
  });
  if (!project) {
    return { ok: false, error: "not_found", httpStatus: 404 };
  }
  if (project.status === "NEEDS_ADJUSTMENT") {
    return { ok: true, status: project.status };
  }
  if (project.status !== "PENDING_PHOTOGRAPHER_APPROVAL") {
    console.warn("[school_design_review] invalid_transition", {
      designProjectId: params.designProjectId,
      from: project.status,
      to: "NEEDS_ADJUSTMENT",
    });
    return { ok: false, error: "invalid_transition", httpStatus: 409 };
  }

  const updated = await prisma.designProject.update({
    where: { id: params.designProjectId },
    data: {
      status: "NEEDS_ADJUSTMENT",
      rejectedAt: new Date(),
      rejectedByUserId: params.userId,
      reviewReason: params.reason,
      reviewNote: params.note ?? null,
      approvedAt: null,
      approvedByUserId: null,
    },
    select: { status: true },
  });
  console.info("[school_design_review] photographer_rejected", {
    designProjectId: params.designProjectId,
  });
  return { ok: true, status: updated.status };
}

export async function requestDesignRegeneration(params: {
  designProjectId: number;
  userId: number;
}): Promise<DesignReviewResult> {
  const project = await prisma.designProject.findUnique({
    where: { id: params.designProjectId },
    select: { id: true, status: true },
  });
  if (!project) {
    return { ok: false, error: "not_found", httpStatus: 404 };
  }
  if (project.status === "DRAFT_RENDERING") {
    return { ok: true, status: project.status };
  }
  if (project.status !== "NEEDS_ADJUSTMENT") {
    console.warn("[school_design_review] invalid_transition", {
      designProjectId: params.designProjectId,
      from: project.status,
      to: "DRAFT_RENDERING",
    });
    return { ok: false, error: "invalid_transition", httpStatus: 409 };
  }

  const updated = await prisma.designProject.update({
    where: { id: params.designProjectId },
    data: {
      status: "DRAFT_RENDERING",
    },
    select: { status: true },
  });
  console.info("[school_design_review] regeneration_requested", {
    designProjectId: params.designProjectId,
  });
  return { ok: true, status: updated.status };
}

export async function markPreviewRendered(params: {
  designProjectId: number;
}): Promise<DesignReviewResult> {
  const project = await prisma.designProject.findUnique({
    where: { id: params.designProjectId },
    select: { id: true, status: true },
  });
  if (!project) {
    return { ok: false, error: "not_found", httpStatus: 404 };
  }
  if (project.status === "PENDING_PHOTOGRAPHER_APPROVAL") {
    return { ok: true, status: project.status };
  }
  if (project.status !== "DRAFT_RENDERING") {
    console.warn("[school_design_review] invalid_transition", {
      designProjectId: params.designProjectId,
      from: project.status,
      to: "PENDING_PHOTOGRAPHER_APPROVAL",
    });
    return { ok: false, error: "invalid_transition", httpStatus: 409 };
  }
  const updated = await prisma.designProject.update({
    where: { id: params.designProjectId },
    data: { status: "PENDING_PHOTOGRAPHER_APPROVAL" },
    select: { status: true },
  });
  console.info("[school_design_review] preview_rendered", {
    designProjectId: params.designProjectId,
  });
  return { ok: true, status: updated.status };
}

export async function markExportStarted(params: {
  designProjectId: number;
}): Promise<DesignReviewResult> {
  const project = await prisma.designProject.findUnique({
    where: { id: params.designProjectId },
    select: { id: true, status: true },
  });
  if (!project) {
    return { ok: false, error: "not_found", httpStatus: 404 };
  }
  if (project.status === "EXPORTING") {
    return { ok: true, status: project.status };
  }
  if (project.status !== "APPROVED_FOR_EXPORT") {
    console.warn("[school_design_review] invalid_transition", {
      designProjectId: params.designProjectId,
      from: project.status,
      to: "EXPORTING",
    });
    return { ok: false, error: "invalid_transition", httpStatus: 409 };
  }
  const updated = await prisma.designProject.update({
    where: { id: params.designProjectId },
    data: { status: "EXPORTING" },
    select: { status: true },
  });
  console.info("[school_design_review] export_started", {
    designProjectId: params.designProjectId,
  });
  return { ok: true, status: updated.status };
}

export async function markExportCompleted(params: {
  designProjectId: number;
}): Promise<DesignReviewResult> {
  const project = await prisma.designProject.findUnique({
    where: { id: params.designProjectId },
    select: { id: true, status: true },
  });
  if (!project) {
    return { ok: false, error: "not_found", httpStatus: 404 };
  }
  if (project.status === "EXPORTED") {
    return { ok: true, status: project.status };
  }
  if (project.status !== "EXPORTING") {
    console.warn("[school_design_review] invalid_transition", {
      designProjectId: params.designProjectId,
      from: project.status,
      to: "EXPORTED",
    });
    return { ok: false, error: "invalid_transition", httpStatus: 409 };
  }
  const updated = await prisma.designProject.update({
    where: { id: params.designProjectId },
    data: { status: "EXPORTED" },
    select: { status: true },
  });
  console.info("[school_design_review] export_completed", {
    designProjectId: params.designProjectId,
  });
  return { ok: true, status: updated.status };
}
