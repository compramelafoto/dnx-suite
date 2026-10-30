# Recuperador de tarjetas de FOTOFFICE

Programa de escritorio que rescata fotos y videos de una tarjeta de memoria aunque se hayan
borrado o la tarjeta se haya formateado. La tarjeta **sólo se lee**: el programa nunca escribe en
ella.

## Cómo funciona

1. Lee la tarjeta entera sector por sector (necesita permisos de administrador).
2. Reconoce cada archivo por su estructura interna, sin depender del sistema de archivos:
   JPG (incluida la segunda imagen MPF de los celulares), RAW con estructura TIFF (CR2, NEF,
   ARW, DNG, ORF, RW2, PEF), RAF, CR3, HEIC y MP4/MOV (incluidos los videos con la grabación
   cortada).
3. Guarda lo recuperado en `~/FOTOFFICE Recuperadas/<caso> <fecha>/` (en Windows, en el
   Escritorio), separado en Fotos JPG / Fotos RAW / Fotos HEIC / Videos.
4. Si se conectó con el código de un caso, manda a FOTOFFICE una miniatura de 480 px y los datos
   de cada archivo. Las fotos completas nunca salen de la computadora.

Un sector ilegible no corta el escaneo: se reintenta de a un sector y se cuenta.

Límite conocido: recupera archivos guardados de forma contigua, que es como escriben las
cámaras. Un archivo fragmentado (raro en tarjetas de cámara) sale cortado o no sale.

## Uso

```
fotoffice-recuperar [CODIGO]               # tarjeta conectada
fotoffice-recuperar --origen imagen.dmg    # una imagen de disco, sin permisos especiales
fotoffice-recuperar --listar               # sólo listar las tarjetas detectadas
```

`--servidor` cambia la dirección de FOTOFFICE y `--destino` la carpeta de salida.

## Publicar una versión

1. Subí `version` en `main.go` y `VERSION_PROGRAMA` en
   `apps/fotoffice/lib/recuperacion/constantes.ts` (tienen que coincidir).
2. Corré `./publicar.sh`: prueba, compila para Mac (Apple e Intel), Windows y Linux, y sube a
   `fotoffice-media/fotoffice/herramientas/recuperador/<versión>/` con wrangler.
3. Fusioná el cambio de `VERSION_PROGRAMA`: desde ahí el panel ofrece la versión nueva.

`go test ./...` simula tarjetas formateadas y sectores dañados.
