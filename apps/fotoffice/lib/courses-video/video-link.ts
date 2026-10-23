/**
 * El enlace que el fotógrafo pega, convertido en uno que el proveedor pueda bajar.
 *
 * Lo habitual es un enlace de Google Drive para ver el archivo (`/file/d/<id>/view`), que
 * devuelve una página y no el video. Para Drive se arma la descarga directa con `confirm=t`,
 * que saltea el aviso de "no se pudo analizar en busca de virus" de los archivos grandes. El
 * archivo tiene que estar compartido con "Cualquier persona con el enlace".
 *
 * Una carpeta no sirve: hay que pegar el enlace de un archivo.
 */
export type EnlaceDeVideo = { ok: true; url: string } | { ok: false; error: string };

const ID_DE_DRIVE = /^[A-Za-z0-9_-]{10,}$/;

export function enlaceDeDescargaDirecta(entrada: string): EnlaceDeVideo {
  const texto = entrada.trim();
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, error: "Pegá un enlace completo, que empiece con https://." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "El enlace tiene que empezar con https://." };
  }

  const host = url.hostname.toLowerCase();
  if (host === "drive.google.com" || host === "drive.usercontent.google.com") {
    if (url.pathname.includes("/folders/")) {
      return {
        ok: false,
        error: "Ese enlace es de una carpeta. Abrí el video y copiá el enlace del archivo.",
      };
    }
    const id =
      url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ??
      url.searchParams.get("id") ??
      null;
    if (!id || !ID_DE_DRIVE.test(id)) {
      return { ok: false, error: "No encontré el archivo en ese enlace de Google Drive." };
    }
    return {
      ok: true,
      url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    };
  }

  return { ok: true, url: url.toString() };
}
