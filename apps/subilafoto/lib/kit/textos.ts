/**
 * Los textos que el fotógrafo copia para ofrecerle SubiLaFoto a sus clientes.
 *
 * Llevan su nombre, su precio y su enlace ya puestos: un texto con "[tu precio]" para
 * completar a mano es un texto que no se manda. Hablan del servicio como **suyo** —es
 * marca blanca— y no nombran a SubiLaFoto.
 *
 * Todo lo que prometen tiene que ser cierto hoy. Si algo de esto cambia (la retención, la
 * moderación, el muro en vivo), se cambia acá.
 */

export type DatosDelVendedor = {
  /** El nombre del estudio, tal como lo ve el cliente. */
  nombre: string;
  /** Ya formateado: "$ 150.000". */
  precio: string;
  /** El enlace de venta completo. */
  enlace: string;
};

export type Pregunta = { pregunta: string; respuesta: string };

export type TextosDeVenta = {
  whatsapp: string;
  instagram: string;
  /** Para el que ya preguntó y quiere el detalle. */
  detalle: string;
  preguntas: Pregunta[];
};

/** Los días que el álbum queda disponible. Es la regla de borrado del bucket. */
export const DIAS_DEL_ALBUM = 30;

export function textosDeVenta(v: DatosDelVendedor): TextosDeVenta {
  const whatsapp = [
    "¡Hola! Te cuento algo que estoy sumando a los eventos 📸",
    "",
    "Tus invitados escanean un código QR y suben las fotos que sacan con el celular. Sin instalar nada y sin registrarse. Las fotos aparecen en vivo en la pantalla del salón y al otro día las tenés todas juntas en un álbum.",
    "",
    `Cuesta ${v.precio} por evento. Lo contratás acá:`,
    v.enlace,
    "",
    "Cualquier duda, escribime.",
  ].join("\n");

  const instagram = [
    "Las mejores fotos de tu fiesta no siempre las saca el fotógrafo 👀",
    "",
    "Con nuestro QR tus invitados suben las fotos de su celular y aparecen en vivo en la pantalla del salón. Sin app, sin registrarse. Al otro día, todas juntas en un álbum.",
    "",
    `${v.precio} por evento. Escribinos o contratalo desde el link de la bio.`,
  ].join("\n");

  const detalle = [
    `Qué incluye el servicio de fotos de invitados de ${v.nombre}:`,
    "",
    "• Un código QR para poner en las mesas, en la entrada o en la pantalla.",
    "• Los invitados suben fotos desde el celular, sin instalar nada ni registrarse.",
    "• Cada foto pasa por un control automático de contenido antes de aparecer.",
    "• Proyección en vivo en la pantalla del salón durante la fiesta.",
    "• Si no hay pantalla, los invitados ven las últimas fotos en su propio celular.",
    `• Un álbum con todas las fotos, disponible ${DIAS_DEL_ALBUM} días.`,
    "",
    `Precio: ${v.precio} por evento.`,
    `Se contrata y se paga con Mercado Pago acá: ${v.enlace}`,
  ].join("\n");

  const preguntas: Pregunta[] = [
    {
      pregunta: "¿Los invitados tienen que bajarse una aplicación?",
      respuesta:
        "No. Escanean el QR con la cámara del celular y se abre una página. No hay que instalar nada ni crearse una cuenta.",
    },
    {
      pregunta: "¿Y si alguien sube una foto que no corresponde?",
      respuesta:
        "Cada foto pasa por un control automático de contenido antes de salir en la pantalla. Además, durante la fiesta se puede sacar cualquier foto con un toque.",
    },
    {
      pregunta: "¿Hace falta una pantalla en el salón?",
      respuesta:
        "Es lo ideal, porque las fotos se proyectan en vivo. Si no hay, igual funciona: los invitados ven las últimas fotos en su celular y al otro día está el álbum completo.",
    },
    {
      pregunta: "¿Cuánto tiempo quedan las fotos?",
      respuesta: `El álbum queda disponible ${DIAS_DEL_ALBUM} días después del evento. Si querés bajarlas todas juntas, la descarga completa se agrega al contratar o después.`,
    },
    {
      pregunta: "¿Cómo se paga?",
      respuesta: `Con Mercado Pago, desde este enlace: ${v.enlace}. Apenas se acredita, el evento queda reservado.`,
    },
    {
      pregunta: "¿Se puede usar en cualquier tipo de evento?",
      respuesta:
        "Sí: casamientos, cumpleaños de 15, fiestas de egresados, eventos de empresa, congresos. Cualquier evento donde la gente saque fotos con el celular.",
    },
  ];

  return { whatsapp, instagram, detalle, preguntas };
}
