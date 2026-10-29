import type { ModeloProducto } from "./tipo";
import { DIPLOMAS } from "./diplomas";
import { CALENDARIOS } from "./calendarios";
import { OTROS } from "./otros";

/** Todos los productos que no son libritos, en el orden en que se listan. */
export const PRODUCTOS: ModeloProducto[] = [...DIPLOMAS, ...CALENDARIOS, ...OTROS];
