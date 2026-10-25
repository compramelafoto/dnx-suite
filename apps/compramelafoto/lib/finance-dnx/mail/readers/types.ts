export type MailKind = "FACTURA" | "PAGO_OK" | "PAGO_FALLIDO" | "ESTIMADO" | "RECIBO" | "REEMBOLSO";

export type MailInput = { fromAddress: string; subject: string; bodyText: string; receivedAt: Date };

/** Lo que dice un mail de un proveedor, sin interpretar todavía contra los gastos cargados. */
export type ParsedDoc = {
  kind: MailKind;
  /** En la moneda original. null cuando el mail no lo trae (un pago fallido de Cloudflare, un pago recibido de Neon). */
  amount: number | null;
  currency: "USD" | "ARS";
  invoiceNumber: string | null;
  /** Fecha del documento: de pago, de factura o del mail. Define el dólar del día. */
  docDate: Date;
  paidAt: Date | null;
  /** Mes al que pertenece el gasto (el de la factura o del servicio, no el del pago). */
  periodYear: number;
  periodMonth: number;
  /** Sólo en REEMBOLSO: lo devuelto. */
  refunded: number | null;
  /** Si el contenido revela otro proveedor con el mismo remitente (Anthropic API vs. suscripción). */
  vendorKey: string | null;
};

/**
 * `docs`: lo que se leyó. `ignore`: no es un cobro (aviso, promoción, código); `alert` pide avisar igual.
 * `null`: no se reconoce el formato y no se inventa nada: queda para revisar a mano.
 */
export type ReadResult = { docs: ParsedDoc[] } | { ignore: string; alert?: string } | null;
