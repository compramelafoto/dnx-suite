import type { Instructivo } from "../tipos";
import { BANDEJA_MODULE_KEY } from "@/lib/bandeja/constantes";

export const guia: Instructivo = {
  slug: "bandeja-whatsapp",
  titulo: "Atender el WhatsApp del estudio con la Bandeja",
  resumen:
    "Cómo trabajar junto al bot: qué chats mirar, cuándo tomar uno, cómo responder y cómo devolvérselo al bot cuando terminás.",
  seccion: "Mostrador",
  moduleKey: BANDEJA_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Cómo funciona",
      texto: [
        "El WhatsApp del estudio lo contesta un bot a cualquier hora: precios del catálogo, horarios, dirección, fotos carnet, copias, fotolibros, VHS y cotizaciones de eventos. También arma los pedidos y manda el enlace para pagar la seña.",
        "Lo que no puede resolver (un reclamo, una factura, un producto sin precio) te lo pasa a vos.",
        "Todos los chats se ven en la Bandeja de FOTOFFICE: entrá desde el menú de la izquierda, en «Bandeja».",
      ],
      nota: "Usá la Bandeja de FOTOFFICE para atender. El celular del estudio sirve de respaldo para contestar rápido; WhatsApp Web no muestra qué dijo el bot ni en qué estado está cada chat.",
    },
    {
      titulo: "Mirá los chats por estado",
      texto: [
        "Arriba de la lista tenés los filtros: «Todos», «Atiende el bot», «Míos», «Sin asignar» y «Resueltos».",
        "«Sin asignar» son los chats que el bot pasó a una persona y que nadie tomó todavía: son los que hay que mirar primero.",
        "«Míos» son los que estás atendiendo vos. «Atiende el bot» son los que está contestando el bot: no hace falta tocarlos.",
        "La lista se actualiza sola cada 10 segundos.",
      ],
      nota: "Revisá «Sin asignar» varias veces por día, sobre todo a la mañana: ahí quedan los reclamos y las consultas que llegaron de noche.",
    },
    {
      titulo: "Abrí un chat y leé lo que pasó",
      texto: [
        "Tocá el chat. Vas a ver toda la conversación: lo que escribió el cliente, lo que contestó el bot y los avisos del sistema (en gris), por ejemplo «El bot pasó el chat a una persona: factura».",
        "Ese aviso te dice por qué te lo pasó, así no tenés que volver a preguntarle al cliente lo que ya dijo.",
        "Las fotos que mandó el cliente se ven en el chat y se pueden bajar con «Descargar».",
      ],
    },
    {
      titulo: "Tomá el chat y respondé",
      texto: [
        "Si vas a atenderlo vos, tocá «Tomar». El chat pasa a «Míos» y el bot deja de contestar ahí.",
        "Escribí en «Escribí tu respuesta» y tocá «Enviar». El mensaje le llega al cliente desde el número del estudio.",
        "Si respondés sin tocar «Tomar», el chat se toma solo.",
      ],
      sistema: [
        "Mientras el chat es tuyo, el bot no interviene.",
        "Si alguien contesta desde el celular del estudio, el bot también se calla en ese chat durante unas horas.",
      ],
    },
    {
      titulo: "Cuando terminás: «Resolver» o «Devolver al bot»",
      texto: [
        "«Resolver»: la consulta quedó cerrada. Si el cliente vuelve a escribir, el bot lo atiende de nuevo.",
        "«Devolver al bot»: el bot sigue la charla desde donde quedó (por ejemplo, ya resolviste lo de la factura y el cliente quiere seguir comprando).",
        "Hacé siempre una de las dos cosas al terminar.",
      ],
      nota: "Si no tocás ninguna, el chat queda tuyo y el bot no le contesta más a ese cliente: si vuelve a escribir de noche, nadie le responde.",
    },
    {
      titulo: "La regla de las 24 horas",
      texto: [
        "WhatsApp deja escribirle libremente a un cliente sólo dentro de las 24 horas desde su último mensaje.",
        "Si pasaron más de 24 horas, la Bandeja te avisa con «Pasaron más de 24 horas desde el último mensaje del cliente». En ese caso no se puede mandar un mensaje común: llamalo, o esperá a que el cliente escriba.",
      ],
    },
    {
      titulo: "Lo que sigue igual en el celular",
      texto: [
        "La app WhatsApp Business del celular del estudio sigue funcionando como siempre: ves todos los chats y podés responder.",
        "Los grupos se manejan sólo desde el celular (o WhatsApp Web): no aparecen en la Bandeja y el bot no los contesta.",
        "A los proveedores y la publicidad el bot les contesta que se lo pasa al encargado y le avisa a Daniel por Telegram.",
      ],
    },
  ],
};
