import { C, FUENTE, escapeHtml } from "@/lib/communications/html";

/**
 * Correos de la Comisión directiva. Funciones PURAS (sin red ni base).
 * Los lee gente que no es técnica: nada de vocabulario interno.
 */

const fechaAr = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function lista(items: string[]): string {
  return items.join(", ");
}

function layout(institution: string, paragraphs: string[], cta: { label: string; url: string }): string {
  const ps = paragraphs
    .map(
      (p) =>
        `<p class="cuerpo" style="margin:0 0 14px;font-size:15px;line-height:1.62;color:${C.cuerpo};">${p}</p>`,
    )
    .join("\n    ");
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  @media (prefers-color-scheme:dark){
    .lienzo{background:#0b1220!important}
    .tarjeta{background:#111c2e!important;border-color:#24344d!important}
    .cuerpo{color:#c3cede!important}
    .apagado{color:#8b9bb4!important}
  }
</style></head>
<body class="lienzo" style="margin:0;padding:0;background:${C.lienzo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lienzo" style="background:${C.lienzo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tarjeta"
  style="width:100%;max-width:600px;background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;overflow:hidden;font-family:${FUENTE};">
  <tr><td style="padding:16px 30px;background:${C.acentoSuave};font-size:12px;font-weight:700;letter-spacing:1.6px;color:${C.acentoFuerte};">${escapeHtml(institution)}</td></tr>
  <tr><td style="padding:26px 30px 8px;">
    ${ps}
  </td></tr>
  <tr><td style="padding:8px 30px 24px;">
    <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${C.acento};color:#ffffff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;text-decoration:none;">${escapeHtml(cta.label)}</a>
    <p class="apagado" style="margin:12px 0 0;font-size:12px;color:${C.tenue};">Si el botón no funciona, copiá esta dirección:<br>${escapeHtml(cta.url)}</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export function buildAddedToCommissionEmail(input: {
  institution: string;
  personName: string;
  officeName: string | null;
  roleNames: string[];
  hasAccount: boolean;
  panelUrl: string;
  endsAt: Date | null;
}): { subject: string; html: string; text: string } {
  const subject = `${input.institution}: ahora formás parte de la Comisión directiva`;

  const plain: string[] = [`Hola ${input.personName},`];
  const rich: string[] = [`Hola ${escapeHtml(input.personName)},`];

  plain.push(`${input.institution} te sumó a su Comisión directiva.`);
  rich.push(`${escapeHtml(input.institution)} te sumó a su Comisión directiva.`);

  if (input.officeName) {
    plain.push(`Tu cargo: ${input.officeName}.`);
    rich.push(`Tu cargo: <strong>${escapeHtml(input.officeName)}</strong>.`);
  }
  if (input.roleNames.length > 0) {
    plain.push(`Podés trabajar en: ${lista(input.roleNames)}.`);
    rich.push(`Podés trabajar en: <strong>${escapeHtml(lista(input.roleNames))}</strong>.`);
  }
  if (input.endsAt) {
    const f = fechaAr.format(input.endsAt);
    plain.push(`Tu mandato va hasta el ${f}.`);
    rich.push(`Tu mandato va hasta el ${f}.`);
  }
  const acceso = input.hasAccount
    ? "Ya podés entrar al panel con tu cuenta."
    : "Vas a entrar al panel cuando actives tu cuenta.";
  plain.push(acceso);
  rich.push(acceso);

  const text = [...plain.flatMap((p) => [p, ""]), "Ir al panel:", input.panelUrl].join("\n");
  return { subject, html: layout(input.institution, rich, { label: "Ir al panel", url: input.panelUrl }), text };
}

export function buildMemberInactiveWithRoleEmail(input: {
  institution: string;
  personName: string;
  newStatus: "SUSPENDED" | "INACTIVE";
  officeNames: string[];
  roleNames: string[];
  commissionUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `${input.institution}: una persona de la Comisión directiva cambió de estado`;
  // Sin género: se habla de la ficha, no de "la socia" ni "el socio".
  const estado = input.newStatus === "SUSPENDED" ? "quedó suspendida" : "se dio de baja";

  const plain: string[] = [
    `La ficha de ${input.personName} ${estado} en ${input.institution}, pero la persona todavía tiene responsabilidades en la Comisión directiva.`,
  ];
  const rich: string[] = [
    `La ficha de <strong>${escapeHtml(input.personName)}</strong> ${estado} en ${escapeHtml(input.institution)}, pero la persona todavía tiene responsabilidades en la Comisión directiva.`,
  ];
  if (input.officeNames.length > 0) {
    plain.push(`Cargos: ${lista(input.officeNames)}.`);
    rich.push(`Cargos: ${escapeHtml(lista(input.officeNames))}.`);
  }
  if (input.roleNames.length > 0) {
    plain.push(`Roles: ${lista(input.roleNames)}.`);
    rich.push(`Roles: ${escapeHtml(lista(input.roleNames))}.`);
  }
  const cierre = "Revisá si corresponde quitarle el cargo o los roles.";
  plain.push(cierre);
  rich.push(cierre);

  const text = [...plain.flatMap((p) => [p, ""]), "Ver la Comisión directiva:", input.commissionUrl].join("\n");
  return {
    subject,
    html: layout(input.institution, rich, { label: "Ver la Comisión directiva", url: input.commissionUrl }),
    text,
  };
}
