import "server-only";
import { prisma } from "@repo/db";
import { SLUG_DNX } from "@/lib/campos/semillas";
import type { Canal, TipoPlantilla } from "./constantes";
import { AUTOMATICOS } from "./definiciones";

export type PlantillaInicial = { canal: Canal; tipo: TipoPlantilla; nombre: string; asunto: string | null; cuerpo: string };
export type AutorespuestaInicial = { asunto: string; cuerpo: string };

/**
 * Plantillas iniciales de DNX Estudio (spec §3.6). Textos nuevos, escritos a partir de lo que decían
 * las de Alboom (no copiados). Sólo usan variables válidas para su ficha, y las que pueden faltar van
 * en bloques `[si:…]`. Lo que está entre corchetes y en MAYÚSCULAS es texto literal para completar a
 * mano antes de enviar (el motor no lo toma como variable).
 */
export const PLANTILLAS_DNX: readonly PlantillaInicial[] = [
  {
    canal: "EMAIL",
    tipo: "CLIENTE",
    nombre: "¡Gracias por elegirnos!",
    asunto: "¡Gracias por elegirnos[si:nombre], [nombre][/si]!",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Muchas gracias por elegirnos! Para nosotros es un gusto enorme acompañarte y contar tu historia con imágenes.

Vamos a cuidar cada detalle para que el resultado esté a la altura de lo que imaginás. Si en algún momento te surge una duda o querés comentarnos algo, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si] y te contestamos enseguida.

[si:organizacion_instagram]Si querés ver nuestros últimos trabajos, seguinos en Instagram: [organizacion_instagram].

[/si]Un abrazo grande.

[firma]`,
  },
  {
    canal: "EMAIL",
    tipo: "CONSULTA",
    nombre: "Ya falta poco para tu evento",
    asunto: "Ya falta poco para tu evento[si:consulta_fecha] del [consulta_fecha][/si]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Ya falta poco! Estamos con muchas ganas de acompañarte[si:consulta_fecha] el [consulta_fecha][/si][si:consulta_lugar] en [consulta_lugar][/si].

Para que todo salga como lo soñaste, te pedimos que repasemos algunos temas importantes:

- Horarios: contanos el cronograma del día (llegada, ceremonia, momentos especiales) así organizamos la cobertura.
- Contacto en el lugar: pasanos el nombre y el teléfono de alguien que esté ese día, por si necesitamos coordinar algo en el momento.
- Fotos que no pueden faltar: si hay personas o momentos que querés sí o sí, avisanos.
- Llegada: si hay alguna indicación para llegar, estacionar o entrar con el equipo, contanos.

Respondé este correo con lo que tengas[si:organizacion_whatsapp] o mandanos un WhatsApp al [organizacion_whatsapp][/si]. Y si algo cambió, avisanos así lo tenemos en cuenta.

¡Nos vemos muy pronto!

[firma]`,
  },
  {
    canal: "EMAIL",
    tipo: "CLIENTE",
    nombre: "Te enviamos tu foto carnet",
    asunto: "Te enviamos tu foto carnet",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Gracias por venir! Tu foto carnet ya está lista. La podés descargar desde este enlace:

[PEGÁ ACÁ EL ENLACE DE DESCARGA]

Si la vas a imprimir, te recomendamos hacerlo en papel fotográfico y en la medida que te pidieron para el trámite. Si necesitás otro tamaño o formato, respondé este correo y te la preparamos.

¡Que tengas un lindo día!

[firma]`,
  },
  {
    canal: "EMAIL",
    tipo: "CONSULTA",
    nombre: "Propuesta para tu evento",
    asunto: "Propuesta para tu evento[si:consulta_fecha] del [consulta_fecha][/si]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Muchas gracias por tu consulta! Nos encanta que hayas pensado en nosotros para tu evento[si:consulta_fecha] del [consulta_fecha][/si][si:consulta_lugar] en [consulta_lugar][/si].

Armamos una propuesta pensada para lo que nos contaste:

[COMPLETÁ ACÁ LA PROPUESTA: SERVICIOS, HORAS DE COBERTURA Y VALOR]

Nos encantaría contártela en detalle y conocernos. Te proponemos coordinar una entrevista, presencial o por videollamada, sin ningún compromiso. Contanos qué día y horario te quedan cómodos respondiendo este correo[si:organizacion_whatsapp], escribiéndonos por WhatsApp al [organizacion_whatsapp][/si][si:organizacion_email] o a [organizacion_email][/si].

¡Gracias de nuevo por escribirnos!

[firma]`,
  },
  {
    canal: "EMAIL",
    tipo: "CONSULTA",
    nombre: "Seguimiento de la propuesta",
    asunto: "¿Pudiste ver nuestra propuesta?",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Hace unos días te mandamos la propuesta para tu evento[si:consulta_fecha] del [consulta_fecha][/si] y queríamos saber si pudiste verla.

Si te quedó alguna duda o querés ajustar algo, contanos: cada propuesta la armamos a medida y con gusto la adaptamos a lo que necesitás.

También podemos coordinar una entrevista sin compromiso, presencial o por videollamada, para conocernos y charlar de tu evento. Respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si] y buscamos el día y el horario que mejor te queden.

