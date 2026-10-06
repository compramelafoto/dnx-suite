/**
 * El link de la familia trae `?canje=<token>` en la galería. El token se guarda en el
 * navegador para que llegue hasta el resumen de compra aunque la familia navegue, vaya y
 * vuelva. localStorage y no sessionStorage: el link suele abrirse desde WhatsApp, y si la
 * familia lo cierra y vuelve a entrar a la galería el combo tiene que seguir ahí.
 */

export const CANJE_QUERY_PARAM = "canje";

const key = (albumId: number | string) => `album_${albumId}_canje_token`;

export function saveCanjeToken(albumId: number | string, token: string): void {
  try {
    window.localStorage.setItem(key(albumId), token);
  } catch {
    /* sin almacenamiento: el canje funciona mientras no se pierda la URL */
  }
}

export function readCanjeToken(albumId: number | string): string | null {
  try {
    const v = window.localStorage.getItem(key(albumId));
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearCanjeToken(albumId: number | string): void {
  try {
    window.localStorage.removeItem(key(albumId));
  } catch {
    /* nada que limpiar */
  }
}
