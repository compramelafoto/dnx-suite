import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-pedido-laboratorio",
  titulo: "Armar un pedido para el laboratorio desde el Cobrador",
  resumen:
    "Subir las fotos del cliente, elegir tamaño, papel y plazo de cada una, elegir el laboratorio y dejarle un mensaje, cobrar la seña o el total y seguir el pedido hasta que el laboratorio lo descarga.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 9,
  pasos: [
    {
      titulo: "Abrí el pedido para laboratorio",
      texto: [
        "En Ventas (el Cobrador), tocá «Pedido para laboratorio». El botón aparece si en el catálogo hay copias para laboratorio («Copia para mañana» o «Copia próxima semana») o cuadros («Cuadro canvas 30x40», «Cuadro MDF 50x75»).",
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
        "Para una sola foto, tocala o tocá «Editar»: ahí la movés, la girás o la acercás. «Quitar» la saca del pedido.",
        "Recortar o encajar: cada foto llega con una propuesta. Si para llenar el papel se pierde poco (8 % o menos), la foto se recorta y llena todo el papel. Si se perdería más, se encaja entera y se completan los lados con franjas blancas, para que no se corte ninguna cara. En «Editar» podés cambiar entre «Recortar» y «Encajar».",
        "El «Plazo» es «para mañana» o «próxima semana». Papel: mate o brillo.",
        "Para un cuadro, elegí en «Tamaño» la medida que empieza con «Canvas» o «MDF» (por ejemplo «Canvas 30x40»). Los cuadros salen siempre para la próxima semana. Lo que ves en pantalla es el frente del cuadro.",
        "Si una foto es chica para ese tamaño, aparece la marca «Pixelada». «Revisada» aparece en las fotos que ya miraste o editaste.",
      ],
      nota: "Si hay fotos «Pixeladas», al tocar «Listo» el sistema pregunta «¿Mandarlas igual?». Conviene pedirle al cliente una foto mejor.",
    },
    {
      titulo: "Cuadros: elegí cómo se rellena el doblez",
      texto: [
        "Los cuadros de canvas y de MDF llevan 5 cm más en cada lateral para doblar sobre el bastidor o la placa. En «Editar», dentro de «Doblez de 5 cm por lado», elegí cómo se rellena:",
        "«Espejo» (viene elegido): repite en espejo el borde de la foto. Parece que la foto sigue y no se pierde nada del frente.",
        "«Desenfocado»: la foto agrandada y borrosa en los laterales.",
        "«Color liso»: un color parejo. Tocá «Blanco», «Negro» u «Otro» para elegirlo.",
        "«Foto envolvente»: la foto dobla sobre el lateral. Queda como cuadro de galería, pero se pierden 5 cm de cada borde del frente: no la uses si hay caras o texto cerca del borde.",
        "Para usar el mismo doblez en todos los cuadros del pedido, elegilo y tocá «Usar este modo y cantidad en todas»: el doblez también pasa a los otros cuadros.",
      ],
      sistema: [
        "El archivo del cuadro sale con el frente y los 5 cm de doblez de cada lado ya armados.",
        "En la carpeta del laboratorio y en el correo, el cuadro aparece como «Canvas 30x40 + doblez 5 cm (espejo)», para que sepa cómo armarlo.",
      ],
    },
    {
      titulo: "Elegí el laboratorio y escribile un mensaje",
      texto: [
        "Abajo, antes de «Listo», están «Laboratorio» y «Mensaje para el laboratorio».",
        "«Laboratorio» viene en «El de cada producto»: cada copia va al laboratorio que tiene cargado en el catálogo (hoy, Fotolag). Si este pedido tiene que ir a otro, elegilo de la lista: todas las fotos de este pedido van a ese laboratorio.",
        "En «Mensaje para el laboratorio» escribí lo que tenga que saber de este pedido: si es urgente, si lleva borde, cuándo lo retira el cliente. Si no hace falta, dejalo vacío.",
      ],
      sistema: [
        "El mensaje le llega al laboratorio en el correo del pedido, como «Indicaciones», y queda guardado en el trabajo.",
        "Lo elegido se guarda al tocar «Listo». Si volvés a abrir el pedido antes de cobrar, aparece como lo dejaste.",
      ],
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
      titulo: "Seguí el pedido hasta que el laboratorio lo descarga",
      texto: [
        "En Proyectos → «En curso», la tarjeta del trabajo y la ficha del pedido dicen en qué punto está: «Enviado a [laboratorio]», «[laboratorio] abrió el pedido» o, en verde, «[laboratorio] descargó los archivos», con el día y la hora.",
        "Si pasó el día y sigue en «Enviado», escribile al laboratorio para confirmar que le llegó.",
        "Cuando vuelve del laboratorio, tocá «Llegó» en la tarjeta: pasa a «Listo para retirar» y el cliente recibe el aviso.",
      ],
      sistema: ["La primera vez que el laboratorio abre el pedido y la primera vez que baja las fotos, queda una nota en el trabajo."],
    },
    {
      titulo: "Qué hacer si algo no salió",
      texto: [
        "Si el pedido no pudo salir (por ejemplo, el laboratorio no tiene correo cargado), el sistema te avisa a vos y el pedido queda en Configuración → Impresiones, en «Pedidos pagados sin enviar», con la etiqueta «Mostrador» y el motivo. Arreglá el motivo y tocá «Reintentar envío».",
        "También podés reintentar desde la ficha del trabajo: la tarjeta «Pedido de impresión» tiene el mismo botón «Reintentar envío». Los pedidos del Mostrador no muestran montos: el dinero ya está en el ticket.",
        "Una copia vendida como producto común (sin «Pedido para laboratorio») no sale con la carpeta vacía: queda en rojo «Faltan los archivos para [laboratorio]». Subí los archivos en la ficha del trabajo y sale solo a los pocos minutos.",
      ],
      sistema: [
        "Cuando algo falla, el estudio recibe un aviso, así el pedido pagado no queda olvidado.",
        "«Reintentar envío» lo vuelve a preparar y a mandar en unos minutos.",
      ],
      nota: "Para mandar a mano un trabajo que no sale solo, seguí la guía «Mandar a mano un pedido al laboratorio».",
    },
  ],
};
