/**
 * La cara de los correos de FotoRank.
 *
 * Hasta el 2026-09-25 todos salían como texto técnico crudo: "Evento:
 * JUDGE_SIGNUP_VERIFY_EMAIL" y debajo cada dato con su nombre de variable
 * ("verifyUrl: https://…"). Un jurado invitado, un fotógrafo que se inscribía o
 * alguien que perdía su contraseña recibía eso.
 *
 * Acá vive, para cada tipo de correo, qué dice —saludo, párrafos, un botón— y
 * el marco común con el logo. Es puro: recibe los datos y devuelve asunto, HTML
 * y texto plano, así que se puede probar sin mandar nada.
 */

import type { TransactionalEmailKind } from "./outbox";

type Datos = Record<string, unknown>;

type Contenido = {
  asunto: string;
  /** Una línea corta arriba del título, en dorado. */
  antetitulo: string;
  titulo: string;
  parrafos: string[];
  boton?: { texto: string; url: string };
  /** Letra chica al final: vencimientos, "si no fuiste vos", etc. */
  nota?: string;
};

export type CorreoCompuesto = { asunto: string; html: string; texto: string };

const DORADO = "#d4af37";

export function direccionPublicaDeFotorank(): string {
  const url =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    "https://fotorank.com";
  return url.replace(/\/+$/, "");
}

function t(d: Datos, clave: string): string {
  const v = d[clave];
  return v == null ? "" : String(v).trim();
}

function saludo(d: Datos): string {
  const nombre = t(d, "firstName");
  return nombre ? `Hola, ${nombre}:` : "Hola:";
}

