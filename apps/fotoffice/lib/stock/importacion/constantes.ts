/** Topes y formato de la importación de facturas (stock etapa 3). */
export const MAX_FILAS_CSV = 500;
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;
export const MAX_PAGINAS_PDF = 20;
export const MAX_CARACTERES_TEXTO = 20000;

/**
 * Topes de lo que se lee: la cantidad y las unidades por paquete van a columnas Int y los montos
 * a Decimal(12,2). Un número fuera de rango (una IA que confunde un código con una cantidad) no
 * debe romper el guardado: la cantidad pasa a inválida (se carga 1 con aviso) y el resto, a nulo.
 */
export const MAX_CANTIDAD = 100_000;
export const MAX_UNIDADES_POR_PAQUETE = 100_000;
export const MAX_MONTO = 9_999_999_999.99;

export const ENCABEZADO_CSV =
  "codigo_barras;codigo_proveedor;descripcion;cantidad;unidad;unidades_por_paquete;costo_unitario;alicuota_iva;tipo";
