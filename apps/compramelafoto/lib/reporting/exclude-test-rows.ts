/** Filtros para métricas y listados “reales” (excluye checkout TEST FASE 2). */
export const excludeTestOrderWhere = { isTest: false as const };
export const excludeTestPreCompraOrderWhere = { isTest: false as const };
