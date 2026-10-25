/**
 * Se importa primero en los lienzos 3D: en el celular instala el achique de
 * texturas antes de que cualquier modelo empiece a bajar.
 */

import { installTextureCap, mobileTextureCap } from "./mobile-textures";
import { isTouchGameDevice } from "./touch-input";

if (typeof window !== "undefined" && isTouchGameDevice()) installTextureCap(mobileTextureCap());
