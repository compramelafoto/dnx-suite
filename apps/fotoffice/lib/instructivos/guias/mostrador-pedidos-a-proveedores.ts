import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-pedidos-a-proveedores",
  titulo: "Armar un pedido que va a un proveedor: qué camino usar",
  resumen:
    "Saber cómo cargar cada producto que se hace afuera (copias, canvas, imanes, plotter, dípticos, fotolibros, revelado) para que el pedido le llegue completo al proveedor, y cómo ver si lo descargó.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "La regla: el pedido sale cuando está completo",
      texto: [
        "Ningún pedido le llega vacío a un proveedor. El correo sale recién cuando el trabajo tiene lo que el proveedor necesita: las fotos o archivos subidos o, si es material físico (un rollo), apenas se cobra.",
        "Si se cobra sin archivos, la venta no se frena: el trabajo queda en rojo con «Faltan los archivos para [proveedor]» hasta que se suban.",
      ],
      sistema: ["Cuando se suben los archivos, el pedido sale solo al proveedor a los 5 minutos del último archivo, sin tocar nada más."],
    },
    {
      titulo: "Copias y ampliaciones: «Pedido para laboratorio»",
      texto: [
        "Para «Copia para mañana», «Copia próxima semana» y las ampliaciones, usá el botón «Pedido para laboratorio» del Cobrador. Ahí subís las fotos del cliente, elegís tamaño, papel y plazo, y cada foto se recorta o se encaja con franjas blancas para la medida de impresión.",
        "En esa misma pantalla elegís el «Laboratorio» (si no, va al de cada producto, hoy Fotolag) y escribís el «Mensaje para el laboratorio».",
        "El paso a paso completo está en la guía «Armar un pedido para el laboratorio desde el Cobrador».",
      ],
      sistema: ["El sistema arma las fotos a 300 ppp, hace una carpeta ordenada por tamaño, papel y cantidad y le manda un solo correo al laboratorio."],
    },
    {
      titulo: "Canvas, imanes, MDF, plotter y dípticos: venta común y archivos en la carpeta",
      texto: [
        "Estos productos se cargan en el ticket como cualquier producto: van al pedido con seña y al proveedor que tienen en el catálogo (La Isla o Román).",
        "Después de cobrar, abrí el trabajo en Proyectos → «En curso» y subí los archivos en «Archivos del trabajo». Tienen que estar listos para imprimir: recortados y en la medida pedida, porque van tal cual.",
        "Si el proveedor tiene que saber algo, escribilo en «Indicaciones para el proveedor» de la ficha del trabajo y tocá «Enviar» en lugar de esperar el envío automático.",
      ],
      nota: "Si en el tablero ves «Faltan los archivos para [proveedor]» en rojo, es que todavía no se subió nada a ese trabajo.",
    },
    {
      titulo: "Revelado de rollo: sale al cobrar",
      texto: [
        "El revelado está marcado como material físico: el pedido le llega a Estudio del Bajo apenas se cobra, sin archivos. El correo avisa que el rollo se lo llevan al local.",
      ],
    },
    {
      titulo: "Fotolibros: cuando el diseño está listo",
      texto: [
        "El fotolibro no sale al cobrar porque todavía no está diseñado. Cuando el diseño esté terminado, subí el archivo final a la carpeta del trabajo y tocá «Enviar a [proveedor] por correo».",
      ],
    },
    {
      titulo: "Fijate si el proveedor lo recibió",
      texto: [
        "La tarjeta del trabajo en «En curso» y la ficha del pedido muestran en qué punto está cada producto: «Faltan los archivos» (rojo), «Sale solo en unos minutos», «Enviado», «Abrió el pedido» o «Descargó los archivos» (verde), con día y hora.",
        "Si pasó el día y sigue en «Enviado», escribile al proveedor. Si el pedido ya salió por WhatsApp o en mano, usá «Marcar enviado» para que el tablero lo sepa.",
        "Cuando vuelve, tocá «Llegó»: pasa a «Listo para retirar» y el cliente recibe el aviso.",
      ],
      sistema: ["La primera vez que el proveedor abre el pedido y la primera vez que baja los archivos, queda una nota en el trabajo."],
    },
  ],
};
