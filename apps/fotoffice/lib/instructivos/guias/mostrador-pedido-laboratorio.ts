import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-pedido-laboratorio",
  titulo: "Armar un pedido para el laboratorio desde el Cobrador",
  resumen:
    "Subir las fotos del cliente, elegir tamaño, papel y plazo de cada una, cobrar la seña o el total y dejar que el sistema le mande el pedido al laboratorio.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 7,
  pasos: [
    {
      titulo: "Abrí el pedido para laboratorio",
      texto: [
        "En Ventas (el Cobrador), tocá «Pedido para laboratorio». El botón aparece si en el catálogo hay copias para laboratorio («Copia para mañana» o «Copia próxima semana»).",
        "Se abre una pantalla completa, sin salir del ticket. Si ya habías armado un pedido, el mismo botón lo vuelve a abrir.",
      ],
      nota: "Si ya sabés quién es el cliente, elegilo antes en el ticket. Para cobrar un pedido para laboratorio el cliente es obligatorio.",
    },
    {
      titulo: "Subí las fotos",
      texto: [
        "Tocá «Agregar fotos» o arrastrá las fotos a la pantalla. Sirven JPG, PNG o WebP de hasta 60 MB.",
        "Arriba, en «Para las fotos nuevas:», elegí el «Tamaño», el «Plazo», el «Papel» y las «Copias» que van a tener las fotos que subas a continuación. Cada foto llega con esos valores y con un recorte propuesto.",
        "Arriba a la izquierda ves cuántas fotos y cuántas copias lleva el pedido.",
      ],
      sistema: ["Las fotos se guardan a medida que las subís. Si cerrás la pantalla sin terminar, quedan guardadas para la próxima vez."],
    },
    {
      titulo: "Ajustá cada foto",
      texto: [
        "Cada foto se muestra sobre su papel, con una línea como «10x15 · mate · ×2 · próxima semana». Para cambiar varias juntas, tildá «Elegir» en cada una (o tocá «Elegir todas»), cambiá los valores de la fila «A todas:» (o «A las N elegidas:» si tildaste algunas) y tocá «Aplicar». Lo que dice «Sin cambiar» no se toca.",
        "Para una sola foto, tocala o tocá «Editar»: ahí la movés, la girás o la encajás para recortarla. «Quitar» la saca del pedido.",
        "El «Plazo» es «para mañana» o «próxima semana». Papel: mate o brillo.",
        "Si una foto es chica para ese tamaño, aparece la marca «Pixelada». «Revisada» aparece en las fotos que ya miraste o editaste.",
      ],
      nota: "Si hay fotos «Pixeladas», al tocar «Listo» el sistema pregunta «¿Mandarlas igual?». Conviene pedirle al cliente una foto mejor.",
    },
    {
      titulo: "Tocá «Listo»",
      texto: [
        "Abajo ves el resumen: por ejemplo «10x15 · mate · próxima semana» con las copias y las fotos de cada grupo. Cuando esté bien, tocá «Listo» (el botón dice cuántas copias lleva).",
        "El precio no se ve en esta pantalla: aparece en el ticket. Tocá «Volver al ticket» si querés salir sin confirmar.",
      ],
      sistema: [
        "En el ticket queda un renglón por producto, marcado «Laboratorio». Ya vienen con la cantidad y el precio correctos.",
        "Pocas copias de un tamaño (menos que el primer escalón «más de N» de la lista) se cobran al precio de copia instantánea y salen «para mañana».",
      ],
    },
    {
      titulo: "Cambiar o quitar el pedido",
      texto: [
        "Los renglones del laboratorio están bloqueados: no se les cambia la cantidad ni el precio de a uno. Para modificarlos, tocá cualquiera de ellos o el botón «Pedido para laboratorio»: se vuelve a abrir el editor.",
        "Para sacar todo, tocá «Quitar pedido para laboratorio». Se van todos los renglones juntos.",
        "Los otros productos del ticket (un marco, un portarretrato) se agregan aparte, como siempre.",
      ],
    },
    {
      titulo: "Cobrá la seña o el total",
      texto: [
        "Cobrá como cualquier venta con pedido: elegí seña o pago total y el medio de pago. El cliente tiene que estar elegido.",
        "Al terminar, el cartel de venta dice «Pedido [número] creado» y avisa que las fotos se preparan y el pedido sale solo al laboratorio en unos minutos.",
      ],
      sistema: [
        "Se crea el pedido y un trabajo en tu tablero «En curso».",
        "Pasados unos minutos, el sistema prepara las fotos y le manda a cada laboratorio UN correo con el enlace para bajar todas las fotos, ordenadas por tamaño, papel y cantidad.",
        "El trabajo pasa solo a «En el proveedor». No tenés que escribirle ni subir nada a mano.",
      ],
      nota: "Si Impresiones está en «modo prueba», el correo del laboratorio te llega a vos, al correo de contacto del estudio, y no al laboratorio.",
    },
    {
      titulo: "Qué hacer si algo no salió",
      texto: [
        "Si el pedido no pudo salir (por ejemplo, el laboratorio no tiene correo cargado), el sistema te avisa a vos y el pedido queda en Configuración → Impresiones, en «Pedidos pagados sin enviar», con la etiqueta «Mostrador» y el motivo. Arreglá el motivo y tocá «Reintentar envío».",
        "También podés reintentar desde la ficha del trabajo: la tarjeta «Pedido de impresión» tiene el mismo botón «Reintentar envío». Los pedidos del Mostrador no muestran montos: el dinero ya está en el ticket.",
        "Una copia común cuya carpeta está vacía no se manda: queda sin enviar con la nota «Falta subir los archivos para mandarlo a [laboratorio].». Subí los archivos en la ficha del trabajo y tocá «Enviar a [laboratorio] por correo».",
      ],
      sistema: [
        "Cuando algo falla, el estudio recibe un aviso, así el pedido pagado no queda olvidado.",
        "«Reintentar envío» lo vuelve a preparar y a mandar en unos minutos.",
      ],
      nota: "Para mandar a mano un trabajo que no sale solo, seguí la guía «Mandar a mano un pedido al laboratorio».",
    },
  ],
};
