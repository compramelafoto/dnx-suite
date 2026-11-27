import { Resend } from "resend";

export type PortalEmailTemplate =
  | "verificacion_aprobada"
  | "verificacion_rechazada"
  | "verificacion_en_revision_admin"
  | "denuncia_recibida"
  | "coincidencia_inventario_admin"
  | "conflicto_serie_admin"
  | "recordatorio_poliza"
  | "publicacion_en_revision_admin"
  | "serie_de_otro_usuario_admin"
  | "publicacion_aprobada"
  | "publicacion_rechazada"
  | "reporte_publicacion_admin"
  | "nueva_consulta"
  | "consulta_serie_coincide_admin"
  | "cambio_serie_admin"
  | "confirmar_compra"
  | "venta_confirmada"
  | "venta_no_confirmada"
  | "alerta_busqueda"
  | "pedido_dueno"
  | "pedido_publicado"
  | "reporte_usuario_admin"
  | "cuenta_bloqueada";

type Rendered = { subject: string; html: string; text: string };

/** Un párrafo: texto plano, o texto con un enlace (en HTML el enlace va sobre `enlace.texto`). */
type Linea = string | { antes: string; enlace: { texto: string; href: string }; despues: string; plano: string };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Plantillas en español. Función pura: el asunto de los correos al admin nunca lleva
 * datos personales (los datos van sólo en el cuerpo).
 */
