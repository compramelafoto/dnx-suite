# Procesamiento de Imágenes - Documentación

## Resumen de Modificaciones al Subir Fotos

Cuando se sube una foto, el sistema realiza las siguientes modificaciones:

### 1. **Versión Preview (con marca de agua)**
- **Redimensionamiento**: Se reduce a máximo 1000px de ancho (manteniendo proporción)
- **Rotación**: Se aplica rotación automática basada en EXIF Orientation
- **Marca de agua**: 
  - Logo PNG en grid 3x3 (9 marcas de agua)
  - Texto "@compramelafoto.com" centrado
- **Formato**: Conversión a JPEG con calidad 70%
- **Metadatos**: 
  - ✅ **PRESERVADOS**: Todos los metadatos EXIF originales (cámara, fecha, GPS, copyright, autor, etc.)
  - ✅ **AGREGADOS**: DPI 72 y perfil ICC Adobe RGB (si está disponible)

### 2. **Versión Original (sin marca de agua)**
- **Rotación**: Se aplica rotación automática basada en EXIF Orientation
- **Formato**: Conversión a JPEG con calidad 100%
- **Sin redimensionamiento**: Se mantiene el tamaño original
- **Metadatos**: 
  - ✅ **PRESERVADOS**: Todos los metadatos EXIF originales (cámara, fecha, GPS, copyright, autor, etc.)
  - ✅ **AGREGADOS**: DPI 300 para impresión

## Metadatos Preservados

Los siguientes metadatos EXIF se preservan en ambas versiones (preview y original):

- **Información de la cámara**: Marca, modelo, lente
- **Configuración de la foto**: ISO, apertura (f/stop), velocidad de obturación, modo de exposición
- **Fecha y hora**: Fecha de captura original
- **GPS**: Coordenadas geográficas (si están presentes)
- **Copyright**: Información de derechos de autor
- **Autor/Fotógrafo**: Información del creador de la imagen
- **Software**: Información del software usado para procesar la imagen
- **Otros metadatos EXIF**: Cualquier otro dato presente en la imagen original

## Optimizaciones para Velocidad

1. **Procesamiento en memoria**: No se escriben archivos temporales en disco
2. **Procesamiento paralelo**: Preview y original se procesan en paralelo cuando es posible
3. **Redimensionamiento optimizado**: Solo se redimensiona el preview, no el original
4. **JPEG estándar**: Se usa JPEG estándar (no mozjpeg) para el original para máxima compatibilidad y velocidad

## Seguridad

Los metadatos EXIF se preservan por seguridad para:
- **Trazabilidad**: Identificar el origen de la foto
- **Derechos de autor**: Probar propiedad de la imagen
- **Auditoría**: Rastrear información del fotógrafo y cámara usada
- **Ubicación**: Mantener información GPS si es relevante

## Notas Técnicas

- El procesamiento usa Sharp.js para manipulación de imágenes
- Los archivos se almacenan en Cloudflare R2 (S3 compatible)
- El procesamiento es completamente en memoria (no usa disco temporal)
- Se preservan metadatos usando `.keepMetadata()` antes de agregar nuevos metadatos
