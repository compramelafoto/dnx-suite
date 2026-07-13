# 40 — Flujo unificado de material editorial

## Principio

```
Asistente Editorial → Material preparado → Editor → Insertar desde Biblioteca
```

El editor **nunca** busca fotografías en ComprameLaFoto.
Solo consume lo que el asistente ya preparó.

## Qué se eliminó

| Antes | Después |
|-------|---------|
| Botón toolbar “Desde ComprameLaFoto” | Eliminado |
| `ClfPhotoPickerDialog` en TipTap | Eliminado |
| `ClfEventPicker` completo en Config del editor | Reemplazado por resumen + link al asistente |
| CTAs “buscar / elegir / seleccionar fotos” en escritura | Solo “Agregar material” → asistente |

## Flujo de “Agregar material”

1. En la Biblioteca: **Agregar material**
2. Abre `/redaccion/asistente?mode=photos&articleId=…`
3. El redactor elige fotografías
4. **Volver al editor** materializa usos y redirige a `/editar?from=asistente`

## Biblioteca Material

Grupos:

- Favoritas (localStorage, no cambia usages)
- Portada
- Galería
- Para insertar
- Usadas en el texto
- Procesando / No disponibles (si aplica)

Cada ítem muestra: fotógrafo, cobertura, estado, crédito.

### Búsqueda

Filtro local sobre material ya vinculado (fotógrafo / cobertura / crédito).
**Sin** nuevas consultas a CLF.

### Favoritos

Clave `infospot-material-favorites-v1` por `articleId`.
Solo organización visual.

### Usadas + sync cursor

- Si `data-asset-id` está en el cuerpo → badge “Usada en el artículo” + “Ir al texto”
- Cursor sobre una figura → resalta el ítem en la biblioteca
- Clic en “Ir al texto” → selección TipTap + scroll

## Timeline del asistente

Pasos con check visual:

- Qué querés contar
- Evento
- Coberturas
- Fotografías
- Preparar borrador
- **Listo para escribir**

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `material-library-panel.tsx` | Biblioteca unificada |
| `editorial-visual-editor.tsx` | Sin picker CLF; sync selección |
| `editor-toolbar.tsx` | Solo “Subir archivo” local |
| `asistente` + `mode=photos` | Única vía para sumar fotos |

## Restricciones respetadas

Sin cambios de workflow, Prisma, sync CLF, coberturas, distribución, permisos, geo ni producción.
