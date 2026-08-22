#!/usr/bin/env bash
# Copia los assets de la demo comercial a las cuatro apps para poder verlos en
# local. No se versionan dentro de `apps/*/public/` a propósito: son material de
# demostración y no deben viajar al bundle de producción.
#
# Uso:  bash docs/partners/demo-comercial/sync-assets.sh
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
src="$root/docs/partners/demo-comercial/assets"
for app in clickaton fotorank infospot compramelafoto; do
  dest="$root/apps/$app/public/partners-demo"
  mkdir -p "$dest"
  cp "$src"/* "$dest/"
  echo "  $app  ← $(ls -1 "$dest" | wc -l | tr -d ' ') archivos"
done
echo "Listo. Para quitarlos: rm -rf apps/*/public/partners-demo"
