import type { Instructivo } from "../tipos";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";

export const guia: Instructivo = {
  slug: "trabajos-enviar-al-proveedor",
  titulo: "Mandar a mano un pedido al laboratorio (impresiones y otros trabajos)",
  resumen:
    "Elegir el laboratorio, subir los archivos, mandarle el pedido por correo desde el trabajo y marcar cuándo vuelve.",
  seccion: "Trabajos y entregas",
  moduleKey: PROJECTS_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Cuándo se hace a mano",
      texto: [
        "Si el producto tiene un «proveedor por defecto», el pedido al laboratorio sale solo al confirmar el pedido del cliente. Esta guía es para todo lo demás: trabajos sin proveedor asignado, fotolibros (se mandan cuando el diseño está listo), un envío que falló o un trabajo que hay que mandar a otro laboratorio.",
        "Primero tiene que existir el trabajo: nace al cobrar con seña en el Cobrador, al confirmar un pedido o con «Agregar proyecto» desde la ficha del pedido.",
      ],
    },
    {
      titulo: "Revisá que el laboratorio esté cargado",
      texto: [
        "En Configuración → «Proveedores» está la lista de laboratorios y talleres (por ejemplo Fotolag o La Isla). Para sumar uno, completá «Agregar proveedor»: nombre, «Correo para los pedidos», teléfono y notas.",
        "El correo es lo importante: sin correo el sistema no puede mandarle el pedido y sólo lo marca como enviado.",
      ],
      nota: "Sólo el dueño o un administrador pueden agregar o cambiar proveedores.",
    },
    {
      titulo: "Abrí la ficha del trabajo",
      texto: [
        "En «Proyectos» → «En curso», tocá el nombre del trabajo. También podés buscarlo por cliente o número.",
      ],
    },
    {
      titulo: "Subí los archivos para el laboratorio",
      texto: [
        "En la tarjeta «Archivos del trabajo», arrastrá las fotos o tocá «Arrastrá los archivos o tocá para elegirlos». Acepta fotos, videos y PDF de hasta 5 GB cada uno. Esperá a que cada archivo llegue al 100 %.",
        "Antes de subir, dejá los archivos listos: recortados, en el tamaño pedido y con un nombre que el laboratorio entienda (por ejemplo «10x15-mate-x2-perez.jpg»).",
      ],
      sistema: [
        "Al mandar el pedido, el correo lleva el enlace «Descargar los archivos»: el laboratorio baja todo desde ahí, sin Drive ni WeTransfer.",
        "La carpeta se borra sola 30 días después del primer archivo subido.",
      ],
      nota: "Si preferís mandar el enlace por WhatsApp, tocá «Enlace laboratorio»: queda copiado para pegarlo en el chat.",
    },
    {
      titulo: "Completá «Proveedor y entrega»",
      texto: [
        "En «Proveedor» elegí el laboratorio. Si al lado dice «(sin correo)», no tiene correo cargado.",
        "En «Entrega prometida al cliente» poné la fecha que le diste al cliente: le llega al laboratorio como «Lo necesitamos para».",
        "En «Costo del proveedor» anotá lo que cobra el laboratorio, si ya lo sabés. Tocá «Guardar».",
      ],
    },
    {
      titulo: "Escribí las indicaciones y mandalo",
      texto: [
        "En «Indicaciones para el proveedor» escribí lo que tiene que saber: tamaños y cantidades, papel (mate o brillo), si lleva borde, si hay que cortar, si es urgente.",
        "Tocá «Enviar a [laboratorio] por correo». Si el proveedor no tiene correo, el botón dice «Marcar enviado a [laboratorio]»: mandale el pedido por WhatsApp o en mano y después tocalo.",
        "Debajo aparece el resultado, por ejemplo «Pedido enviado por correo a Fotolag (…)».",
      ],
      sistema: [
        "Le manda al laboratorio el correo «Pedido [número] de [estudio]» con el número de trabajo, qué es, el cliente, la fecha, las indicaciones y el enlace a los archivos. Las respuestas llegan al correo de contacto del estudio.",
        "Deja una nota en el trabajo con a quién se mandó y las indicaciones, y guarda la fecha de envío.",
        "El trabajo pasa solo a «En el proveedor».",
      ],
      nota: "Si aparece «el correo no salió. Avisale por otro medio.», el trabajo igual queda marcado como enviado: mandale el pedido por WhatsApp para que no quede sin hacer.",
    },
    {
      titulo: "Anotá el número que te da el laboratorio",
      texto: [
        "Cuando el laboratorio responda con su número de pedido, cargalo en «N° de pedido del proveedor» y tocá «Guardar». Sirve para reclamar o preguntar por el pedido.",
      ],
    },
    {
      titulo: "Cuando vuelve del laboratorio",
      texto: [
        "Revisá que esté completo y bien impreso. Después, en el tablero «En curso», tocá «Llegó» en la tarjeta.",
      ],
      sistema: [
        "El trabajo pasa directo a «Listo para retirar» y le manda al cliente el aviso por correo con el saldo que debe.",
        "Si el cliente no tiene correo, avisa que hay que escribirle por WhatsApp.",
      ],
      nota: "Para cobrar el saldo y entregar, seguí la guía «El cliente viene a retirar».",
    },
  ],
};
