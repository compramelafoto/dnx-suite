import type { Instructivo } from "../tipos";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";

export const guia: Instructivo = {
  slug: "caja-abrir-turno",
  titulo: "Abrir la caja al empezar el día",
  resumen:
    "Contar el efectivo con el que arranca el mostrador y abrir el turno, para que al cierre el sistema sepa cuánto tendría que haber.",
  seccion: "Caja",
  moduleKey: CASH_MODULE_KEY,
  minutos: 3,
  pasos: [
    {
      titulo: "Entrá al Panorama de Caja",
      texto: [
        "En el menú de la izquierda abrí Caja y elegí «Panorama».",
        "Vas a ver una tarjeta por cada cuenta del negocio: la caja del mostrador, la caja fuerte y la cuenta digital (Mercado Pago o banco), cada una con su saldo.",
        "El turno se abre en la tarjeta que dice «Efectivo de mostrador». Las otras cuentas no llevan turno.",
      ],
      imagen: "/instructivos/caja-abrir-turno/01-panorama.jpg",
      imagenAlt:
        "Pantalla Caja con los botones Vender y Anotar ingreso o gasto y una tarjeta por cuenta: Caja diaria con su bloque de turno, Caja fuerte y Mercado Pago.",
      nota: "Si no ves el formulario para abrir el turno, tu usuario sólo puede mirar la Caja. Pedile a quien administra FOTOFFICE que te dé permiso para operarla.",
    },
    {
      titulo: "Contá el efectivo",
      texto: [
        "Contá los billetes y las monedas que hay en el cajón antes de la primera venta.",
        "Si querés que el sistema sume por vos, tocá «Contar» al lado del campo. Se abre un contador con un renglón por billete ($20.000, $10.000, $2.000, $1.000, $500, $200, $100) y otro para «Monedas u otro». Escribí cuántos billetes hay de cada uno; abajo aparece el «Total contado».",
        "Al cerrar el contador, el total queda escrito en el campo.",
      ],
      imagen: "/instructivos/caja-abrir-turno/02-contar.jpg",
      imagenAlt:
        "El contador de billetes abierto debajo del campo de importe: un renglón por billete con la cantidad y el subtotal de cada uno.",
    },
    {
      titulo: "Abrí el turno",
      texto: [
        "Si no usaste el contador, escribí el total en «Abrir turno: ¿cuánto efectivo hay?» (por ejemplo, 20.000).",
        "Tocá «Abrir turno». Arriba aparece «Listo.» en verde.",
      ],
      sistema: [
        "Guarda la hora, quién abrió el turno y con cuánto fondo arrancó.",
        "Desde ese momento suma o resta sola cada venta en efectivo, cada cobro de un trabajo y cada gasto que salga de esa caja.",
        "En la tarjeta muestra «Turno abierto», desde cuándo y «Debería haber $…»: lo que tendría que haber en el cajón en ese momento.",
      ],
      nota: "Abrí el turno antes de la primera venta. Se puede vender con el turno cerrado, pero esas ventas no entran en la cuenta del cierre y la caja después no cuadra.",
    },
    {
      titulo: "Si aparece un aviso",
      texto: [
        "«Esa caja ya tiene un turno abierto.»: alguien ya lo abrió (o quedó abierto de ayer). No abras otro: cerrá primero el anterior con lo que hay contado.",
        "«El importe de apertura no se entiende.»: escribí sólo números, con o sin puntos de miles.",
        "Si dejás el campo vacío, el turno se abre con $0.",
      ],
    },
  ],
};