/** El texto de cada correo. Si falta un tipo, TypeScript avisa. */
function contenido(kind: TransactionalEmailKind, d: Datos, base: string): Contenido {
  const concurso = t(d, "contestTitle");
  switch (kind) {
    case "REGISTRATION_CONFIRMED":
      return {
        asunto: `Inscripción confirmada — ${concurso}`,
        antetitulo: "Inscripción",
        titulo: "Ya estás inscripto",
        parrafos: [
          `Tu inscripción a <b>${concurso}</b> quedó confirmada con el número <b>${t(d, "registrationNumber")}</b>.`,
          "Desde tu cuenta podés subir tus fotografías mientras la recepción esté abierta.",
        ],
        boton: { texto: "Ver mis participaciones", url: `${base}/participaciones` },
      };
    case "PHOTO_RECEIVED":
      return {
        asunto: `Recibimos tu fotografía — ${concurso}`,
        antetitulo: "Fotografía recibida",
        titulo: "Tu foto llegó bien",
        parrafos: [
          `Recibimos tu fotografía para <b>${concurso}</b>${t(d, "entryNumber") ? ` (obra n.º ${t(d, "entryNumber")})` : ""}.`,
          "El jurado la va a ver sin tu nombre: la evaluación es anónima.",
        ],
        boton: { texto: "Ver mis participaciones", url: `${base}/participaciones` },
      };
    case "ENTRY_CONFIRMED":
      return {
        asunto: `Obra confirmada — ${concurso}`,
        antetitulo: "Obra confirmada",
        titulo: "Tu obra quedó confirmada",
        parrafos: [
          `Tu obra para <b>${concurso}</b> quedó confirmada con el código <b>${t(d, "anonymousCode")}</b>.`,
        ],
        boton: { texto: "Ver mis participaciones", url: `${base}/participaciones` },
      };
    case "REPLACEMENT_REQUESTED":
      return {
        asunto: `Te pedimos reemplazar una fotografía — ${concurso}`,
        antetitulo: "Reemplazo solicitado",
        titulo: "Hace falta reemplazar una foto",
        parrafos: [
          `La organización de <b>${concurso}</b> te pide reemplazar una de tus fotografías.`,
          t(d, "reason") ? `Motivo: ${t(d, "reason")}` : "",
        ].filter(Boolean),
        boton: { texto: "Ir a mis participaciones", url: `${base}/participaciones` },
      };
    case "JURY_INVITATION":
      return {
        asunto: `Te invitan a ser jurado de ${concurso}`,
        antetitulo: "Invitación a jurado",
        titulo: `Te invitan a ser jurado de ${concurso}`,
        parrafos: [
          saludo(d),
          `<b>${t(d, "organizationName") || "La organización del concurso"}</b> te invita a integrar el jurado de <b>${concurso}</b>${t(d, "categorias") ? `, en ${t(d, "categorias")}` : ""}.`,
          t(d, "mensaje") ? `<i>“${t(d, "mensaje")}”</i>` : "",
          "Para aceptar o rechazar, entrá a tu cuenta de FotoRank. Una vez que aceptes, vas a encontrar las obras en <b>Jurado → Concursos a calificar</b>.",
        ].filter(Boolean),
        boton: {
          texto: "Ver la invitación",
          url: t(d, "inviteUrl") || `${base}/jurado/invitaciones`,
        },
        nota: t(d, "vence")
          ? `La invitación vence el ${t(d, "vence")}.`
          : "Si no esperabas esta invitación, podés ignorar este correo.",
      };
    case "JURY_INVITE_REMINDER":
      return {
        asunto: `Recordatorio: te invitaron a ser jurado de ${concurso}`,
        antetitulo: "Recordatorio",
        titulo: "Tu invitación sigue esperando",
        parrafos: [
          saludo(d),
          `Todavía no respondiste la invitación para ser jurado de <b>${concurso}</b>.`,
        ],
        boton: { texto: "Ver la invitación", url: `${base}/jurado/invitaciones` },
      };
    case "JURY_INVITATION_ANSWERED": {
      const acepto = t(d, "respuesta") === "aceptada";
      return {
        asunto: `${t(d, "nombre")} ${acepto ? "aceptó" : "rechazó"} ser jurado de ${concurso}`,
        antetitulo: "Respuesta de un jurado",
        titulo: acepto ? "Un jurado aceptó tu invitación" : "Un jurado rechazó tu invitación",
        parrafos: [
          `<b>${t(d, "nombre")}</b> ${acepto ? "aceptó" : "rechazó"} la invitación para ser jurado de <b>${concurso}</b>.`,
          acepto
            ? "Ya figura en Mis jurados y tiene asignadas las categorías que elegiste."
            : "Podés buscar otro jurado en el directorio.",
        ],
        boton: acepto
          ? { texto: "Ver mis jurados", url: `${base}/jurados` }
          : { texto: "Buscar jurados", url: `${base}/jurados/directorio` },
      };
    }
    case "JURY_RECRUIT_INVITATION":
      return {
        asunto: "Te invitamos a sumarte como jurado de FotoRank",
        antetitulo: "Convocatoria a jurados",
        titulo: "Queremos contar con tu mirada",
        parrafos: [
          saludo(d),
          `<b>${t(d, "invitador")}</b>${t(d, "organizationName") && t(d, "organizationName") !== t(d, "invitador") ? ` (${t(d, "organizationName")})` : ""} te invita a sumarte al equipo de jurados de FotoRank, la plataforma de concursos de fotografía con jurado.`,
          t(d, "mensaje") ? `<i>“${t(d, "mensaje")}”</i>` : "",
          "Postularte lleva unos minutos: contás tu trayectoria, subís algunas fotos y confirmás tu correo. FotoRank revisa la ficha y, una vez aprobada, aparecés en la galería de jurados y los organizadores te pueden invitar a sus concursos.",
        ].filter(Boolean),
        boton: { texto: "Postularme como jurado", url: t(d, "postulacionUrl") || `${base}/jurados/postulacion` },
        nota: `Podés conocer a los jurados actuales en ${base.replace(/^https?:\/\//, "")}/jurados/galeria. Si no te interesa, podés ignorar este correo.`,
      };
    case "JURY_SCORING_OPEN":
      return {
        asunto: `Ya podés calificar — ${concurso}`,
        antetitulo: "Evaluación abierta",
        titulo: "Las obras te esperan",
        parrafos: [saludo(d), `Se abrió la evaluación de <b>${concurso}</b>.`],
        boton: { texto: "Calificar obras", url: `${base}/jurado/panel` },
      };
    case "JURY_SCORING_CLOSING_SOON":
      return {
        asunto: `Cierra pronto la evaluación — ${concurso}`,
        antetitulo: "Cierre próximo",
        titulo: "La evaluación está por cerrar",
        parrafos: [saludo(d), `La evaluación de <b>${concurso}</b> cierra pronto.`],
        boton: { texto: "Terminar de calificar", url: `${base}/jurado/panel` },
      };
    case "JURY_ASSIGNMENT_NEW":
      return {
        asunto: `Tenés obras nuevas para calificar — ${concurso}`,
        antetitulo: "Nueva asignación",
        titulo: "Te asignaron obras",
        parrafos: [saludo(d), `Te asignaron obras para calificar en <b>${concurso}</b>.`],
        boton: { texto: "Ver mis concursos", url: `${base}/jurado/panel` },
      };
    case "JURY_SESSION_CLOSED":
      return {
        asunto: `Cerró la evaluación — ${concurso}`,
        antetitulo: "Evaluación cerrada",
        titulo: "Gracias por tu trabajo",
        parrafos: [saludo(d), `Cerró la evaluación de <b>${concurso}</b>. Gracias por tu mirada.`],
      };
    case "JUDGE_SIGNUP_VERIFY_EMAIL":
      if (d.avisoDeCuentaExistente) {
        return {
          asunto: "Ya tenés una ficha de jurado en FotoRank",
          antetitulo: "Postulación",
          titulo: "Ya tenías una ficha",
          parrafos: [
            saludo(d),
            "Recibimos una postulación como jurado con este correo, pero ya tenés una ficha en FotoRank. Entrá con tu contraseña para verla o completarla.",
          ],
          boton: { texto: "Entrar a FotoRank", url: t(d, "verifyUrl") || `${base}/jurado/login` },
          nota: "Si no fuiste vos, podés ignorar este correo.",
        };
      }
      return {
        asunto: "Confirmá tu correo para completar tu ficha de jurado",
        antetitulo: "Postulación",
        titulo: "Confirmá tu correo",
        parrafos: [
          saludo(d),
          "Gracias por postularte como jurado de FotoRank. Confirmá tu correo para que tu ficha pase a revisión.",
          "Una vez aprobada, vas a aparecer en la galería de jurados y los organizadores te van a poder invitar a sus concursos.",
        ],
        boton: { texto: "Confirmar mi correo", url: t(d, "verifyUrl") },
        nota: "Si no te postulaste, podés ignorar este correo.",
      };
    case "JUDGE_DIRECTORY_REVIEWED":
      if (t(d, "resultado") === "aprobada") {
        return {
          asunto: "Tu ficha de jurado fue aprobada",
          antetitulo: "Ficha aprobada",
          titulo: "Ya sos jurado de FotoRank",
          parrafos: [
            saludo(d),
            "Revisamos tu ficha y la aprobamos. Desde ahora aparecés en la galería de jurados y en el directorio que usan los organizadores.",
            "Cuando alguien te invite a un concurso, te va a llegar un correo y lo vas a ver en <b>Jurado → Invitaciones recibidas</b>.",
          ],
          boton: t(d, "publicSlug")
            ? { texto: "Ver mi perfil público", url: `${base}/jurados/publico/${t(d, "publicSlug")}` }
            : { texto: "Entrar a FotoRank", url: `${base}/jurado/panel` },
        };
      }
      return {
        asunto: "Novedades sobre tu ficha de jurado",
        antetitulo: "Revisión de ficha",
        titulo: "Tu ficha todavía no fue aprobada",
        parrafos: [
          saludo(d),
          "Revisamos tu ficha de jurado y por ahora no la aprobamos.",
          t(d, "motivo") ? `Motivo: ${t(d, "motivo")}` : "",
          "Podés corregirla desde tu cuenta y volver a enviarla.",
        ].filter(Boolean),
        boton: { texto: "Revisar mi ficha", url: `${base}/jurado/perfil` },
      };
    case "JUDGE_SIGNUP_PENDING_REVIEW":
      return {
        asunto: `Una ficha de jurado espera revisión — ${t(d, "nombre")}`,
        antetitulo: "Super administración",
        titulo: "Hay una ficha para revisar",
        parrafos: [
          `<b>${t(d, "nombre")}</b> se postuló como jurado y ya confirmó su correo. Su ficha espera tu revisión.`,
        ],
        boton: { texto: "Ir a Jurados por revisar", url: t(d, "colaUrl") || `${base}/super-admin/jurados` },
      };
    case "JUDGE_PASSWORD_RESET":
      return {
        asunto: "Cambiá tu contraseña de jurado en FotoRank",
        antetitulo: "Contraseña",
        titulo: "Elegí una contraseña nueva",
        parrafos: [saludo(d), "Pediste cambiar la contraseña de tu cuenta de jurado."],
        boton: { texto: "Cambiar contraseña", url: t(d, "resetUrl") },
        nota: `El enlace vence en ${t(d, "horas") || "unas"} horas. Si no lo pediste, ignorá este correo: tu contraseña sigue igual.`,
      };
  }
}

