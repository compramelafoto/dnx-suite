import { getFotofficeR2PublicUrl } from "@/lib/images/r2-client";
import { VERSION_PROGRAMA } from "./constantes";

/**
 * Dónde están los ejecutables del programa: en el bucket público, una carpeta por versión. Se
 * suben a mano con `tools/recuperador-tarjetas/publicar.sh` cuando cambia `VERSION_PROGRAMA`.
 */
export const PLATAFORMAS = {
  "mac-arm64": "fotoffice-recuperar-mac-arm64",
  "mac-amd64": "fotoffice-recuperar-mac-amd64",
  "linux-amd64": "fotoffice-recuperar-linux-amd64",
  windows: "FOTOFFICE-Recuperar.exe",
} as const;
export type Plataforma = keyof typeof PLATAFORMAS;

export function esPlataforma(v: string): v is Plataforma {
  return Object.prototype.hasOwnProperty.call(PLATAFORMAS, v);
}

export function urlDelPrograma(p: Plataforma): string {
  return getFotofficeR2PublicUrl(`fotoffice/herramientas/recuperador/${VERSION_PROGRAMA}/${PLATAFORMAS[p]}`);
}

/**
 * El script que corre `curl … | sh -s CODIGO`: elige el ejecutable según la Mac (Apple o Intel),
 * lo baja a una carpeta temporal y lo corre. La entrada del programa se toma de la terminal
 * (`/dev/tty`), porque la del script es el propio `curl`.
 */
export function scriptDeInstalacion(base: string): string {
  return `#!/bin/sh
# FOTOFFICE · Recuperación de tarjetas
set -e
SO=$(uname -s)
ARQ=$(uname -m)
case "$SO-$ARQ" in
  Darwin-arm64) P=mac-arm64 ;;
  Darwin-x86_64) P=mac-amd64 ;;
  Linux-x86_64) P=linux-amd64 ;;
  *) echo "Este equipo ($SO $ARQ) no está soportado todavía."; exit 1 ;;
esac
DIR=$(mktemp -d)
BIN="$DIR/fotoffice-recuperar"
echo "Bajando el programa de FOTOFFICE…"
curl -fsSL "${base}/api/recuperacion/programa/$P" -o "$BIN"
chmod +x "$BIN"
"$BIN" "$@" </dev/tty
`;
}
