import type { Instructivo } from "../tipos";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";

export const guia: Instructivo = {
  slug: "caja-cerrar-turno",
  titulo: "Cerrar la caja y hacer el arqueo",
  resumen:
    "Contar lo que quedó en el cajón, compararlo con lo que el sistema espera, explicar la diferencia si la hay y guardar el sobrante en la caja fuerte.",
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
      titulo: "Contá el efectivo",
      texto: [
        "Entrá a Caja → «Panorama». En la tarjeta del mostrador vas a ver «Turno abierto» y «Debería haber $…».",
        "Contá todo el efectivo del cajón. Podés usar «Contar» para sumarlo billete por billete.",
        "Escribí el total en «Cuánto contaste».",
      ],
    },
    {
      titulo: "Si no cuadra, explicá por qué",
      texto: [
        "Si lo contado no es igual a «Debería haber», el sistema pide una explicación. Escribila en «Si no cuadra, explicá por qué» (por ejemplo: «di vuelto de más a un cliente», «faltó anotar la compra de pilas»).",
        "Si cuadra justo, el campo se puede dejar vacío.",
      ],
      nota: "Sin explicación no te deja cerrar: aparece «La caja no cuadra. Explicá la diferencia antes de cerrar.».",
    },
    {
      titulo: "Cerrá el turno",
      texto: ["Tocá «Cerrar turno». Te lleva a la pantalla «Arqueos»."],
      sistema: [
        "Calcula lo esperado: fondo con el que abriste + lo que entró − lo que salió de esa caja durante el turno.",
        "Guarda lo esperado, lo contado y la diferencia (si sobra es positiva; si falta, negativa), con tu explicación y quién cerró.",
        "Esos números quedan congelados: aunque mañana alguien anule una venta de hoy, el arqueo de hoy no cambia.",
      ],
    },
    {
      titulo: "Guardá el sobrante en la caja fuerte",
      texto: [
        "Si el negocio tiene caja fuerte, después de cerrar aparece: «Contaste $… en [caja]. El fondo fijo de esa caja es $…».",
        "En «¿Pasás cuánto a [caja fuerte]?» ya viene escrito lo que sobra por encima del fondo fijo (lo que queda en el cajón para dar vuelto mañana). Cambialo si vas a guardar otro importe.",
        "Tocá «Sí, pasar» y guardá esa plata en la caja fuerte. Si hoy no la guardás, tocá «Ahora no».",
      ],
      sistema: [
        "Anota la salida de la caja del mostrador y la entrada en la caja fuerte como un «Pase de cierre de turno». No cuenta como gasto en los reportes.",
      ],
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
