import type { Instructivo } from "../tipos";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";

export const guia: Instructivo = {
  slug: "caja-movimientos-y-arqueo",
  titulo: "Caja: cargar ingresos y gastos, abrir y cerrar turno",
  resumen:
    "Cómo anotar lo que entra y sale, contar la caja al final del día, pasar dinero entre cuentas y ver los números del mes.",
  seccion: "Dinero",
  moduleKey: CASH_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Entrá a Caja",
      texto: [
        "En el menú de la izquierda elegí Caja. La primera pantalla es el «Panorama».",
        "Cada cuenta (por ejemplo, la caja del mostrador, la caja fuerte o Mercado Pago) tiene su tarjeta con el saldo actual. Abajo están los «Últimos movimientos» de todas las cuentas juntas.",
      ],
      nota: "Si dice «Todavía no hay ninguna cuenta configurada», primero hay que crear las cuentas en Caja → Cuentas y categorías.",
    },
    {
      titulo: "Cargá un ingreso o un gasto",
      texto: [
        "En el recuadro «Cargar movimiento» elegí la «Cuenta» donde entra o de donde sale el dinero.",
        "En «Tipo» elegí Ingreso (entra dinero) o Egreso (sale dinero, por ejemplo un gasto).",
        "Completá el «Importe», la «Categoría», el «Medio de pago» y una «Descripción» que diga de qué se trata (es obligatoria). «Cliente» y «Comprobante» son opcionales.",
        "Tocá «Cargar movimiento». Arriba aparece «Listo.» y el movimiento se suma a la lista.",
      ],
      nota: "Las cuotas que registrás en la ficha del socio y las ventas del mostrador entran solas a Caja. No las cargues otra vez acá.",
    },
    {
      titulo: "Abrí el turno del mostrador",
      texto: [
        "El turno sirve para contar el efectivo del mostrador al final del día. Sólo lo tienen las cuentas de «Efectivo de mostrador».",
        "En la tarjeta de esa cuenta, en «Abrir turno — con cuánto», escribí con cuánto efectivo arrancás (el cambio que hay en la caja) y tocá «Abrir turno».",
        "La tarjeta pasa a mostrar «Turno abierto» y, a la derecha, el «Esperado»: cuánto debería haber en la caja según lo que se fue cargando.",
      ],
    },
    {
      titulo: "Cerrá el turno: el arqueo",
      texto: [
        "Al terminar, contá el efectivo que hay en la caja.",
        "En la tarjeta, escribí el total en «Cuánto contaste». Si no coincide con el «Esperado», explicá la diferencia en «Si no cuadra, explicá por qué» (por ejemplo, «vuelto de más»).",
        "Tocá «Cerrar turno». Si la caja no cuadra y no escribiste una explicación, el sistema no te deja cerrar y te lo avisa.",
      ],
    },
    {
      titulo: "Guardá el efectivo en la caja fuerte",
      texto: [
        "Después de cerrar, el sistema te lleva a «Arqueos». Si hay una caja fuerte configurada, te pregunta «¿Pasás cuánto a …?» y te sugiere un importe, dejando en el mostrador el cambio fijo.",
        "Tocá «Sí, pasar» para anotar el pase, o «Ahora no» para dejarlo para después.",
        "En «Arqueos» queda cada apertura y cierre con lo esperado, lo contado, la diferencia y la explicación.",
      ],
    },
    {
      titulo: "Pasá dinero de una cuenta a otra",
      texto: [
        "Para mover dinero entre cuentas (por ejemplo, del mostrador a la caja fuerte, o depositar efectivo en el banco), entrá a Caja → Pases entre cuentas.",
        "Elegí la cuenta de origen en «De», la de destino en «A», escribí el «Importe» y, si querés, una «Nota». Tocá «Pasar».",
        "Aparece «Pase hecho.» y el pase queda en la lista. Un pase no es un ingreso ni un gasto: el total no cambia, sólo dónde está el dinero.",
      ],
    },
    {
      titulo: "Si cargaste algo mal, anulalo",
      texto: [
        "Entrá a Caja → Movimientos. Buscá el movimiento, escribí el «Motivo de la anulación» y tocá «Anular».",
        "Nada se borra: queda el movimiento original y otro igual en sentido contrario, los dos a la vista. Después cargá el movimiento correcto.",
        "Un pase no se anula: se hace el pase inverso. Y un cobro de un pedido se anula desde el pedido; Caja te lo avisa en la fila.",
      ],
      nota: "No anules desde Caja el ingreso de una cuota de socio: la cuota seguiría figurando como pagada. Consultá antes con quien administra el sistema.",
    },
    {
      titulo: "Mirá los números en Reportes",
      texto: [
        "Entrá a Caja → Reportes. Elegí «Este mes», «El mes pasado» o «Últimos 30 días», o poné fechas en «Desde» y «Hasta», elegí la «Cuenta» (o Todas) y tocá «Ver este rango».",
        "Vas a ver el «Saldo actual por cuenta», el «Resumen del período» (Entró, Salió y Neto), los «Ingresos y egresos por categoría» y «Los clientes que más compraron».",
      ],
    },
  ],
};
