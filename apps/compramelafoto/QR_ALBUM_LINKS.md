# QR y links de álbum

Esta sección describe los QRs que se generan en el panel del álbum y qué URL usan.

## Links incluidos
- Álbum público: `APP_URL/a/[publicSlug]`
- Landing del fotógrafo: `APP_URL/f/[publicPageHandler]` (si existe)
- Compra de fotos: `APP_URL/a/[albumId]/comprar`

## Generación
- Se generan en cliente usando `https://api.qrserver.com/v1/create-qr-code/`.
- El tamaño por defecto es 320x320.
- Si falta alguno de los links (por ejemplo, el fotógrafo no tiene handler), se muestra un placeholder informativo.
