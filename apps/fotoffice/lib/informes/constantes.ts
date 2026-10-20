/**
 * Informes (etapa 6). Módulo PURO: constantes compartidas por los cálculos y las pantallas.
 */
import { MODULO_CAJA_PEDIDOS } from "@/lib/pedidos/constantes";

export const REPORTS_MODULE_KEY = "reports";

/**
 * Mismo valor que `MODULO_CAJA_PAGOS` de `lib/pedidos/cuentas-pagar.ts` (ese archivo es
 * `server-only` y no se puede importar desde un cálculo puro). Una prueba comprueba que no se desfasen.
 */
export const MODULO_CAJA_PAGOS_INFORMES = "pedidos-pagos";

/** Los movimientos de Caja que ya están contados por los pedidos y las cuentas a pagar (base devengada). */
export const MODULOS_CAJA_DE_PEDIDOS: readonly string[] = [MODULO_CAJA_PEDIDOS, MODULO_CAJA_PAGOS_INFORMES];

export const MAX_MESES_RESULTADOS = 24;
export const MAX_MOVIMIENTOS_INFORME = 50_000;
export const MAX_FILAS_CUOTAS_Y_CUENTAS = 20_000;
export const AVISO_DEMASIADOS_DATOS = "Hay demasiados datos para este período, achicá el rango";

export const LEYENDA_MONOTRIBUTO = "Control interno con lo registrado en Caja. No reemplaza la facturación informada a ARCA.";
