import {
  DEFAULT_RANDOM_COUNT, MAX_WORKS, isOnlineExhibited, isProfileExhibited, isRandomRotation, isRoomExhibited, isVisibilityPreset,
  parseVisibility, visibilityFromPreset, type Visibility,
} from "@repo/muestras";

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const casilla = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  return v === "on" || v === "1" || v === "true";
};

/** Cantidad al azar: un entero de 1 en adelante (sin tope propio; nunca más que el tope técnico). */
function cantidad(raw: string): number {
  if (!/^\d{1,6}$/.test(raw)) return DEFAULT_RANDOM_COUNT;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, MAX_WORKS) : DEFAULT_RANDOM_COUNT;
}

/**
 * El ajuste que eligió quien organiza (spec D20, D21). Un preset reescribe todo y conserva la semilla
 * (así "Adelanto" no cambia de obras por volver a guardarlo). "Personalizado" lee cada opción: una
 * casilla ausente es "no". El resultado pasa por `parseVisibility`, que le pone el nombre del preset
 * si coincide con uno.
 */
export function visibilidadDesdeFormData(fd: FormData, actual: Visibility): Visibility {
  const preset = txt(fd, "preset");
  const seed = actual.online.seed;
  if (isVisibilityPreset(preset) && preset !== "CUSTOM") return visibilityFromPreset(preset, seed);
  const on = txt(fd, "onlineExhibited");
  const rot = txt(fd, "rotation");
  const perfil = txt(fd, "profileExhibited");
  const sala = txt(fd, "roomExhibited");
  const v: Visibility = {
    v: 1,
    preset: "CUSTOM",
    online: {
      exhibited: isOnlineExhibited(on) ? on : actual.online.exhibited,
      randomCount: cantidad(txt(fd, "randomCount")),
      rotation: isRandomRotation(rot) ? rot : "FIXED",
      seed,
      artists: casilla(fd, "artists"),
    },
    profile: { exhibited: isProfileExhibited(perfil) ? perfil : actual.profile.exhibited },
    room: {
      exhibited: isRoomExhibited(sala) ? sala : actual.room.exhibited,
      portfolio: casilla(fd, "roomPortfolio"),
      otherExhibitions: casilla(fd, "roomOtherExhibitions"),
      buy: casilla(fd, "roomBuy"),
    },
    revealAfterClose: casilla(fd, "revealAfterClose"),
  };
  return parseVisibility(JSON.parse(JSON.stringify(v)), "HIGHLIGHTS_UNTIL_CLOSED");
}

/** El `galleryMode` coherente con el ajuste (lo leen las piezas que todavía no conocen la sorpresa). */
export const modoDeGaleriaDe = (v: Visibility) => (v.online.exhibited === "ALL" ? "FULL" : "HIGHLIGHTS_UNTIL_CLOSED");