export function renderPortalEmail(
  template: PortalEmailTemplate,
  data: Record<string, string>,
): Rendered {
  const d = (k: string, fallback = ""): string => data[k]?.trim() || fallback;
  const nombre = d("nombre");
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const url = d("url");

  let subject: string;
  let lineas: Linea[];

  switch (template) {
    case "verificacion_aprobada":
      subject = "Tu identidad quedó verificada";
      lineas = [
        saludo,
        "Verificamos tu identidad. Ya podés usar todas las funciones del portal MercadoFotoRaw.",
      ];
      break;
    case "verificacion_rechazada":
      subject = "No pudimos verificar tu identidad";
      lineas = [
        saludo,
        "No pudimos completar la verificación de tu identidad.",
        d("motivo") ? `Motivo: ${d("motivo")}` : "Podés volver a intentarlo desde el portal.",
      ];
      break;
    case "verificacion_en_revision_admin":
      subject = "Verificación de identidad pendiente de revisión";
      lineas = [
        "Hay una verificación de identidad que necesita revisión manual.",
        d("nombre") ? `Usuario: ${d("nombre")}` : "",
        d("email") ? `Correo: ${d("email")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "denuncia_recibida":
      subject = "Recibimos tu denuncia";
      lineas = [
        saludo,
        "Recibimos tu denuncia y la vamos a revisar. Te avisamos por este medio cuando tengamos novedades.",
        d("referencia") ? `Referencia: ${d("referencia")}` : "",
      ];
      break;
    case "coincidencia_inventario_admin":
      subject = "Coincidencia con un equipo denunciado";
      lineas = [
        "Un equipo cargado en el portal coincide con una denuncia existente.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "conflicto_serie_admin":
      subject = "Conflicto de número de serie";
      lineas = [
        "Dos usuarios cargaron el mismo número de serie y hace falta resolverlo.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "publicacion_en_revision_admin":
      subject = "Publicación en revisión";
      lineas = [
        "Hay una publicación de un equipo que necesita revisión manual antes de salir.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "serie_de_otro_usuario_admin":
      subject = "Serie publicada vista con otro usuario";
      lineas = [
        "Se publicó un equipo cuya serie ya apareció en fotos de otro usuario.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "publicacion_aprobada":
      subject = "Tu publicación ya está online";
      lineas = [
        saludo,
        "Revisamos tu publicación y ya está visible en el portal.",
        url ? `Verla: ${url}` : "",
      ];
      break;
    case "publicacion_rechazada":
      subject = "No pudimos publicar tu artículo";
      // Sin correo de contacto configurado, se omite la invitación (el remitente no recibe respuestas).
      lineas = [
        saludo,
        "No pudimos publicar tu artículo.",
        d("contacto") && d("contactoUrl")
          ? {
              antes: "Si tenés dudas, ",
              enlace: { texto: "escribinos", href: d("contactoUrl") },
              despues: ".",
              plano: `Si tenés dudas, escribinos a ${d("contacto")}.`,
            }
          : "",
      ];
      break;
    case "reporte_publicacion_admin":
      subject = "Publicación reportada";
      lineas = [
        "Alguien reportó una publicación del portal.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "nueva_consulta":
      subject = `Alguien quiere tu ${d("equipo", "equipo")}`;
      lineas = [
        saludo,
        `${d("comprador", "Una persona")} se interesó en tu ${d("equipo", "equipo")}.`,
        "Su identidad está verificada en MercadoFotoRaw. Igual seguí la guía de compra segura.",
        d("calificacion") ? `Calificación como comprador: ${d("calificacion")}` : "",
        url ? `Ver tus interesados: ${url}` : "",
      ];
      break;
    case "consulta_serie_coincide_admin":
      subject = "Consulta de serie con denuncia activa";
      lineas = [
        "Un usuario verificado consultó un número de serie que tiene una denuncia activa.",
        d("usuario") ? `Usuario: ${d("usuario")}` : "",
        d("serie") ? `Serie: ${d("serie")}` : "",
        d("denuncia") ? `Denuncia: #${d("denuncia")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "cambio_serie_admin":
      subject = "Cambio de serie en un equipo con antecedentes";
      lineas = [
        "Cambió el número de serie de un equipo que tuvo una publicación retenida por una denuncia.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "confirmar_compra":
      subject = `${d("vendedor", "El vendedor")} marcó que te vendió su ${d("equipo", "equipo")}`;
      lineas = [
        saludo,
        `${d("vendedor", "El vendedor")} marcó que te vendió su ${d("equipo", "equipo")}${d("precio") ? ` por ${d("precio")}` : ""}.`,
        d("vence")
          ? `Confirmá la compra para que el equipo pase a tu inventario. Si no la confirmás hasta el ${d("vence")}, la venta se anula y el equipo vuelve a quien lo vendía.`
          : "Confirmá la compra para que el equipo pase a tu inventario.",
        "Si la compra no se hizo, podés rechazarla desde el mismo enlace.",
        url ? `Confirmar o rechazar: ${url}` : "",
      ];
      break;
    case "venta_confirmada":
      subject = `Venta confirmada: ${d("equipo", "equipo")}`;
      lineas = [
        saludo,
        `Se confirmó la venta de ${d("equipo", "equipo")}${d("precio") ? ` por ${d("precio")}` : ""}.`,
        d("rol") === "comprador"
          ? "El equipo ya está en tu inventario."
          : `El equipo ya pasó al inventario de ${d("otraParte", "quien lo compró")}. Si querés, ahora podés calificar la operación.`,
        url ? `Ver la operación: ${url}` : "",
      ];
      break;
    case "venta_no_confirmada":
      subject = `La venta de ${d("equipo", "equipo")} no se confirmó`;
      lineas = [
        saludo,
        d("motivo") === "vencio"
          ? `${d("comprador", "El comprador")} no confirmó a tiempo la compra de ${d("equipo", "equipo")} y el plazo venció.`
          : `${d("comprador", "El comprador")} rechazó la compra de ${d("equipo", "equipo")}.`,
        "Tu equipo volvió a tu inventario como «En uso». Si querés, podés publicarlo de nuevo.",
        url ? `Ver la operación: ${url}` : "",
      ];
      break;
    case "alerta_busqueda": {
      // Hasta 10 equipos: `itemN_titulo`, `itemN_precio`, `itemN_zona` e `itemN_url` (N desde 1).
      const equipos: Linea[] = [];
      for (let n = 1; n <= 10; n++) {
        const titulo = d(`item${n}_titulo`);
        const href = d(`item${n}_url`);
        if (!titulo || !href) break;
        const resto = [d(`item${n}_precio`), d(`item${n}_zona`)].filter(Boolean).join(", ");
        const despues = resto ? ` — ${resto}` : "";
        equipos.push({
          antes: "",
          enlace: { texto: titulo, href },
          despues,
          plano: `${titulo}${despues}: ${href}`,
        });
      }
      subject =
        equipos.length === 1
          ? "Se publicó un equipo que estás buscando"
          : `Se publicaron ${equipos.length} equipos que estás buscando`;
      lineas = [
        saludo,
        equipos.length === 1
          ? "Se publicó un equipo que coincide con una de tus alertas:"
          : "Se publicaron equipos que coinciden con tus alertas:",
        ...equipos,
        "Todos los vendedores verificaron su identidad. Igual seguí la guía de compra segura.",
        url ? `Administrar tus alertas: ${url}` : "",
      ];
      break;
    }
    case "pedido_dueno": {
      // Al dueño. PRIVACIDAD: nunca el nombre del comprador (lo ve recién al abrir el aviso).
      const equipo = d("equipo", "equipo");
      subject = `Un comprador busca un ${equipo} como el tuyo`;
      lineas = [
        saludo,
        `Un comprador con identidad verificada busca un ${equipo}, como el que tenés en tu inventario.`,
        d("precio") ? `Ofrece hasta ${d("precio")}.` : "",
        d("zona") ? `Lo busca en ${d("zona")}.` : "",
        d("estado") ? `Estado mínimo que acepta: ${d("estado")}.` : "",
        "No le dijimos quién sos ni que tenés este equipo. Si te interesa venderlo, respondé el aviso y te ayudamos a publicarlo.",
        url
          ? {
              antes: "",
              enlace: { texto: "Ver el pedido y responder", href: url },
              despues: "",
              plano: `Ver el pedido y responder: ${url}`,
            }
          : "",
        "Si no querés recibir estos avisos, podés apagarlos desde «Mi cuenta».",
      ];
      break;
    }
    case "pedido_publicado": {
      const equipo = d("equipo", "equipo");
      subject = "Se publicó el equipo que buscabas";
      lineas = [
        saludo,
        `Se publicó un ${equipo}${d("precio") ? ` a ${d("precio")}` : ""}, como el de tu pedido «Busco».`,
        "El vendedor verificó su identidad. Igual seguí la guía de compra segura.",
        url
          ? {
              antes: "",
              enlace: { texto: "Ver la publicación", href: url },
              despues: "",
              plano: `Ver la publicación: ${url}`,
            }
          : "",
      ];
      break;
    }
    case "reporte_usuario_admin":
      subject = "Usuario reportado";
      lineas = [
        "Alguien reportó a otra persona del portal.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "cuenta_bloqueada":
      // Nunca el motivo interno del bloqueo.
      subject = "Tu cuenta de MercadoFotoRaw fue suspendida";
      lineas = [
        saludo,
        "Tu cuenta de MercadoFotoRaw fue suspendida. Si creés que es un error, respondé este correo.",
      ];
      break;
    case "recordatorio_poliza":
      subject = "Tu póliza de seguro está por vencer";
      lineas = [
        saludo,
        "Te recordamos que la póliza de seguro de tus equipos está próxima a vencer.",
        d("fecha") ? `Vence el: ${d("fecha")}` : "",
        url ? `Renovar o actualizar: ${url}` : "",
      ];
      break;
  }

  const partes = lineas.filter((l) => l !== "");
  return {
    subject,
    text: partes.map((l) => (typeof l === "string" ? l : l.plano)).join("\n\n"),
    html: partes
      .map((l) =>
        typeof l === "string"
          ? `<p>${esc(l)}</p>`
          : `<p>${esc(l.antes)}<a href="${esc(l.enlace.href)}">${esc(l.enlace.texto)}</a>${esc(l.despues)}</p>`,
      )
      .join("\n"),
  };
}

let client: Resend | null = null;

export async function sendPortalEmail(
  to: string,
  template: PortalEmailTemplate,
  data: Record<string, string>,
): Promise<{ success: boolean }> {
  const { subject, html, text } = renderPortalEmail(template, data);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[correo] RESEND_API_KEY no configurada; no se envía "${template}".`);
    return { success: false };
  }
  try {
    client ??= new Resend(apiKey);
    const res = await client.emails.send({
      from: process.env.EMAIL_FROM || "noreply@dnxfotografia.com",
      to,
      subject,
      html,
      text,
    });
    if (res.error) {
      console.error("[correo] Resend devolvió error:", res.error);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error("[correo] Error enviando correo:", err);
    return { success: false };
  }
}
