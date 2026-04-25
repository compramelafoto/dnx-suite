import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { updateServiceLeadForm } from "../actions";

type Props = { params: Promise<{ formId: string }> };
type AutoReplyMode = "EMAIL_TEXT" | "EMAIL_WITH_LINK" | "EMAIL_WITH_ATTACHMENT";
type PostSubmitActionType = "NONE" | "WHATSAPP" | "URL";

const AUTO_REPLY_MODE_VALUES: AutoReplyMode[] = ["EMAIL_TEXT", "EMAIL_WITH_LINK", "EMAIL_WITH_ATTACHMENT"];
const POST_SUBMIT_ACTION_VALUES: PostSubmitActionType[] = ["NONE", "WHATSAPP", "URL"];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default async function EditServiceLeadFormPage({ params }: Props) {
  const { workspace } = await requireActiveWorkspace();
  const { formId } = await params;

  if (!workspace) {
    return (
      <div className="space-y-10">
        <PageHeader title="Editar formulario" description="Actualizá los datos básicos del formulario." />
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            No hay workspace activo para este usuario.
          </p>
        </div>
      </div>
    );
  }

  const form = await prisma.serviceLeadForm.findFirst({
    where: {
      id: formId,
      workspaceId: workspace.id,
    },
  });

  if (!form) notFound();
  const config = isObjectRecord(form.configJson) ? form.configJson : {};
  const autoReplyRaw = isObjectRecord(config.autoReply) ? config.autoReply : {};
  const postSubmitActionRaw = isObjectRecord(config.postSubmitAction) ? config.postSubmitAction : {};

  const autoReplyModeValue = getString(autoReplyRaw.mode, "EMAIL_TEXT");
  const autoReplyMode = AUTO_REPLY_MODE_VALUES.includes(autoReplyModeValue as AutoReplyMode)
    ? (autoReplyModeValue as AutoReplyMode)
    : "EMAIL_TEXT";

  const postSubmitActionTypeValue = getString(postSubmitActionRaw.type, "NONE");
  const postSubmitActionType = POST_SUBMIT_ACTION_VALUES.includes(postSubmitActionTypeValue as PostSubmitActionType)
    ? (postSubmitActionTypeValue as PostSubmitActionType)
    : "NONE";

  const autoReplyEnabled = autoReplyRaw.enabled === true;
  const autoReplySubject = getString(autoReplyRaw.subject);
  const autoReplyBody = getString(autoReplyRaw.body);
  const autoReplyLinkUrl = getString(autoReplyRaw.linkUrl);
  const autoReplyAttachmentUrl = getString(autoReplyRaw.attachmentUrl);
  const postSubmitDelaySeconds = Math.max(0, Math.floor(getNumber(postSubmitActionRaw.delaySeconds, 3)));
  const postSubmitUrl = getString(postSubmitActionRaw.url);

  return (
    <div className="space-y-10">
      <PageHeader title="Editar formulario" description="Actualizá los datos básicos del formulario." />

      <form action={updateServiceLeadForm} className="fo-card space-y-6 max-w-2xl">
        <input type="hidden" name="formId" value={form.id} />

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="service-form-name">
            Nombre
          </label>
          <input id="service-form-name" name="name" className="fo-input" defaultValue={form.name} required />
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="service-form-slug">
            Slug
          </label>
          <input
            id="service-form-slug"
            name="slug"
            className="fo-input"
            defaultValue={form.slug}
            pattern="[a-z0-9-]+"
            required
          />
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="service-form-event-type">
            Tipo de evento
          </label>
          <input
            id="service-form-event-type"
            name="eventType"
            className="fo-input"
            defaultValue={form.eventType}
            required
          />
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="service-form-mode">
            Modo
          </label>
          <select id="service-form-mode" name="formMode" className="fo-input" defaultValue={form.formMode} required>
            <option value="SPECIFIC">SPECIFIC</option>
            <option value="GENERAL">GENERAL</option>
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--fo-text)]">
            <input type="checkbox" name="isActive" className="h-4 w-4" defaultChecked={form.isActive} />
            Activo
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--fo-text)]">
            <input type="checkbox" name="isDefault" className="h-4 w-4" defaultChecked={form.isDefault} />
            Por defecto
          </label>
        </div>

        <section className="space-y-4 border-t border-[var(--fo-border)] pt-6">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Respuesta automática por email</h2>

          <label className="inline-flex items-center gap-2 text-sm text-[var(--fo-text)]">
            <input type="checkbox" name="autoReplyEnabled" className="h-4 w-4" defaultChecked={autoReplyEnabled} />
            Activar respuesta automática
          </label>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-auto-reply-mode">
              Modo
            </label>
            <select
              id="service-form-auto-reply-mode"
              name="autoReplyMode"
              className="fo-input"
              defaultValue={autoReplyMode}
              required
            >
              <option value="EMAIL_TEXT">EMAIL_TEXT</option>
              <option value="EMAIL_WITH_LINK">EMAIL_WITH_LINK</option>
              <option value="EMAIL_WITH_ATTACHMENT">EMAIL_WITH_ATTACHMENT</option>
            </select>
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-auto-reply-subject">
              Asunto
            </label>
            <input
              id="service-form-auto-reply-subject"
              name="autoReplySubject"
              className="fo-input"
              defaultValue={autoReplySubject}
            />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-auto-reply-body">
              Cuerpo del mensaje
            </label>
            <textarea
              id="service-form-auto-reply-body"
              name="autoReplyBody"
              className="fo-input min-h-32 resize-y"
              defaultValue={autoReplyBody}
            />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-auto-reply-link-url">
              Link informativo
            </label>
            <input
              id="service-form-auto-reply-link-url"
              name="autoReplyLinkUrl"
              className="fo-input"
              defaultValue={autoReplyLinkUrl}
            />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-auto-reply-attachment-url">
              URL de adjunto PDF
            </label>
            <input
              id="service-form-auto-reply-attachment-url"
              name="autoReplyAttachmentUrl"
              className="fo-input"
              defaultValue={autoReplyAttachmentUrl}
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-[var(--fo-border)] pt-6">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Acción después de enviar</h2>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-post-submit-action-type">
              Acción
            </label>
            <select
              id="service-form-post-submit-action-type"
              name="postSubmitActionType"
              className="fo-input"
              defaultValue={postSubmitActionType}
              required
            >
              <option value="NONE">NONE</option>
              <option value="WHATSAPP">WHATSAPP</option>
              <option value="URL">URL</option>
            </select>
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-post-submit-delay-seconds">
              Segundos de espera
            </label>
            <input
              id="service-form-post-submit-delay-seconds"
              name="postSubmitDelaySeconds"
              type="number"
              min={0}
              className="fo-input"
              defaultValue={postSubmitDelaySeconds}
            />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-post-submit-url">
              URL destino
            </label>
            <input
              id="service-form-post-submit-url"
              name="postSubmitUrl"
              className="fo-input"
              defaultValue={postSubmitUrl}
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="fo-btn fo-btn-primary">
            Guardar cambios
          </button>
          <Link href="/dashboard/service-leads/forms" className="fo-btn fo-btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
