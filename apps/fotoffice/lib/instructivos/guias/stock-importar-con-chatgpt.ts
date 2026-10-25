import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-importar-con-chatgpt",
  titulo: "Cargar una compra con ChatGPT",
  resumen:
    "Cuando llega mercadería con su factura o remito: ChatGPT lee la factura, te devuelve un archivo CSV y lo subís a la recepción para sumar todo al stock de una vez.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 7,
  pasos: [
    {
      titulo: "Abrí una recepción",
      imagen: "/instructivos/stock-importar-con-chatgpt/01-stock.jpg",
      imagenAlt: "Pantalla «Stock» con el botón «Recibir pedido» arriba a la derecha.",
      texto: [
        "Llegó la compra: tené a mano la factura o el remito (en papel, en PDF o en una captura del mail o de Mercado Libre).",
        "Entrá a Ventas → «Stock» y tocá «Recibir pedido». En «Recepción de pedidos» tocá otra vez «Recibir pedido»: se abre una recepción nueva, que es como una lista en borrador.",
      ],
      nota: "Nada se suma al stock hasta que confirmes. Si te equivocás, se corrige o se descarta sin problema.",
    },
    {
      titulo: "Completá los datos de la factura",
      imagen: "/instructivos/stock-importar-con-chatgpt/02-recepcion.jpg",
      imagenAlt: "Recepción con «Proveedor», «Fecha», «Comprobante» y la casilla «Los costos incluyen IVA».",
      texto: [
        "Elegí el «Proveedor», revisá la «Fecha» y escribí el número en «Comprobante» (por ejemplo, Factura B 0002-00004567).",
        "Si los precios de la factura ya tienen el IVA adentro, dejá marcado «Los costos incluyen IVA».",
      ],
      nota: "Elegí siempre el proveedor: así FOTOFFICE aprende cómo llama ese proveedor a cada producto y la próxima vez lo reconoce solo.",
    },
    {
      titulo: "Copiá las instrucciones para ChatGPT",
      imagen: "/instructivos/stock-importar-con-chatgpt/03-copiar-instrucciones.jpg",
      imagenAlt:
        "Bloque «Importar desde factura o remito»: a la derecha «Con la plantilla CSV» y el aviso «Instrucciones copiadas» en verde.",
      texto: [
        "Bajá hasta «Importar desde factura o remito». A la derecha, en «Con la plantilla CSV», tocá «Copiar instrucciones para la IA».",
        "Abajo aparece en verde «Instrucciones copiadas: pegalas en tu asistente de IA junto con la factura y subí el CSV que te devuelva.». Ya las tenés copiadas, como cuando copiás un texto en el celular.",
      ],
    },
    {
      titulo: "Pedile a ChatGPT que lea la factura",
      texto: [
        "Abrí ChatGPT (en la compu o en el celular) y empezá un chat nuevo.",
        "Pegá las instrucciones en el cuadro de mensaje, adjuntá la foto o el PDF de la factura con el clip y enviá.",
        "Cuando responda, escribile: «Dámelo como archivo .csv para descargar». Descargá el archivo que te da.",
      ],
      nota: "Si la foto sale borrosa o cortada, ChatGPT puede leer mal. Sacala de frente, con buena luz y que se vean todos los renglones.",
      sistema: [
        "Las instrucciones ya le dicen a ChatGPT qué columnas devolver, en qué orden y con qué formato. No hace falta explicarle nada más.",
        "Este camino no gasta el crédito de IA de FOTOFFICE: la lectura la hace tu cuenta de ChatGPT.",
      ],
    },
    {
      titulo: "Subí el CSV",
      imagen: "/instructivos/stock-importar-con-chatgpt/04-subir-csv.jpg",
      imagenAlt: "Después de subir el archivo, el aviso en verde «Se agregaron 2 líneas (2 sin asociar).».",
      texto: [
        "Volvé a la recepción en FOTOFFICE, tocá «Subir CSV» y elegí el archivo que descargaste.",
        "Arriba te dice cuántas líneas agregó y cuántas quedaron «sin asociar», o sea, que todavía no sabe a qué producto corresponden.",
      ],
      nota: "Si aparece «Elegí un archivo .csv con la plantilla.» o «El archivo no tiene el encabezado de la plantilla.», ChatGPT no armó bien el archivo: pedile de nuevo «solo el CSV con el encabezado exacto, como archivo .csv».",
    },
    {
      titulo: "Decí qué producto es cada línea",
      imagen: "/instructivos/stock-importar-con-chatgpt/05-elegir-producto.jpg",
      imagenAlt:
        "Dos líneas importadas con «Elegí el producto» en rojo, sugerencias debajo del nombre y el buscador «Buscar otro por nombre».",
      texto: [
        "Bajá a la lista. Cada línea que dice «Elegí el producto» en rojo necesita que le digas qué es.",
        "Si debajo del nombre aparece el producto correcto, tocalo. Si no, escribí en «Buscar otro por nombre» y elegilo de la lista.",
        "Si el producto no existe todavía en el catálogo, dalo de alta primero (guía «Dar de alta un insumo») y después volvé a la recepción.",
      ],
      sistema: [
        "Cuando elegís el producto, FOTOFFICE lo recuerda para ese proveedor. La próxima compra al mismo proveedor esa línea ya viene asociada.",
      ],
    },
    {
      titulo: "Revisá cantidades, bultos y costos",
      imagen: "/instructivos/stock-importar-con-chatgpt/06-revisar-bultos.jpg",
      imagenAlt: "Línea del Kit Kodak 305: 2 bultos de 640 copias, 1280 copias en total, costo 120.000 por bulto.",
      texto: [
        "Compará cada línea con la factura: la «Cantidad» y el «Costo».",
        "Fijate en los bultos. Si compraste 2 kits Kodak de 640 copias, tiene que decir 2 «en bultos de» 640, y debajo «= 1280 copias 10x15». Lo mismo con cajas o packs: un paquete de 100 sobres son 100 sobres en el stock, no 1.",
        "Si algo está mal, corregilo ahí mismo. Si sobra una línea (un envío, un descuento), tocá «Quitar».",
      ],
      nota: "Es el paso más importante: ChatGPT a veces confunde cantidades o se saltea un renglón.",
    },
    {
      titulo: "Confirmá la recepción",
      texto: [
        "Mirá que el «Total» se parezca al de la factura. Después tocá «Confirmar recepción» y «Sí, confirmar».",
        "Recién ahí se suma todo al stock, con su costo.",
      ],
      nota: "Si te quedan dudas, no confirmes: dejá la recepción sin confirmar y consultá. Para retomarla, entrá a «Recepción de pedidos» y tocá la que dice «Sin confirmar».",
    },
  ],
};
