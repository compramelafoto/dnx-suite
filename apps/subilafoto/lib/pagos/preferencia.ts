/**
 * La preferencia de pago que se manda a Mercado Pago.
 *
 * Se arma acá, aparte de la llamada, porque **es la pieza donde un error se
 * paga con plata del cliente**: un factor de cien mal puesto cobra cien veces
 * de más y se descubre con la primera compra. Separada, se puede probar sin
 * hablar con nadie.
 *
 * Mercado Pago trabaja en unidades —pesos— y nosotros en centavos enteros. La
 * conversión ocurre en un solo lugar: acá.
 */

export type DatosDePreferencia = {
  titulo: string;
  montoCents: number;
  /** Lo que se queda la plataforma. Va como `marketplace_fee`. */
  comisionCents: number;
  ordenId: string;
  compradorEmail: string;
  compradorNombre: string;
  /** Origen de la aplicación, para armar las vueltas. */
  base: string;
};

export type Preferencia = {
  items: { title: string; quantity: number; unit_price: number; currency_id: string }[];
  payer: { name: string; email: string };
  marketplace_fee: number;
  external_reference: string;
  notification_url: string;
  back_urls: { success: string; failure: string; pending: string };
  auto_return: "approved";
  statement_descriptor: string;
};

function aPesos(centavos: number): number {
  // Dos decimales exactos: dividir y dejar el flotante suelto arrastra errores
  // que Mercado Pago rechaza por monto inválido.
  return Math.round(centavos) / 100;
}

export function armarPreferencia(datos: DatosDePreferencia): Preferencia {
  if (!Number.isInteger(datos.montoCents) || datos.montoCents <= 0) {
    throw new Error("El monto tiene que ser un entero de centavos mayor que cero.");
  }
  if (!Number.isInteger(datos.comisionCents) || datos.comisionCents < 0) {
    throw new Error("La comisión tiene que ser un entero de centavos.");
  }
  if (datos.comisionCents > datos.montoCents) {
    throw new Error("La comisión no puede ser mayor que el monto de la venta.");
  }

  return {
    items: [
      {
        title: datos.titulo.slice(0, 250),
        quantity: 1,
        unit_price: aPesos(datos.montoCents),
        currency_id: "ARS",
      },
    ],
    payer: { name: datos.compradorNombre.slice(0, 100), email: datos.compradorEmail },
    marketplace_fee: aPesos(datos.comisionCents),
    // Por acá el webhook encuentra la orden. Sin esto, un aviso de pago no se
    // puede asociar a nada.
    external_reference: datos.ordenId,
    notification_url: `${datos.base}/api/pagos/aviso`,
    back_urls: {
      success: `${datos.base}/compra/${datos.ordenId}/gracias`,
      failure: `${datos.base}/compra/${datos.ordenId}/error`,
      pending: `${datos.base}/compra/${datos.ordenId}/gracias`,
    },
    auto_return: "approved",
    // Lo que ve el comprador en el resumen de la tarjeta.
    statement_descriptor: "SUBILAFOTO",
  };
}
