import type { Instructivo } from "../tipos";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";

export const guia: Instructivo = {
  slug: "caja-gastos-y-retiros",
  titulo: "Anotar un gasto, un retiro o un ingreso suelto",
  resumen:
    "Registrar lo que sale del cajón (insumos, un pago, un retiro) o una plata que entra sin ser una venta, desde el Cobrador o desde Caja.",
  seccion: "Caja",
  moduleKey: CASH_MODULE_KEY,
  minutos: 4,
  pasos: [
    {
      titulo: "El camino rápido: «Egreso» en el Cobrador",
      texto: [
        "Si estás en el Cobrador, no hace falta salir. Arriba del Ticket tocá «Egreso».",
        "En la ventana «Registrar egreso» completá el «Importe» y «Qué se pagó y a quién» (por ejemplo: «resmas — Papelería Norte»).",
        "«Sale de» ya viene con la caja del mostrador. Elegí la «Categoría» (Proveedores, Sueldos, etc.) y el «Medio». Si tenés ticket o factura, anotá su número en «Comprobante».",
        "Tocá «Anotar egreso». El ticket que estabas armando no se pierde.",
      ],
      sistema: [
        "Resta el importe de esa caja y, si el turno está abierto, lo descuenta del «Debería haber».",
        "Abajo aparece «Egreso de $… anotado en [caja].».",
      ],
      nota: "Si no ves el botón «Egreso», tu usuario no puede operar la Caja: pedile el permiso a quien administra FOTOFFICE.",
    },
    {
      titulo: "Desde Caja: «Anotar ingreso o gasto»",
      texto: [
        "Entrá a Caja → «Panorama» y tocá «Anotar ingreso o gasto». Se abre el recuadro «Cargar movimiento». (En Caja → «Movimientos» el mismo recuadro está siempre abierto arriba).",
        "Elegí la «Cuenta» donde entra o sale la plata y el «Tipo»: «Ingreso» o «Egreso».",
        "Escribí el «Importe». Acepta 3.000,50, $ 2.000 o 2000.",
      ],
    },
    {
      titulo: "Completá los datos del movimiento",
      texto: [
        "«Categoría»: sólo aparecen las del tipo elegido (las de gasto en un egreso, las de ingreso en un ingreso).",
        "«Medio de pago»: Efectivo, Transferencia, Mercado Pago, Tarjeta u Otro.",
        "«Cliente»: sólo en un ingreso, si la plata es de un cliente.",
        "«Comprobante»: número de factura o recibo, si lo hay.",
        "«Descripción»: obligatoria. Escribí qué se pagó y a quién, o de qué es la plata que entró.",
      ],
    },
    {
      titulo: "Cargalo",
      texto: ["Tocá «Cargar movimiento». Arriba aparece «Listo.»."],
      sistema: [
        "El movimiento queda en el libro de Caja como «Carga manual», con tu nombre y la hora.",
        "Si la cuenta tiene el turno abierto, entra en ese turno y cambia el «Debería haber».",
      ],
    },
    {
      titulo: "Si aparece un aviso",
      texto: [
        "«Elegí en qué cuenta entra o sale la plata.»: falta la Cuenta.",
        "«Escribí de qué se trata el movimiento.»: falta la Descripción.",
        "«El importe no se entiende.» o «El importe tiene que ser mayor que cero.»: revisá el número.",
      ],
      nota: "Una venta o el cobro de un trabajo no se cargan acá: se cobran en el Cobrador o en el pedido, y entran a Caja solos. Si los cargás a mano también, quedan dos veces.",
    },
  ],
};
