export const PRINT_ORDERS_MODULE_KEY = "print-orders";

/** Estados del pedido. Texto y no enum: el schema lo comparten varias bases. */
export const ESTADOS_PEDIDO = [
  "PENDIENTE_PAGO",
  "PAGADO",
  "PREPARANDO",
  "ENVIADO",
  "PAGADO_SIN_ENVIAR",
  "CANCELADO",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const PREFIJO_REFERENCIA_IMPRESION = "fo-impresion:";
export const PAPELES = ["BRILLO", "MATE"] as const;
export type Papel = (typeof PAPELES)[number];
export const ETIQUETA_PAPEL: Record<Papel, string> = { BRILLO: "Brillo", MATE: "Mate" };

/** Lista inicial: hasta 20x30 Fotolag, más grande La Isla (nombres de `FotofficeProveedor`). */
export const TAMANOS_INICIALES: readonly { widthCm: number; heightCm: number; proveedor: string }[] = [
  { widthCm: 10, heightCm: 15, proveedor: "Fotolag" },
  { widthCm: 13, heightCm: 18, proveedor: "Fotolag" },
  { widthCm: 15, heightCm: 21, proveedor: "Fotolag" },
  { widthCm: 20, heightCm: 25, proveedor: "Fotolag" },
  { widthCm: 20, heightCm: 30, proveedor: "Fotolag" },
  { widthCm: 30, heightCm: 40, proveedor: "La Isla" },
  { widthCm: 30, heightCm: 45, proveedor: "La Isla" },
  { widthCm: 40, heightCm: 50, proveedor: "La Isla" },
  { widthCm: 50, heightCm: 70, proveedor: "La Isla" },
];

export const PPP_MINIMO = 150;
export const DIAS_HABILES_PROMETIDOS = 2;
export const CIRCUITO_POR_OMISION = "Impresiones a laboratorio";
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/tiff"] as const;
