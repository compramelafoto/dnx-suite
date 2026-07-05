/**
 * Renderiza plantilla HTML de campaña con variables y footer unsubscribe
 */

const ESCAPE_HTML_RE = /[&<>"']/g;
const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str: string): string {
  return String(str ?? "").replace(ESCAPE_HTML_RE, (c) => ESCAPE_MAP[c] ?? c);
}

export interface TemplateContext {
  firstName?: string;
  lastName?: string;
  email?: string;
  workspaceName?: string;
  role?: string;
  referralCode?: string;
  unsubscribeUrl?: string;
  [key: string]: string | number | boolean | null | undefined;
}

const DEFAULT_FOOTER = `
<p style="font-size:12px;color:#6b7280;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
  Recibís este email por tu actividad en ComprameLaFoto. <a href="{{unsubscribeUrl}}" style="color:#c27b3d;">Darse de baja</a>.
</p>
`;

export function renderTemplate(html: string, context: TemplateContext): string {
  let result = html;

  // Reemplazar variables escapadas
  for (const [key, value] of Object.entries(context)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    const safe = typeof value === "string" ? escapeHtml(value) : String(value ?? "");
    result = result.replace(placeholder, safe);
  }

  // Insertar footer si no tiene unsubscribeUrl ya
  if (!result.includes("{{unsubscribeUrl}}") && !result.toLowerCase().includes("darse de baja")) {
    result = result + DEFAULT_FOOTER;
  }

  // Último reemplazo de unsubscribeUrl (por si se añadió en footer)
  const unsubscribeUrl = context.unsubscribeUrl || "#";
  result = result.replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);

  return result;
}
