import { PORTFOLIO_TEXT_LIMITS } from "@repo/muestras";
import { esImagenDeUsuario } from "@/lib/envios/mapear";

export type FotoDePortfolioForm = {
  id: string | null;
  imageUrl: string | null;
  /** Llegó una dirección de imagen que no subió esta persona (o no es nuestra). */
  imagenAjena: boolean;
  title: string;
  year: number | null;
  technique: string | null;
  caption: string | null;
};

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
/** Recorta un poco más allá del tope: así `portfolioPhotoProblems` todavía avisa si se pasó. */
const corto = (s: string, max: number) => s.slice(0, max + 1);
const opcional = (s: string, max: number) => (s ? corto(s, max) : null);

/**
 * Una foto del portfolio desde el formulario (spec D13). La imagen sólo vale si la subió la persona
 * (o, para el super admin, la dueña del perfil): `<R2>/muestras/<userId>/<id>.webp`.
 */
export function fotoDePortfolioDesdeFormData(fd: FormData, base: string | null, userId: number | readonly number[]): FotoDePortfolioForm {
  const ids = typeof userId === "number" ? [userId] : userId;
  const url = txt(fd, "imageUrl");
  const valida = !!url && ids.some((u) => esImagenDeUsuario(url, base, u));
  const anio = txt(fd, "year");
  const id = txt(fd, "id");
  return {
    id: /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null,
    imageUrl: valida ? url : null,
    imagenAjena: !!url && !valida,
    title: corto(txt(fd, "title"), PORTFOLIO_TEXT_LIMITS.title),
    year: /^\d{4}$/.test(anio) ? Number(anio) : null,
    technique: opcional(txt(fd, "technique"), PORTFOLIO_TEXT_LIMITS.technique),
    caption: opcional(txt(fd, "caption"), PORTFOLIO_TEXT_LIMITS.caption),
  };
}
