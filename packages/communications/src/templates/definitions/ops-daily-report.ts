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

type Data = CommunicationTemplatePayloadMap["ops.daily-report"];

function buildContent(input: TemplateRenderContext<Data>): string {
  const { data, brand, copy, allowHttp } = input;

  const parts = [
    EmailHeading(copy.opsDailyReport.heading, brand),
    EmailParagraph(copy.opsDailyReport.intro(data.reportDate), brand),
    EmailHeading(copy.opsDailyReport.alertsTitle, brand),
    EmailInfoBox(data.alertsBlock, brand),
    EmailHeading(copy.opsDailyReport.summaryTitle, brand),
    EmailInfoBox(data.summaryBlock, brand),
  ];

  if (data.failedSectionsNote) {
    parts.push(EmailParagraph(data.failedSectionsNote, brand, { muted: true }));
  }

  if (data.panelUrl) {
    parts.push(EmailButton(copy.opsDailyReport.defaultCta, data.panelUrl, brand, { allowHttp }));
  }

  parts.push(EmailParagraph(copy.opsDailyReport.statusLabel(data.status), brand, { muted: true }));
  parts.push(EmailDivider(brand));

  return parts.join("\n");
}

export const opsDailyReportTemplate: CommunicationTemplateDefinition<"ops.daily-report"> = {
  id: "ops.daily-report",
  channel: "email",

  validate(data) {
    const record = asRecord(data);
    if (!record) {
      return { ok: false, errors: ["El payload debe ser un objeto."] };
    }

    const errors: string[] = [];
    const reportDate = requireStringField(record, "reportDate", errors);
    const status = requireStringField(record, "status", errors);
    const alertsBlock = requireStringField(record, "alertsBlock", errors);
    const summaryBlock = requireStringField(record, "summaryBlock", errors);
    const panelUrl = optionalStringField(record, "panelUrl", errors);
    const failedSectionsNote = optionalStringField(record, "failedSectionsNote", errors);

    const rawCount = record.criticalCount;
    const criticalCount =
      typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount >= 0
        ? Math.trunc(rawCount)
        : undefined;
    if (criticalCount === undefined) {
      errors.push("Campo obligatorio inválido: criticalCount");
    }

    if (
      errors.length > 0 ||
      !reportDate ||
      !status ||
      !alertsBlock ||
      !summaryBlock ||
      criticalCount === undefined
    ) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      data: {
        reportDate,
        status,
        criticalCount,
        alertsBlock,
        summaryBlock,
        ...(panelUrl ? { panelUrl } : {}),
        ...(failedSectionsNote ? { failedSectionsNote } : {}),
      },
    };
  },

  renderSubject(input) {
    const { data, copy } = input;
    return data.criticalCount > 0
      ? copy.opsDailyReport.subjectWithAlerts(data.reportDate, data.criticalCount)
      : copy.opsDailyReport.subject(data.reportDate);
  },

  renderPreheader(input) {
    return `${input.copy.opsDailyReport.heading} — ${input.data.reportDate}`;
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
      copy.opsDailyReport.heading,
      "",
      copy.opsDailyReport.intro(data.reportDate),
      "",
      copy.opsDailyReport.alertsTitle.toUpperCase(),
      data.alertsBlock,
      "",
      copy.opsDailyReport.summaryTitle.toUpperCase(),
      data.summaryBlock,
    ];

    if (data.failedSectionsNote) {
      lines.push("", data.failedSectionsNote);
    }
    if (data.panelUrl) {
      lines.push("", `${copy.opsDailyReport.defaultCta}: ${data.panelUrl}`);
    }

    lines.push(
      "",
      copy.opsDailyReport.statusLabel(data.status),
      "",
      brand.footerText ?? brand.displayName,
      copy.common.transactionalNotice,
    );

    return toPlainText(lines.join("\n"));
  },
};
