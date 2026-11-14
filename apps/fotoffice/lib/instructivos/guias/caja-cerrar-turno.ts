import type { Instructivo } from "../tipos";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";

export const guia: Instructivo = {
  slug: "caja-cerrar-turno",
  titulo: "Cerrar la caja y hacer el arqueo",
  resumen:
    "Contar lo que quedó en el cajón, compararlo con lo que el sistema espera, explicar la diferencia si la hay, dejar el cambio y guardar el resto en la Caja Fuerte.",
  seccion: "Caja",
  moduleKey: CASH_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Antes de contar, cargá todo lo del día",
      texto: [
        "Revisá que estén anotados los gastos que se pagaron con plata del cajón (insumos, un delivery, un retiro). Si falta alguno, cargalo primero: mirá la guía «Anotar un gasto o un retiro».",
        "Si cerrás sin anotarlo, la caja va a dar faltante.",
      ],
    },
    {
      titulo: "Tocá «Cerrar contando billetes»",
      texto: [
        "Entrá a Caja → «Panorama». En la tarjeta de la Caja registradora vas a ver «Turno abierto» y «Debería haber $…».",
        "Tocá el botón naranja «Cerrar contando billetes». Es la forma recomendada: en una sola pantalla contás, dejás el cambio, guardás el resto en la Caja Fuerte y cerrás.",
      ],
      imagen: "/instructivos/caja-cerrar-turno/01-turno-abierto.jpg",
      imagenAlt:
        "Tarjeta de la Caja registradora con el turno abierto: desde cuándo y con qué fondo, «Debería haber», el botón «Cerrar contando billetes» y, debajo, el cierre rápido escribiendo el total.",
    },
    {
      titulo: "Contá billete por billete",
      texto: [
        "Escribí cuántos billetes hay de cada uno. Las monedas van en «Monedas (opcional)».",
        "A la derecha (en el teléfono, abajo) ves «Contado», «Esperado según el sistema» y la «Diferencia».",
      ],
    },
    {
      titulo: "Dejá el cambio y guardá el resto en la Caja Fuerte",
      texto: [
        "En «Dejar de cambio en el mostrador» escribí cuánto queda en el cajón para dar vuelto mañana.",
        "«A la Caja Fuerte» muestra el resto. Dejá marcado «Registrar el pase de $… a Caja Fuerte» y guardá esa plata en la Caja Fuerte.",
      ],
      sistema: [
        "Anota la salida de la Caja registradora y la entrada en la Caja Fuerte como un pase. No cuenta como gasto en los reportes.",
        "Mañana, al abrir, la Caja registradora va a tener anotado justo el cambio que dejaste: si contás lo mismo, no hay ajuste.",
      ],
      nota: "Si guardás plata en la Caja Fuerte sin registrar el pase, mañana al abrir va a aparecer un «Faltante al abrir el turno» por ese importe.",
    },
    {
      titulo: "Si no cuadra, explicá por qué",
      texto: [
        "Si la diferencia no es cero, escribí el motivo en «¿Por qué no cuadra?» (por ejemplo: «di vuelto de más a un cliente», «faltó anotar la compra de pilas»).",
        "Dejá marcado «Registrar el sobrante como ingreso» (o «el faltante como egreso»): así el saldo de la caja dice lo que de verdad hay.",
      ],
      nota: "Antes de explicar una diferencia, fijate si no falta cargar un gasto del día: es la causa más común.",
    },
    {
      titulo: "Cerrá el turno",
      texto: ["Tocá «Cerrar turno con este conteo». Arriba aparece «Turno cerrado.» con lo contado, lo pasado a la Caja Fuerte y la diferencia."],
      sistema: [
        "Calcula lo esperado: fondo con el que abriste + lo que entró − lo que salió de esa caja durante el turno.",
        "Guarda lo esperado, lo contado y la diferencia (si sobra es positiva; si falta, negativa), con tu explicación, quién cerró y el detalle por billete.",
        "Esos números quedan congelados: aunque mañana alguien anule una venta de hoy, el arqueo de hoy no cambia.",
      ],
    },
    {
      titulo: "Cierre rápido (sin contador)",
      texto: [
        "Si ya tenés el total contado, en la misma tarjeta escribilo en «O escribí el total contado», explicá la diferencia si la hay y tocá «Cerrar turno».",
        "Después te ofrece pasar el sobrante a la Caja Fuerte: tocá «Sí, pasar» o «Ahora no».",
      ],
      imagen: "/instructivos/caja-cerrar-turno/02-contar.jpg",
      imagenAlt: "El contador de billetes del cierre rápido con las cantidades cargadas y el total pasado al campo.",
      nota: "Este cierre no corrige el saldo por la diferencia: queda anotada en el arqueo, y el ajuste se hace solo al abrir el próximo turno.",
    },
    {
      titulo: "Revisá los arqueos anteriores",
      texto: [
        "En Caja → «Arqueos» está cada turno: cuenta, cuándo se abrió, quién abrió y quién cerró, lo esperado, lo contado, la diferencia y la explicación.",
        "Las filas con diferencia aparecen en rojo. Un turno que nadie cerró dice «Sigue abierto».",
      ],
    },
  ],
};
