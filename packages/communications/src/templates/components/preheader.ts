import { escapeHtml } from "../security/escape";

/** Texto oculto de preheader (inbox preview). */
export function EmailPreheader(text: string): string {
  const safe = escapeHtml(text);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${safe}</div>`;
}
