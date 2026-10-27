import type { Instructivo } from "../tipos";
import { DIGITALIZACION_MODULE_KEY } from "@/lib/digitalizacion/constants";

export const guia: Instructivo = {
  slug: "digitalizacion-entregar-videos",
  titulo: "Digitalización: entregar los videos y cobrar los extras",
  resumen:
    "Qué pasa después de grabar, cómo se registra un cassette que no se pudo pasar, cómo le llegan los videos al cliente, qué ve él y cómo se cobran las descargas extra, la extensión y el envío de los cassettes.",
  seccion: "Digitalización",
  moduleKey: DIGITALIZACION_MODULE_KEY,
  minutos: 12,
  pasos: [
    {
      titulo: "Seguí cada grabación: sus estados",
      texto: [
        "Las grabaciones se ven en el menú Digitalización (todas) y en la tarjeta «Digitalización» de la ficha del trabajo (las de ese trabajo). Cada una pasa por estos estados:",
        "• «En cola» (en la lista dice «En cola para convertir»): ya se subió y espera su turno. La conversión arranca unos 15 minutos después de terminar y se hacen de a una, por orden de llegada.",
        "• «Convirtiendo…»: el servidor está armando el video. Tarda un poco menos que lo que dura la cinta: una cinta de 2 h 25 min tardó 1 h 43 min.",
        "• «Listo» (en la lista, «Video listo», con la duración y el peso): el video está terminado.",
        "• «Sin imagen» («Sin imagen: no se convierte»): en toda la grabación no se vio imagen. No se convierte.",
        "• «Error»: la conversión falló. Tocá «Reintentar conversión». Si vuelve a fallar, avisale a quien administra FOTOFFICE.",
        "• «Interrumpida» (en el trabajo, «Quedó a medias»): la grabación se cortó sin cerrarse. Tocá «Continuar» o «Terminar con lo grabado».",
      ],
      nota: "Una grabación con «Error» frena el envío al cliente: en la entrega dice «Hay un video con error: reintentá la conversión o descartalo para poder enviar.».",
    },
    {
      titulo: "Revisá cada video",
      texto: [
        "Con el video «Listo» aparecen:",
        "• «Ver video»: lo reproduce ahí mismo; se puede saltar a cualquier minuto. Para cerrarlo, «Cerrar video».",
        "• «Descargar video»: baja el archivo final a la computadora.",
        "• «Editar título»: cambia el nombre que ve el cliente. Escribilo y tocá «Guardar».",
        "• «Descartar»: borra la grabación y todo lo subido. Pregunta antes y no se puede deshacer.",
        "Los cortes de prueba de 0 minutos (por ejemplo, un Grabar y Detener para probar el equipo) quedan «Sin imagen»: descartalos para que no ensucien la lista ni cuenten como un cassette.",
      ],
      nota: "«Descargar crudo» baja la grabación original, antes de convertir. No hace falta usarlo: es para cuando la conversión falla.",
    },
    {
      titulo: "Un cassette que no se pudo digitalizar",
      texto: [
        "Si una cinta está cortada, vacía, mojada o la casetera no la lee, igual hay que anotarla: si no, el sistema sigue esperando ese cassette y no manda los videos.",
        "En la ficha del trabajo, en la tarjeta «Digitalización», tocá «Registrar cassette que no se pudo digitalizar».",
        "Elegí el «Tipo» (VHS o DVD), el «N.°» de cassette (viene el siguiente) y el «Motivo»: «Cinta cortada», «Cinta vacía (sin grabación)», «Cinta mojada u hongos», «La casetera no la lee» u «Otro» (y escribilo). Tocá «Registrar».",
        "Ejemplo: se vendieron 20 cassettes, se grabaron 18 y 2 no se pudieron. Con esos 2 registrados, el pedido cuenta 20 de 20 y sigue solo.",
        "Si lo registraste por error, tocá «Quitar»: deja de contar como hecho.",
      ],
      sistema: [
        "Queda como un cassette hecho: cuenta para completar el pedido.",
        "El cliente lo ve en su página y en el correo, por ejemplo «Cassette 7: no se pudo digitalizar (Cinta cortada)».",
      ],
    },
    {
      titulo: "Las etapas del trabajo avanzan solas",
      texto: [
        "No hace falta mover el trabajo a mano mientras se graba. Avanza solo, siempre hacia adelante:",
        "• «Grabado»: cuando están grabados todos los cassettes vendidos (y al menos uno con imagen).",
        "• «Subido a la nube»: cuando todos están convertidos (o sin imagen, o registrados como que no se pudieron) y hay al menos un video listo.",
        "• «Listo para retirar»: cuando se le mandaron los videos al cliente.",
        "Nunca retroceden solas. Si el trabajo ya está más adelante, no lo tocan.",
      ],
      sistema: [
        "Deja en el historial «Entró en … (automático: …)», con el usuario «Sistema».",
        "Revisa los trabajos cada 15 minutos, así que el cambio puede tardar un rato en verse.",
      ],
      nota: "Si la etapa en la que está el trabajo tiene tareas obligatorias sin tildar, no avanza solo. Tildalas y en el próximo repaso avanza. Para volver atrás a mano, en «Recorrido» tocá «Mover a [etapa]»: volver atrás no pide terminar tareas.",
    },
    {
      titulo: "Mandale los videos al cliente",
      texto: [
        "La entrega se ve en Digitalización → «Entregas por pedido», en la ficha del trabajo («Entrega del pedido») y en la ficha del pedido (tarjeta «Digitalización»).",
        "Automático: si están todos los cassettes vendidos y el cliente tiene correo, sale solo 30 minutos después del último cassette terminado. La entrega dice «Listo · se envía solo el …» con la fecha y la hora argentina. Se apaga o se prende por pedido con «Enviar automáticamente».",
        "Si faltan cassettes, no sale solo: dice «Falta grabar N cassettes».",
        "A mano: tocá «Enviar al cliente». Si faltan cassettes, pregunta «Falta grabar … : ¿enviar igual?».",
        "Antes de mandarlo podés tocar «Ver como el cliente»: abre su página tal cual la va a ver, sin mandar nada, sin descontar descargas y sin empezar a contar los 30 días.",
      ],
      sistema: [
        "Le manda al cliente el correo «Tus videos están listos», con el enlace, las fechas y el saldo si debe algo.",
        "Empiezan a correr los 30 días y el trabajo pasa a «Listo para retirar».",
      ],
    },
    {
      titulo: "Cliente sin correo: «Copiar enlace» por WhatsApp",
      texto: [
        "Si el cliente no tiene correo, «Enviar al cliente» queda gris y la entrega dice «el cliente no tiene correo: copiá el enlace y mandáselo por WhatsApp».",
        "Tocá «Copiar enlace», confirmá y pegalo en el WhatsApp del cliente.",
        "OJO: «Copiar enlace» genera siempre un enlace nuevo, y el anterior deja de funcionar. La primera vez, además, da la entrega por enviada: empiezan a correr los 30 días.",
        "«Reenviar» vuelve a mandar el correo, también con un enlace nuevo. Si el cliente tenía el enlace viejo guardado, mandale el nuevo.",
      ],
    },
    {
      titulo: "Fijate si salió el correo y a qué dirección",
      texto: [
        "En la entrega (lista de Digitalización, ficha del trabajo o ficha del pedido) dice, por ejemplo: «Enviado el 27/10 por correo a nombre@gmail.com · vence 26/11». Si se reenvió, agrega a qué dirección y cuándo.",
        "Si se mandó por enlace, dice «por enlace (sin correo)».",
        "Si aparece «Ojo: la casilla … rebotó o se dio de baja de los correos del estudio», el correo no le llega: confirmá la dirección con el cliente.",
      ],
    },
    {
      titulo: "Lo que ve y recibe el cliente",
      texto: [
        "Su página muestra el número de pedido y cada video con su duración. Con «Ver» lo mira en el navegador y salta a cualquier minuto al instante.",
        "Cada video se puede descargar 3 veces: el botón dice «Descargar (quedan N de 3)».",
        "Si debe saldo, ve «Pagá el saldo de … pesos para habilitar tus videos» y el botón «Pagar el saldo». Hasta que pague, no puede ver ni descargar.",
        "También ve hasta qué día están los videos («Están disponibles hasta el …. Después se borran: descargalos antes.»), los cassettes que no se pudieron digitalizar y hasta cuándo retirar los cassettes.",
      ],
      sistema: [
        "Si se terminan videos nuevos después del envío, le manda «Agregamos N videos a tu pedido». Los junta: no manda más de un aviso cada 6 horas.",
        "Le manda recordatorios 10, 5 y 1 días antes de que se borren los videos.",
        "Al vencer, borra los videos de la nube.",
      ],
    },
    {
      titulo: "Los extras que paga el cliente",
      texto: [
        "Desde su página, el cliente puede pedir:",
        "• «Comprar otra descarga»: una descarga más de un video. Cuesta el 25 % del precio de ese cassette (mínimo 100 pesos).",
        "• «Extender 30 días»: 30 días más antes del borrado. Cuesta el 50 % del pedido original (mínimo 100 pesos).",
        "• «Pedir envío de los cassettes»: busca su dirección y ve el precio según la distancia, con las franjas de Digitalización → «Configuración». Si no hay franja para esa distancia, queda «A coordinar»: escribile para arreglar el envío.",
        "Cada extra se suma al pedido como una cuota más. El cliente la paga en la página del pedido, con Mercado Pago o por transferencia.",
      ],
      sistema: [
        "Al pagarse la cuota, aplica el extra solo: suma la descarga, corre el vencimiento o confirma el envío. Si el cliente pagó por transferencia, se aplica cuando registrás el cobro en el pedido.",
        "Los extras que no se pagan en 7 días se quitan solos del pedido y queda una nota.",
      ],
      nota: "En la entrega se ve cada extra sin pagar («Descarga extra: … pesos, pendiente de pago») con el botón «Anular», que lo saca del pedido. Cuando llevaste los cassettes, tocá «Marcar entregado» en «Envío de cassettes».",
    },
    {
      titulo: "El retiro de los cassettes",
      texto: [
        "El cliente tiene 30 días desde el envío para retirar sus cassettes (la misma fecha que el vencimiento de los videos). Después se descartan porque no hay espacio para guardarlos.",
        "El correo y la página del cliente ya se lo dicen, pero conviene avisarle también por WhatsApp unos días antes.",
        "Cuando los retira, cobrá el saldo si queda algo y marcá el trabajo como entregado (ver la guía «El cliente viene a retirar: cobrar el saldo y entregar»).",
      ],
    },
  ],
};