¡Nos encantaría ser parte de tu evento!

[firma]`,
  },
  {
    canal: "WHATSAPP",
    tipo: "CONSULTA",
    nombre: "Recibimos tu consulta",
    asunto: null,
    cuerpo: `¡Hola[si:nombre], [nombre][/si]! [si:organizacion]Te escribimos de [organizacion]. [/si]Recibimos tu consulta[si:consulta_tipo] ([consulta_tipo])[/si][si:consulta_fecha] para el [consulta_fecha][/si] y ya la estamos mirando.

En breve te mandamos la propuesta. Si querés sumar algún dato (horarios, cantidad de invitados, lo que tengas en mente), escribilo por acá.

¡Gracias por pensar en nosotros!`,
  },
  {
    canal: "WHATSAPP",
    tipo: "CONSULTA",
    nombre: "Coordinar entrevista",
    asunto: null,
    cuerpo: `¡Hola[si:nombre], [nombre][/si]! ¿Cómo estás? Te escribo[si:organizacion] de [organizacion][/si] por tu evento[si:consulta_fecha] del [consulta_fecha][/si].

Nos encantaría coordinar una entrevista para conocernos, contarte cómo trabajamos y mostrarte la propuesta en detalle. Puede ser presencial o por videollamada, sin ningún compromiso.

¿Qué día y horario te queda cómodo?[si:usuario_nombre]

Saludos, [usuario_nombre].[/si]`,
  },
];

/** Respuesta automática de DNX: la de Alboom corregida (agradece, promete la propuesta y repite los datos). */
export const AUTORESPUESTA_DNX: AutorespuestaInicial = {
  asunto: "Recibimos tu consulta[si:consulta_numero] n.º [consulta_numero][/si]",
  cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Gracias por escribirnos! Recibimos tu consulta y en breve te mandamos una propuesta pensada para tu evento.

Estos son los datos que nos dejaste:

[si:nombre_completo]Nombre: [nombre_completo]
[/si][si:email]Correo: [email]
[/si][si:telefono]Teléfono: [telefono]
[/si][si:consulta_tipo]Tipo de evento: [consulta_tipo]
[/si][si:consulta_fecha]Fecha: [consulta_fecha]
[/si][si:consulta_lugar]Lugar: [consulta_lugar]
[/si][si:consulta_mensaje]
Tu mensaje:
[consulta_mensaje]
[/si]
Si algún dato no es correcto o querés sumar algo, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

¡Hablamos pronto!

[firma]`,
};

/** Respuesta automática neutra para el resto de las organizaciones. */
export const AUTORESPUESTA_GENERICA: AutorespuestaInicial = {
  asunto: "Recibimos tu consulta",
  cuerpo: `Hola[si:nombre], [nombre][/si]:

Gracias por comunicarte[si:organizacion] con [organizacion][/si]. Recibimos tu consulta y te vamos a responder a la brevedad.

[si:consulta_numero]Tu número de consulta es el [consulta_numero].

[/si]Si querés agregar algún dato, podés responder este correo.

[firma]`,
};

const CLAVE = "CONSULTA_AUTORESPUESTA" as const;

/**
 * Crea, una sola vez, la respuesta automática (apagada) y, en DNX Estudio, sus 7 plantillas. La marca
 * de "ya sembrado" es la automática: si existe, no se toca nada (las plantillas que alguien borró no
 * vuelven). Idempotente: conteo simple afuera y re-chequeo adentro de la transacción.
 */
export async function asegurarPlantillasIniciales(workspaceId: string, slug: string): Promise<void> {
  // Lo común es que ya esté: un conteo simple, sin abrir transacción.
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, systemKey: CLAVE } })) > 0) return;
  const esDnx = slug === SLUG_DNX;
  const auto = esDnx ? AUTORESPUESTA_DNX : AUTORESPUESTA_GENERICA;
  const def = AUTOMATICOS[CLAVE];
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.fotofficeMessageTemplate.count({ where: { workspaceId, systemKey: CLAVE } })) > 0) return;
      await tx.fotofficeMessageTemplate.create({
        data: {
          workspaceId, systemKey: CLAVE, channel: def.canal, entityType: def.tipo, name: def.nombre,
          subject: auto.asunto, body: auto.cuerpo, enabled: false, order: 0,
        },
        select: { id: true },
      });
      if (!esDnx) return;
      const orden: Record<Canal, number> = { EMAIL: 0, WHATSAPP: 0 };
      await tx.fotofficeMessageTemplate.createMany({
        data: PLANTILLAS_DNX.map((p) => ({
          workspaceId, channel: p.canal, entityType: p.tipo, name: p.nombre, subject: p.asunto, body: p.cuerpo,
          order: orden[p.canal]++,
        })),
      });
    });
  } catch (e) {
    // Otra pestaña la creó en el mismo instante: el índice único nos frena; da igual.
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
  }
}
