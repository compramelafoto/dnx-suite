import type { CommunicationBrand } from "../branding/types";
import type { LocaleBundle } from "../locales/types";
import { escapeHtml } from "../security/escape";
import { EmailFooter } from "./footer";
import { EmailHeader } from "./header";
import { EmailPreheader } from "./preheader";

export type EmailLayoutInput = {
  brand: CommunicationBrand;
  localeCopy: LocaleBundle["common"];
  preheader: string;
  /** HTML interno ya compuesto con componentes seguros. */
  contentHtml: string;
  title: string;
  allowHttp?: boolean;
};

/**
 * Layout table-based ~600px, estilos inline.
 * Extensión futura: transformar links del contentHtml para tracking
 * (sin píxel ni query params en etapa 02).
 */
export function EmailLayout(input: EmailLayoutInput): string {
  const { brand, localeCopy, preheader, contentHtml, title, allowHttp } = input;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.backgroundColor};">
${EmailPreheader(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brand.backgroundColor};margin:0;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${brand.surfaceColor};border:1px solid ${brand.borderColor};border-radius:8px;">
        <tr>
          <td style="padding:28px 28px 32px 28px;">
            ${EmailHeader(brand)}
            ${contentHtml}
            ${EmailFooter(brand, localeCopy, { allowHttp })}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
