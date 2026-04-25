"use server";

import { redirect } from "next/navigation";
import { prisma, Prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";

const FORM_MODES = new Set(["SPECIFIC", "GENERAL"]);
const AUTO_REPLY_MODES = new Set(["EMAIL_TEXT", "EMAIL_WITH_LINK", "EMAIL_WITH_ATTACHMENT"]);
const POST_SUBMIT_ACTION_TYPES = new Set(["NONE", "WHATSAPP", "URL"]);

function parseRequiredText(value: FormDataEntryValue | null): string {
  return value?.toString().trim() ?? "";
}

function parseSlug(value: FormDataEntryValue | null): string {
  return value?.toString().trim().toLowerCase() ?? "";
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value?.toString() === "on";
}

function parseInteger(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseInt(value?.toString() ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function toJsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? (error as { code?: string }).code ?? ""
    : "";
}

export async function createServiceLeadForm(formData: FormData) {
  const { workspace } = await requireActiveWorkspace();
  if (!workspace) {
    redirect("/dashboard/service-leads/forms");
  }

  const name = parseRequiredText(formData.get("name"));
  const slug = parseSlug(formData.get("slug"));
  const eventType = parseRequiredText(formData.get("eventType"));
  const formMode = parseRequiredText(formData.get("formMode"));
  const isActive = parseCheckbox(formData.get("isActive"));
  const isDefault = parseCheckbox(formData.get("isDefault"));

  if (!name || !slug || !eventType || !FORM_MODES.has(formMode)) {
    redirect("/dashboard/service-leads/forms/new?error=invalid");
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    redirect("/dashboard/service-leads/forms/new?error=slug");
  }

  try {
    if (isDefault) {
      await prisma.serviceLeadForm.updateMany({
        where: {
          workspaceId: workspace.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    await prisma.serviceLeadForm.create({
      data: {
        workspaceId: workspace.id,
        name,
        slug,
        eventType,
        formMode,
        isActive,
        isDefault,
        configJson: {
          schemaVersion: 1,
          fields: [],
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error: unknown) {
    if (getErrorCode(error) === "P2002") {
      redirect("/dashboard/service-leads/forms/new?error=slug_taken");
    }
    redirect("/dashboard/service-leads/forms/new?error=create");
  }

  redirect("/dashboard/service-leads/forms");
}

export async function updateServiceLeadForm(formData: FormData) {
  const { workspace } = await requireActiveWorkspace();
  if (!workspace) {
    redirect("/dashboard/service-leads/forms");
  }

  const formId = parseRequiredText(formData.get("formId"));
  const name = parseRequiredText(formData.get("name"));
  const slug = parseSlug(formData.get("slug"));
  const eventType = parseRequiredText(formData.get("eventType"));
  const formMode = parseRequiredText(formData.get("formMode"));
  const isActive = parseCheckbox(formData.get("isActive"));
  const isDefault = parseCheckbox(formData.get("isDefault"));
  const autoReplyEnabled = parseCheckbox(formData.get("autoReplyEnabled"));
  const autoReplyMode = parseRequiredText(formData.get("autoReplyMode"));
  const autoReplySubject = parseRequiredText(formData.get("autoReplySubject"));
  const autoReplyBody = parseRequiredText(formData.get("autoReplyBody"));
  const autoReplyLinkUrl = parseRequiredText(formData.get("autoReplyLinkUrl"));
  const autoReplyAttachmentUrl = parseRequiredText(formData.get("autoReplyAttachmentUrl"));
  const postSubmitActionType = parseRequiredText(formData.get("postSubmitActionType"));
  const postSubmitDelaySeconds = parseInteger(formData.get("postSubmitDelaySeconds"), 3);
  const postSubmitUrl = parseRequiredText(formData.get("postSubmitUrl"));

  if (!formId || !name || !slug || !eventType || !FORM_MODES.has(formMode)) {
    redirect(`/dashboard/service-leads/forms/${formId}?error=invalid`);
  }
  if (!AUTO_REPLY_MODES.has(autoReplyMode) || !POST_SUBMIT_ACTION_TYPES.has(postSubmitActionType)) {
    redirect(`/dashboard/service-leads/forms/${formId}?error=invalid`);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    redirect(`/dashboard/service-leads/forms/${formId}?error=slug`);
  }

  try {
    if (isDefault) {
      await prisma.serviceLeadForm.updateMany({
        where: {
          workspaceId: workspace.id,
          isDefault: true,
          id: { not: formId },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const existing = await prisma.serviceLeadForm.findFirst({
      where: {
        id: formId,
        workspaceId: workspace.id,
      },
      select: {
        configJson: true,
      },
    });

    if (!existing) {
      redirect("/dashboard/service-leads/forms");
    }

    const existingConfig = toJsonObject(existing.configJson);
    const nextConfig: Prisma.InputJsonValue = {
      ...existingConfig,
      autoReply: {
        enabled: autoReplyEnabled,
        mode: autoReplyMode,
        subject: autoReplySubject,
        body: autoReplyBody,
        linkUrl: autoReplyLinkUrl,
        attachmentUrl: autoReplyAttachmentUrl,
      },
      postSubmitAction: {
        type: postSubmitActionType,
        delaySeconds: postSubmitDelaySeconds,
        url: postSubmitUrl,
      },
    };

    const result = await prisma.serviceLeadForm.updateMany({
      where: {
        id: formId,
        workspaceId: workspace.id,
      },
      data: {
        name,
        slug,
        eventType,
        formMode,
        isActive,
        isDefault,
        configJson: nextConfig,
      },
    });

    if (result.count === 0) {
      redirect("/dashboard/service-leads/forms");
    }
  } catch (error: unknown) {
    if (getErrorCode(error) === "P2002") {
      redirect(`/dashboard/service-leads/forms/${formId}?error=slug_taken`);
    }
    redirect(`/dashboard/service-leads/forms/${formId}?error=update`);
  }

  redirect("/dashboard/service-leads/forms");
}
