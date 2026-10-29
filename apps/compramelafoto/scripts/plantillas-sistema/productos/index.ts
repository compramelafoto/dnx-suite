import type { ModeloProducto } from "./tipo";
import { DIPLOMAS } from "./diplomas";

/** Todos los productos que no son libritos, en el orden en que se listan. */
export const PRODUCTOS: ModeloProducto[] = [...DIPLOMAS];
