/**
 * Estado compartido entre las partes de la Calle 3D dentro del loop de render
 * (sin pasar por React): dónde está cada peatón, para que los autos les frenen.
 */

import type { Vec2 } from "./street-layout";

export const streetRuntime: { walkers: Vec2[] } = {
  walkers: [],
};
