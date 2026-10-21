import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-avisos-y-compras",
  titulo: "Saber qué comprar y armar el pedido al proveedor",
  resumen:
    "Leer «Para comprar», entender cuántos días te alcanza cada cosa, mandar la lista al proveedor y fijar el mínimo de cada producto.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Mirá la tarjeta «Para comprar» en el inicio",
      texto: [
        "En la pantalla de inicio aparece la tarjeta «Para comprar: N», con la cantidad de cosas que conviene comprar y los nombres de las primeras tres. Si hay más, dice «y N más».",
        "Tocá «Ver stock» para ir a la pantalla «Stock».",
      ],
      nota: "Si no hay nada para comprar, la tarjeta no aparece. La ven solamente quienes pueden entrar a «Stock».",
    },
    {
      titulo: "Leé el bloque «Para comprar» en «Stock»",
      texto: [
        "Arriba de todo, en rojo, está «Para comprar» con la cantidad entre paréntesis. Ahí entra lo que está en negativo, lo que quedó debajo del mínimo y lo que te alcanza para una semana o menos.",
        "Los más urgentes van primero: primero los que están en negativo y después los que menos días duran.",
        "Si no hay nada urgente, ves el mensaje «Nada para comprar por ahora: nada debajo del mínimo ni por terminarse esta semana.».",
      ],
    },
    {
      titulo: "Entendé cada aviso",
      texto: [
        "«Te alcanza para ~N días»: es una estimación. FOTOFFICE mira cuánto salió en los últimos 30 días (por ventas, por uso en los trabajos y por pedidos) y calcula cuántos días dura lo que tenés a ese ritmo.",
        "«Se termina hoy»: lo que hay no alcanza ni para un día al ritmo de consumo de los últimos 30 días, o ya no queda nada.",
        "«Sin consumo en 30 días»: en el último mes no salió nada, así que no se puede estimar cuánto dura. Por sí solo no entra en «Para comprar»; entra si está debajo del mínimo.",
        "«Debajo del mínimo (M)»: tenés menos que el mínimo que fijaste para ese producto. M es ese mínimo.",
      ],
      nota: "Las devoluciones se descuentan del consumo: si algo volvió, no cuenta como gastado.",
    },
    {
      titulo: "Armá el pedido con «Lista para el proveedor»",
      texto: [
        "Más abajo está «Lista para el proveedor». Agrupa lo que hay que comprar por proveedor; lo que no tiene proveedor cargado queda en «Sin proveedor».",
        "Cada renglón trae una cantidad sugerida: lo que falta para llegar al mínimo o para cubrir un mes de consumo, y como mínimo una unidad. Si el insumo tiene cómo lo comprás (por ejemplo cajas de 100), te la muestra en bultos.",
        "Tocá «Copiar lista» en el proveedor que quieras. El botón dice «Copiado» cuando se copió. Pegalo en un WhatsApp o en un mail: sale como «Pedido para» el proveedor y un renglón por producto.",
        "Las cantidades son una sugerencia: antes de mandar la lista podés cambiar lo que quieras.",
      ],
      sistema: ["Copiar la lista no pide nada ni cambia el stock. Cuando llegue la mercadería, cargala con «Recibir pedido»."],
    },
    {
      titulo: "Fijá el mínimo de cada producto",
      texto: [
        "El mínimo se carga en la ficha del producto, en el catálogo. Buscá el campo «Mínimo antes de avisar» (aparece en los productos que controlan existencia y en los insumos) y escribí el número por debajo del cual querés que te avise.",
        "Para que la lista sepa a quién pedirle, completá también el proveedor en la ficha: «Proveedor (texto libre)».",
        "Guardá la ficha. Desde ese momento, si la existencia baja de ese número, el producto pasa a «Para comprar».",
      ],
      nota: "Si dejás el mínimo vacío, igual te avisa cuando algo está en negativo o por terminarse esta semana.",
    },
  ],
};
