import {
  EmailButton,
  EmailDivider,
  EmailHeading,
  EmailInfoBox,
  EmailLayout,
  EmailParagraph,
} from "../components/index";
import { toPlainText } from "../security/escape";
import {
  asRecord,
  optionalStringField,
  requireStringField,
  type CommunicationTemplateDefinition,
  type CommunicationTemplatePayloadMap,
  type TemplateRenderContext,
} from "./types";

type Data = CommunicationTemplatePayloadMap["system.test"];

function buildMetaLines(data: Data, brandName: string): string[] {
  const lines: string[] = [`Branding: ${brandName}`];
  if (data.environment) lines.push(`Entorno: ${data.environment}`);
  if (data.generatedAt) lines.push(`Generado: ${data.generatedAt}`);
  if (data.testId) lines.push(`Test ID: ${data.testId}`);
  return lines;
}

function buildContent(input: TemplateRenderContext<Data>): string {
  const { data, brand, copy, allowHttp } = input;
  const meta = buildMetaLines(data, brand.displayName).join(" · ");

  const parts = [
    EmailHeading(copy.systemTest.heading, brand),
    EmailParagraph(copy.systemTest.greeting(data.recipientName), brand),
    EmailParagraph(copy.systemTest.intro, brand, { muted: true }),
    EmailInfoBox(data.message, brand),
    EmailParagraph(meta, brand, { muted: true }),
  ];

  if (data.actionUrl) {
    parts.push(
      EmailButton(
        data.actionLabel?.trim() || copy.systemTest.defaultCta,
        data.actionUrl,
        brand,
        { allowHttp },
      ),
    );
  }

  parts.push(EmailDivider(brand));
  return parts.join("\n");
}

export const systemTestTemplate: CommunicationTemplateDefinition<"system.test"> = {
  id: "system.test",
  channel: "email",

  validate(data) {
    const record = asRecord(data);
    if (!record) {
      return { ok: false, errors: ["El payload debe ser un objeto."] };
    }
    const errors: string[] = [];
    const recipientName = requireStringField(record, "recipientName", errors);
    const message = requireStringField(record, "message", errors);
    const actionLabel = optionalStringField(record, "actionLabel", errors);
    const actionUrl = optionalStringField(record, "actionUrl", errors);
    const generatedAt = optionalStringField(record, "generatedAt", errors);
    const testId = optionalStringField(record, "testId", errors);
    const environment = optionalStringField(record, "environment", errors);

    if (errors.length > 0 || !recipientName || !message) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      data: {
        recipientName,
        message,
        ...(actionLabel ? { actionLabel } : {}),
        ...(actionUrl ? { actionUrl } : {}),
        ...(generatedAt ? { generatedAt } : {}),
        ...(testId ? { testId } : {}),
        ...(environment ? { environment } : {}),
      },
    };
  },

  renderSubject(input) {
    return `${input.copy.systemTest.subject} (${input.brand.displayName})`;
  },

  renderPreheader(input) {
    return `${input.copy.systemTest.heading} — ${input.brand.displayName}`;
  },

  renderHtml(input) {
    const subject = this.renderSubject(input);
    return EmailLayout({
      brand: input.brand,
      localeCopy: input.copy.common,
      preheader: this.renderPreheader?.(input) ?? input.copy.common.preheaderFallback,
      contentHtml: buildContent(input),
      title: subject,
      allowHttp: input.allowHttp,
    });
  },

  renderText(input) {
    const { data, brand, copy } = input;
    const lines = [
      copy.systemTest.heading,
      "",
      copy.systemTest.greeting(data.recipientName),
      "",
      copy.systemTest.intro,
      "",
      data.message,
      "",
      ...buildMetaLines(data, brand.displayName),
    ];
    if (data.actionUrl) {
      lines.push(
        "",
        `${data.actionLabel?.trim() || copy.systemTest.defaultCta}: ${data.actionUrl}`,
      );
    }
    lines.push("", brand.footerText ?? brand.displayName, copy.common.transactionalNotice);
    return toPlainText(lines.join("\n"));
  },
};
