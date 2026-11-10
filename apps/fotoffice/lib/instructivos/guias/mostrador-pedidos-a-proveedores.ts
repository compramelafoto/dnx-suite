import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-pedidos-a-proveedores",
  titulo: "Todos los tipos de pedido: cómo cargar cada uno",
  resumen:
    "Qué camino usar en el Cobrador según lo que pide el cliente (copias, ampliaciones, cuadros de canvas o MDF, imanes, plotter, dípticos, fotolibros, revelado, digitalización, foto carnet, instantáneas y polaroid), para que cada pedido llegue completo y se pueda seguir hasta la entrega.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Antes de empezar: lo que vale para todos",
      texto: [
        "Todo lo que se entrega otro día es un pedido: en el ticket aparece con la etiqueta «Pedido» y el recuadro «Pedido para retirar». El cliente es obligatorio y se cobra la seña o el total (guía «Tomar un trabajo para retirar (con seña)»).",
        "Cada producto del pedido crea su trabajo en Proyectos → «En curso». Ahí se ve en qué punto está cada uno hasta que se entrega.",
        "Ningún pedido le llega vacío a un proveedor: el correo sale recién cuando el trabajo tiene lo que el proveedor necesita. Si se cobra sin archivos, la venta no se frena: el trabajo queda en rojo con «Faltan los archivos para [proveedor]» hasta que se suban.",
      ],
      sistema: ["Cuando se suben los archivos que faltaban, el pedido sale solo al proveedor a los 5 minutos del último archivo."],
    },
    {
      titulo: "Copias y ampliaciones (Fotolag): «Pedido para laboratorio»",
      texto: [
        "Para «Copia para mañana», «Copia próxima semana» y las ampliaciones, tocá «Pedido para laboratorio» en el Cobrador.",
        "Subí las fotos del cliente y elegí tamaño, plazo, papel y copias. Cada foto se recorta o se encaja con franjas blancas para la medida de impresión; en «Editar» la ajustás.",
        "Abajo elegí el «Laboratorio» (si no, va al de cada producto) y, si hace falta, escribí el «Mensaje para el laboratorio». Tocá «Listo» y cobrá.",
      ],
      sistema: ["El sistema arma las fotos a 300 ppp, hace una carpeta ordenada por tamaño, papel y cantidad y le manda un solo correo al laboratorio."],
      nota: "El paso a paso completo está en la guía «Armar un pedido para el laboratorio desde el Cobrador».",
    },
    {
      titulo: "Cuadros de canvas y MDF (La Isla): también «Pedido para laboratorio»",
      texto: [
        "Abrí «Pedido para laboratorio» y en «Tamaño» elegí la medida que empieza con «Canvas» o «MDF» (por ejemplo «Canvas 30x40»). Salen para la próxima semana.",
        "Lo que ves es el frente del cuadro. En «Editar», en «Doblez de 5 cm por lado», elegí cómo se rellenan los laterales: «Espejo» (viene elegido), «Desenfocado», «Color liso» o «Foto envolvente».",
        "Podés mezclar copias y cuadros en el mismo pedido: cada producto va a su laboratorio.",
      ],
      sistema: ["El archivo del cuadro sale con los 5 cm de doblez de cada lado ya agregados, y el laboratorio lo recibe como «Canvas 30x40 + doblez 5 cm (espejo)»."],
    },
    {
      titulo: "Imanes, plotter y dípticos (La Isla y Román): venta común y archivos en la carpeta",
      texto: [
        "Cargalos en el ticket como cualquier producto: van al pedido con seña y al proveedor del catálogo.",
        "Después de cobrar, abrí el trabajo en Proyectos → «En curso» y subí los archivos en «Archivos del trabajo». Tienen que estar listos para imprimir (recortados y en la medida pedida), porque van tal cual.",
        "Si el proveedor tiene que saber algo, escribilo en «Indicaciones para el proveedor» en la ficha del trabajo y tocá «Enviar a [proveedor] por correo».",
      ],
      nota: "El detalle está en la guía «Mandar a mano un pedido al laboratorio (impresiones y otros trabajos)».",
    },
    {
      titulo: "Fotolibros (Román): se mandan cuando el diseño está listo",
      texto: [
        "En el Cobrador tocá el fotolibro (tapa flexible o rígida): se abre la calculadora para elegir el modelo y las hojas. La caja va como otro renglón.",
        "Al cobrar se crea el trabajo con «Abrir el fotolibro». El pedido no sale al cobrar porque el libro todavía no está diseñado.",
        "Cuando el diseño esté terminado, subí el archivo final a la carpeta del trabajo y tocá «Enviar a Román por correo».",
      ],
    },
    {
      titulo: "Revelado de rollo (Estudio del Bajo): sale al cobrar",
      texto: [
        "Cargá «Revelado de rollo» en el ticket y cobrá. Como el rollo es material físico, el pedido le llega a Estudio del Bajo apenas se cobra, sin archivos.",
        "El correo le avisa que el rollo se lo llevan al local: separalo con el nombre del cliente.",
      ],
    },
    {
      titulo: "Digitalización de VHS, casetes, CD, DVD y negativos: en el estudio",
      texto: [
        "Se hace en el estudio, sin proveedor. Cargá el producto en el ticket y cobrá: el trabajo aparece en «En curso» y, si tenés permiso, el cartel de venta ofrece «Ir a grabar».",
      ],
      nota: "El paso a paso está en las guías de Digitalización («Vender y grabar un cassette» y «Entregar los videos y cobrar los extras»).",
    },
    {
      titulo: "Foto carnet, copias instantáneas y polaroid: en el estudio",
      texto: [
        "Se hacen en el estudio, sin proveedor: no le llega ningún correo a nadie.",
        "En la foto carnet, el renglón del ticket muestra «Preparar»: ahí armás la plancha para imprimir (guía «Hacer una foto carnet y la plancha para imprimir»).",
        "Las copias instantáneas y las polaroid se imprimen en el momento. Si quedan para retirar, el trabajo aparece en «En curso»: avanzalo con el botón de la tarjeta cuando esté listo.",
      ],
    },
    {
      titulo: "Seguí cada pedido hasta la entrega",
      texto: [
        "En Proyectos → «En curso» y en la ficha del pedido, cada trabajo con proveedor dice en qué punto está: «Faltan los archivos» (rojo), «Sale solo en unos minutos», «Enviado», «Abrió el pedido» o «Descargó los archivos» (verde), con día y hora.",
        "Si pasó el día y sigue en «Enviado», escribile al proveedor. Si el pedido salió por WhatsApp o en mano, usá «Marcar enviado» para que el tablero lo sepa.",
        "Cuando vuelve, tocá «Llegó»: pasa a «Listo para retirar» y el cliente recibe el aviso. Para cobrar el saldo y entregar, seguí la guía «El cliente viene a retirar».",
      ],
      sistema: ["La primera vez que el proveedor abre el pedido y la primera vez que baja los archivos, queda una nota en el trabajo."],
    },
  ],
};
