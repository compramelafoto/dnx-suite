# Proteccion de contenido en albums

## Que se protege (Fase 1)
- Bloqueo basico de drag & drop sobre fotos.
- Bloqueo de click derecho (context menu) en el grid.
- Evitar seleccion de texto/imagenes en el contenedor.
- Deteccion de atajos de captura (PrintScreen, Cmd+Shift+3/4/5, Ctrl+Shift+S) con overlay temporal.
- URLs de previews servidas con signed URLs de R2 (expiran en 90s).
- Respuestas del endpoint de fotos con `Cache-Control: private, no-store`.

## Fase 2 (implementado)
- Watermark dinamico por viewer, con identificador y timestamp.
- Previews generadas server-side con Sharp:
  - No comprados: baja resolucion (max 1200px) + watermark fuerte repetido.
  - Comprados: watermark sutil opcional (por ahora via flag global).
- Cache de variantes watermark en R2 con TTL por buckets temporales.
- Rate limit por IP + session para evitar scraping masivo.
- Impacto performance: la primera vista genera la variante, luego se sirve desde cache.
- Configuracion: `WATERMARK_BOUGHT_ENABLED=true` para habilitar watermark sutil en compradas.

## Hardening basico
- CSP basica configurada para reducir riesgos de inyecciones.
- Hotlink protection ligera no evita copias completas; solo desincentiva.

## Que NO se puede garantizar
- Capturas del sistema operativo (PrintScreen, grabaciones de pantalla, camaras externas).
- Copias por herramientas externas que rendericen el DOM.

## Fase 3 (propuesta)
- Endpoint protegido `/api/photos/[id]/view` con validacion de permisos avanzada.
- Configuracion granular por album/fotografo (intensidad, estilo, watermark comprado).
- Streaming protegido con tokens por sesion.
- Deteccion de patrones sospechosos (descargas masivas).
- Integracion con auditoria y alertas.
