/** Topes y formato de la importación de facturas (stock etapa 3). */
export const MAX_FILAS_CSV = 500;
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;
export const MAX_PAGINAS_PDF = 20;
export const MAX_CARACTERES_TEXTO = 20000;

export const ENCABEZADO_CSV =
  "codigo_barras;codigo_proveedor;descripcion;cantidad;unidad;unidades_por_paquete;costo_unitario;alicuota_iva;tipo";
