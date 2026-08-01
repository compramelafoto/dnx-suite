import {
  EmailButton,
  EmailDivider,
  EmailHeading,
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

type Data = CommunicationTemplatePayloadMap["user.welcome"];

function buildContent(input: TemplateRenderContext<Data>): string {
  const { data, brand, copy, allowHttp } = input;
  const parts = [
    EmailHeading(copy.userWelcome.heading, brand),
    EmailParagraph(copy.userWelcome.greeting(data.recipientName), brand),
    EmailParagraph(copy.userWelcome.intro(data.platformName), brand),
  ];

  if (data.loginUrl) {
    parts.push(
      EmailButton(copy.userWelcome.defaultCta, data.loginUrl, brand, { allowHttp }),
    );
  }

  if (data.supportUrl) {
    parts.push(
      EmailParagraph(`${copy.common.supportLabel}:`, brand, { muted: true }),
      EmailButton(copy.userWelcome.supportCta, data.supportUrl, brand, { allowHttp }),
    );
  }

  parts.push(EmailDivider(brand));
  return parts.join("\n");
}

export const userWelcomeTemplate: CommunicationTemplateDefinition<"user.welcome"> = {
  id: "user.welcome",
  channel: "email",

  validate(data) {
    const record = asRecord(data);
    if (!record) {
      return { ok: false, errors: ["El payload debe ser un objeto."] };
    }
    const errors: string[] = [];
    const recipientName = requireStringField(record, "recipientName", errors);
    const platformName = requireStringField(record, "platformName", errors);
    const loginUrl = optionalStringField(record, "loginUrl", errors);
    const supportUrl = optionalStringField(record, "supportUrl", errors);

    if (errors.length > 0 || !recipientName || !platformName) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      data: {
        recipientName,
        platformName,
        ...(loginUrl ? { loginUrl } : {}),
        ...(supportUrl ? { supportUrl } : {}),
      },
    };
  },

  renderSubject(input) {
    return input.copy.userWelcome.subject(input.data.platformName);
  },

  renderPreheader(input) {
    return input.copy.userWelcome.subject(input.data.platformName);
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
      copy.userWelcome.heading,
      "",
      copy.userWelcome.greeting(data.recipientName),
      "",
      copy.userWelcome.intro(data.platformName),
    ];
    if (data.loginUrl) {
      lines.push("", `${copy.userWelcome.defaultCta}: ${data.loginUrl}`);
    }
    if (data.supportUrl) {
      lines.push("", `${copy.userWelcome.supportCta}: ${data.supportUrl}`);
    }
    lines.push("", brand.footerText ?? brand.displayName, copy.common.transactionalNotice);
    return toPlainText(lines.join("\n"));
  },
};
