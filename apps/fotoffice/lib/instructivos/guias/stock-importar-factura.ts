import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-importar-factura",
  titulo: "Importar una factura del proveedor",
  resumen:
    "Subir la foto o el PDF de la factura para que FOTOFFICE cargue las líneas de la recepción solo, y qué hacer si no tenés lectura con IA.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Sacá una foto clara o bajá el PDF",
      texto: [
        "Si la factura es en papel, sacale una foto de frente, con buena luz y sin sombras, de modo que se lean todos los renglones. Si te la mandaron por mail, bajá el PDF.",
        "Una captura de pantalla de la factura o del pedido también sirve.",
      ],
      nota: "Si tu celular saca las fotos en formato HEIC (iPhone) y el sistema no la abre, exportala como JPG o sacala con la cámara en modo compatible.",
    },
    {
      titulo: "Subila en la recepción",
      texto: [
        "Entrá a «Stock», tocá «Recibir pedido» y abrí la recepción (o creá una nueva). Arriba de la lista está «Importar desde factura o remito».",
        "En «Leer con IA» tocá «Subir foto o PDF» y elegí el archivo. Mientras trabaja ves «Leyendo…»: esperá a que termine.",
        "Si preferís, tocá «Pegar texto», pegá el mail o el detalle del pedido y tocá «Leer el texto».",
      ],
      sistema: [
        "Las fotos se achican solas antes de mandarlas. El PDF puede pesar hasta 4 MB: si pesa más, el sistema avisa «El PDF pesa más de 4 MB: dividilo o mandá una foto de cada hoja.».",
      ],
    },
    {
      titulo: "Revisá lo que leyó",
      texto: [
        "Al terminar te dice cuántas líneas agregó y cuántas quedaron sin asociar. Esas líneas aparecen abajo, en la lista de la recepción.",
        "Las que el sistema reconoció ya traen su producto. En las otras ves «Elegí el producto» en rojo: tocá una de las sugerencias o escribí en «Buscar otro por nombre» y elegí el producto de la lista.",
        "Controlá cada «Cantidad» y cada «Costo» contra la factura, y corregí lo que haga falta.",
      ],
      sistema: [
        "Cuando elegís a mano el producto de una línea, FOTOFFICE lo recuerda para ese proveedor: la próxima factura que importes con el mismo proveedor lo reconoce solo.",
      ],
      nota: "Para que el sistema recuerde, la recepción tiene que tener elegido el «Proveedor».",
    },
    {
      titulo: "Fijate en los avisos",
      texto: [
        "Si ves «Lo leído no suma igual que el total de la factura: revisá las líneas.», alguna línea se leyó mal o falta una. No te impide seguir, pero conviene revisar antes de confirmar.",
        "Si aparece «Proveedor detectado: …», es el nombre que figura en la factura. Elegilo arriba en «Proveedor» o, si todavía no existe, crealo en «Proveedores».",
      ],
      sistema: [
        "El proveedor nunca se crea solo: si el nombre coincide con uno que ya tenés, se elige; si no, lo decidís vos.",
      ],
    },
    {
      titulo: "Confirmá como siempre",
      texto: [
        "Una línea sin producto no te deja confirmar: asociá todas. Después mirá el «Total» y tocá «Confirmar recepción», y «Sí, confirmar».",
        "Recién ahí se suma al stock. Hasta ese momento podés cambiar lo que quieras o tocar «Descartar».",
      ],
    },
    {
      titulo: "Si no tenés lectura con IA: usá tu propio ChatGPT o Claude",
      texto: [
        "Si «Leer con IA» aparece apagado con el aviso «La lectura con IA no está configurada.», igual podés importar. En «Con la plantilla CSV» tocá «Copiar instrucciones para la IA».",
        "Abrí tu ChatGPT o Claude, pegá las instrucciones, adjuntá la foto de la factura y enviá. Te devuelve una tabla en formato CSV: guardala como archivo con extensión .csv.",
        "Volvé a la recepción, tocá «Subir CSV» y elegí ese archivo. Las líneas se cargan igual que con la foto, y se revisan igual.",
      ],
      nota: "El CSV puede pesar hasta 1 MB. Si no es un archivo .csv, el sistema avisa «Elegí un archivo .csv con la plantilla.».",
    },
    {
      titulo: "Cargar a mano con la plantilla",
      texto: [
        "Tocá «Descargar plantilla CSV»: baja un archivo de ejemplo con las columnas. Abrilo en una planilla, escribí una fila por producto y guardalo como CSV.",
        "Después tocá «Subir CSV». También podés bajar con «Descargar CSV» lo que ya está cargado en la recepción, para corregirlo en una planilla.",
      ],
    },
  ],
};
