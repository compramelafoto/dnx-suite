#!/bin/sh
# Compila el recuperador para cada sistema y lo sube al bucket público de FOTOFFICE
# (fotoffice-media), en una carpeta por versión. La versión sale de main.go y tiene que
# coincidir con VERSION_PROGRAMA de apps/fotoffice/lib/recuperacion/constantes.ts.
# Uso: ./publicar.sh            (compila y sube)
#      ./publicar.sh --solo-compilar
set -e
cd "$(dirname "$0")"
V=$(sed -n 's/^var version = "\(.*\)"/\1/p' main.go)
TS=$(sed -n 's/^export const VERSION_PROGRAMA = "\(.*\)";/\1/p' ../../apps/fotoffice/lib/recuperacion/constantes.ts)
[ "$V" = "$TS" ] || { echo "La versión de main.go ($V) no coincide con VERSION_PROGRAMA ($TS)"; exit 1; }
go test ./...
mkdir -p dist
LD="-s -w"
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags "$LD" -o dist/fotoffice-recuperar-mac-arm64 .
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags "$LD" -o dist/fotoffice-recuperar-mac-amd64 .
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "$LD" -o dist/fotoffice-recuperar-linux-amd64 .
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "$LD" -o dist/FOTOFFICE-Recuperar.exe .
# macOS en Apple Silicon no ejecuta binarios sin firma: alcanza con la firma local (ad hoc).
command -v codesign >/dev/null && codesign -s - -f dist/fotoffice-recuperar-mac-arm64 dist/fotoffice-recuperar-mac-amd64
ls -la dist
[ "$1" = "--solo-compilar" ] && exit 0
for f in dist/*; do
  npx --yes wrangler r2 object put "fotoffice-media/fotoffice/herramientas/recuperador/$V/$(basename "$f")" \
    --file "$f" --content-type application/octet-stream --remote
done
