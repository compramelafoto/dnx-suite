import type { Instructivo } from "../tipos";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";

export const guia: Instructivo = {
  slug: "caja-movimientos-y-arqueo",
  titulo: "Corregir un error, pasar plata entre cuentas y mirar los números",
  resumen:
    "Anular un movimiento mal cargado, mover dinero de una cuenta a otra y consultar el libro de movimientos y los reportes del mes.",
  seccion: "Caja",
  moduleKey: CASH_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Leé el Panorama",
      texto: [
        "Caja → «Panorama» muestra el saldo de cada cuenta y, al final, «Últimos movimientos»: los 20 últimos de todas las cuentas.",
        "Si hay plata separada para proyectos, arriba aparecen tres cifras: «Saldo total», «Comprometido en proyectos» y «Saldo libre».",
        "Los botones grandes «Vender» y «Anotar ingreso o gasto» llevan al Cobrador y al recuadro para cargar un movimiento.",
      ],
    },
    {
      titulo: "Buscá un movimiento en el libro",
      texto: [
        "Entrá a Caja → «Movimientos». Ahí está todo lo que entró y salió, de lo más nuevo a lo más viejo.",
        "Usá el buscador (busca por descripción, comprobante o cliente) y los filtros: Cuenta, Rubro, Tipo, Medio de pago, Origen, Cliente y Período.",
        "«Origen» dice de dónde vino el movimiento: «Carga manual», «Ventas», «Pedidos», «Comisión de Mercado Pago», «Galerías» y otros.",
      ],
    },
    {
      titulo: "Anulá un movimiento mal cargado",
      texto: [
        "En la fila del movimiento escribí el «Motivo de la anulación» (por ejemplo: «lo cargué dos veces») y tocá «Anular».",
        "Después, si hace falta, cargalo de nuevo bien.",
      ],
      sistema: [
        "No borra nada: crea un movimiento igual y opuesto, con tu motivo, para que el saldo vuelva a estar bien y quede rastro de qué pasó.",
        "Si la cuenta tiene el turno abierto, la anulación entra en ese turno.",
      ],
      nota: "Algunos movimientos no se anulan acá. Una venta se anula desde Ventas → «Ventas hechas». El cobro de un trabajo se anula desde la ficha del pedido (en la fila dice «Este cobro se anula desde el pedido.»). Un pase se deshace con el pase al revés.",
    },
    {
      titulo: "Pasá plata de una cuenta a otra",
      texto: [
        "Entrá a Caja → «Pases entre cuentas».",
        "Elegí «De» (de dónde sale) y «A» (a dónde va), escribí el «Importe» y, si querés, una «Nota» con el motivo.",
        "Tocá «Pasar». Aparece «Pase hecho.» y el pase queda en el historial de abajo, con quién lo hizo.",
      ],
      sistema: ["Resta de una cuenta y suma en la otra. No cuenta como gasto ni como ingreso en los reportes."],
      nota: "No deja pasar más plata de la que hay en la cuenta de origen: aparece «No podés pasar más dinero del que hay en esa cuenta.».",
    },
    {
      titulo: "Mirá los reportes",
      texto: [
        "Entrá a Caja → «Reportes». Arranca en «Este mes»; también están «El mes pasado» y «Últimos 30 días», o elegí «Desde», «Hasta» y una «Cuenta» y tocá «Ver este rango».",
        "Vas a ver el saldo de hoy por cuenta, el «Resumen del período» (Entró, Salió, Neto), los ingresos y egresos por categoría, los clientes que más compraron y el margen de las ventas.",
      ],
    },
  ],
};
