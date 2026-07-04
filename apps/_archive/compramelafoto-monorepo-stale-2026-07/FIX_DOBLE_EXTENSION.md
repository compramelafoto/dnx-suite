# Fix: Doble Extensión en URLs de R2

## Problema

Las URLs de R2 tenían doble extensión: `.jpg.jpg`
Ejemplo: `uploads/47a86399-3ceb-4ee0-bebc-ccb488f7a4ef-preview_56baa929-8eb8-4eb4-81ab-8f79742e36a5.jpg.jpg`

## Causa

La función `generateR2Key` estaba agregando la extensión aunque el nombre ya la tuviera cuando se le agregaba el prefijo `preview_` o `original_`.

## Solución Aplicada

### 1. Validación en `generateR2Key` (`lib/r2-client.ts`)

- ✅ Detecta y remueve extensiones duplicadas (ej: `.jpg.jpg` -> `.jpg`)
- ✅ Extrae extensión correctamente antes de sanitizar
- ✅ Valida que no se agregue extensión si ya está presente

### 2. Simplificación en `processPhoto` (`lib/image-processing.ts`)

- ✅ Deja que `generateR2Key` maneje toda la lógica de extensión
- ✅ Solo agrega prefijo `preview_` o `original_` al nombre

## Cómo Funciona Ahora

1. `originalName` = `"56baa929-8eb8-4eb4-81ab-8f79742e36a5.jpg"`
2. Se llama `generateR2Key("preview_56baa929-8eb8-4eb4-81ab-8f79742e36a5.jpg")`
3. `generateR2Key`:
   - Detecta extensión: `.jpg`
   - Remueve extensión: `"preview_56baa929-8eb8-4eb4-81ab-8f79742e36a5"`
   - Sanitiza: `"preview_56baa929-8eb8-4eb4-81ab-8f79742e36a5"`
   - Construye: `uploads/${uuid}-preview_56baa929-8eb8-4eb4-81ab-8f79742e36a5.jpg` ✅

## Próximos Pasos

1. Hacer commit y push:
```bash
git add lib/r2-client.ts lib/image-processing.ts
git commit -m "Fix: Corregir doble extensión en keys de R2"
git push origin main
```

2. Probar subiendo una nueva foto
3. Verificar que la URL no tenga `.jpg.jpg`

## Nota

Los archivos antiguos que ya tienen `.jpg.jpg` seguirán existiendo en R2, pero los nuevos archivos tendrán la extensión correcta.
