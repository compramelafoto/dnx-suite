import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-transferencia-y-qr",
  titulo: "Cobrar por transferencia o con el QR",
  resumen:
    "Pasarle al cliente el alias y el CVU, comprobar en el momento que la transferencia llegó y cobrar con el QR de Mercado Pago del mostrador.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Transferencia: pasale los datos",
      texto: [
        "Con el ticket armado, tocá «Transferencia».",
        "Aparecen «Alias», «CBU / CVU» y «Monto», cada uno con su botón «Copiar» (cambia a «Copiado»), además del titular y el banco. Dictáselos o copialos para mandárselos por WhatsApp.",
      ],
      nota: "Si dice «Todavía no cargaste el alias ni el CVU del negocio.», los datos se cargan en Configuración → Presupuestos, en «Datos para transferir». Lo hace quien administra FOTOFFICE.",
    },
    {
      titulo: "Comprobá que llegó",
      texto: [
        "Cuando el cliente diga que transfirió, tocá «Verificar pago de $…».",
        "Si encuentra el pago aparece «Pago recibido: $…», con de quién es, la hora y el medio. Si no era ese, tocá «Quitar».",
        "Si hay varios pagos por el mismo monto aparece «Hay N pagos por ese monto. Elegí el de este cliente:». Tocá el que corresponde por el nombre de quien pagó.",
        "Si todavía no llegó: «Todavía no llegó ningún pago de $… en las últimas dos horas.». Esperá un minuto y tocá «Buscar de nuevo».",
      ],
      sistema: [
        "Busca en la cuenta de Mercado Pago del negocio un cobro por ese monto exacto de las últimas 2 horas que no se haya usado en otra venta.",
        "Al cobrar, reserva ese pago: la misma transferencia no puede usarse para dos ventas («Esa transferencia ya se usó en otro cobro.»).",
      ],
      nota: "Verificar es opcional y sólo funciona si la cuenta de Mercado Pago del negocio está conectada. Si dice «Mercado Pago no está conectado.» o «Mercado Pago no respondió.», mirá el comprobante en el celular del cliente y cobrá igual.",
    },
    {
      titulo: "Cobrá la transferencia",
      texto: ["Tocá «Cobrar $…». La venta se registra igual que en efectivo."],
      sistema: ["El ingreso va a la cuenta digital, no a la caja del mostrador: no cambia el «Debería haber» del cajón."],
    },
    {
      titulo: "QR del mostrador: mostrale el monto",
      texto: [
        "Tocá «Mercado Pago». Si el QR del mostrador está activo, aparece el botón «Cobrar $… con el QR». Tocalo (dice «Preparando el QR…»).",
        "La pantalla cambia a «Que escaneen el QR del mostrador», con el monto en grande y «Esperando el pago…».",
        "El cliente escanea con su celular el QR impreso del mostrador y paga. No tiene que escribir el monto: ya le aparece.",
      ],
    },
    {
      titulo: "Esperá la confirmación",
      texto: [
        "Cuando se acredita aparece «Pagado con QR.» y la venta se registra sola. No toques nada más.",
        "Si el cliente se arrepiente, tocá «Cancelar». Si ya está pagando, avisa «El cliente ya está pagando: esperá a que termine.».",
      ],
      sistema: [
        "Consulta a Mercado Pago cada 3 segundos.",
        "Si cambiás el ticket mientras espera, cancela el cobro («El ticket cambió: volvé a mostrar el monto en el QR.»).",
        "A los 10 minutos sin pago, el cobro vence solo.",
      ],
      nota: "Si el QR no está activo, la pantalla dice «Que escanee el QR de Mercado Pago del mostrador y pague $…»: el cliente escribe el monto y vos lo comprobás con «Verificar pago».",
    },
  ],
};