/** Escapa lo que viene de los datos. Los textos fijos de arriba traen su propio marcado. */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapa los datos antes de que entren a las plantillas. */
function datosSeguros(d: Datos): Datos {
  const out: Datos = {};
  for (const [k, v] of Object.entries(d)) {
    out[k] = typeof v === "string" ? escapar(v) : v;
  }
  return out;
}

function sinMarcado(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function componerCorreo(
  kind: TransactionalEmailKind,
  datos: Datos,
  base: string = direccionPublicaDeFotorank(),
): CorreoCompuesto {
  const c = contenido(kind, datosSeguros(datos), base);
  const logo = `${base}/fotorank-email-logo.png`;

  const parrafos = c.parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2b2b;">${p}</p>`,
    )
    .join("");

  const boton = c.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="border-radius:999px;background:${DORADO};">` +
      `<a href="${c.boton.url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#111111;text-decoration:none;border-radius:999px;">${c.boton.texto}</a>` +
      `</td></tr></table>` +
      `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;">Si el botón no funciona, copiá este enlace en el navegador:<br><a href="${c.boton.url}" style="color:#8a6d1c;word-break:break-all;">${c.boton.url}</a></p>`
    : "";

  const nota = c.nota
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eeeae0;font-size:13px;line-height:1.5;color:#8a8a8a;">${c.nota}</p>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.asunto}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${sinMarcado(c.parrafos[0] ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td align="center" style="background:#0b0b0b;padding:28px 24px 22px;">
<a href="${base}" style="text-decoration:none;"><img src="${logo}" width="240" alt="FotoRank" style="display:block;width:240px;max-width:100%;height:auto;border:0;"></a>
</td></tr>
<tr><td style="height:3px;background:${DORADO};line-height:3px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:36px 36px 32px;">
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a8841f;">${c.antetitulo}</p>
<h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;color:#111111;">${c.titulo}</h1>
${parrafos}${boton}${nota}
</td></tr>
<tr><td style="background:#faf8f3;padding:22px 36px;border-top:1px solid #eeeae0;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8a;"><b style="color:#2b2b2b;">FotoRank</b> · Concursos de fotografía con jurado<br><a href="${base}" style="color:#8a6d1c;text-decoration:none;">${base.replace(/^https?:\/\//, "")}</a> · <a href="${base}/jurados/galeria" style="color:#8a6d1c;text-decoration:none;">Jurados</a></p>
<p style="margin:10px 0 0;font-size:11px;line-height:1.5;color:#a8a8a8;">Recibiste este correo por tu actividad en FotoRank. Es un aviso automático: no hace falta responderlo.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const texto = [
    sinMarcado(c.titulo),
    "",
    ...c.parrafos.map(sinMarcado),
    ...(c.boton ? ["", `${c.boton.texto}: ${c.boton.url}`] : []),
    ...(c.nota ? ["", sinMarcado(c.nota)] : []),
    "",
    "— FotoRank · Concursos de fotografía con jurado",
    base,
  ].join("\n");

  return { asunto: sinMarcado(c.asunto), html, texto };
}
