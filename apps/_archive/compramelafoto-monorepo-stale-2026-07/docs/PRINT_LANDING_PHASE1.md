# Print landing Phase 1 – Tests manuales sugeridos

## Objetivo

Verificar que el módulo "Imprimir tus fotos" (cliente sube sus propias fotos) funcione en FASE 1: el pedido lo recibe el dueño de la landing (fotógrafo o laboratorio) y el precio se calcula según reglas claras, sin selección de laboratorio por parte del cliente.

## 1. Landing fotógrafo

- **Ruta:** `/[handler]/imprimir` (handler = `publicPageHandler` del fotógrafo).
- **Flujo:** Subir fotos → elegir tamaño/acabado/cantidad → datos → pago.
- **Verificar:**
  - Se muestra el mensaje: "La impresión se realiza a cargo del fotógrafo. Selección de laboratorio próximamente."
  - No hay selector de laboratorio.
  - Al crear el pedido: `PrintOrder.photographerId = fotógrafo.id`, `PrintOrder.labId = null`, `ownerType = PHOTOGRAPHER`, `ownerId = fotógrafo.id`.
  - Precios = lista de productos del fotógrafo (PhotographerProduct).
  - El pedido aparece en el dashboard del fotógrafo (no en el del lab).

**Test sugerido:** Crear pedido en landing fotógrafo con 2 ítems, verificar total y que en BD queden `photographerId` asignado y `labId` null.

## 2. Landing laboratorio (modo RETAIL)

- **Ruta:** `/l/[handler]/imprimir` (handler = `publicPageHandler` del laboratorio).
- **Panel lab:** Configuración → Datos → "Precios en landing de impresión" = **Usar precio base (público)** (RETAIL).
- **Verificar:**
  - No hay selector de fotógrafo ni de laboratorio.
  - Al crear el pedido: `PrintOrder.labId = lab.id`, `PrintOrder.photographerId = null`, `ownerType = LAB`, `ownerId = lab.id`.
  - Precios = precios base/retail del lab (LabBasePrice / retail de LabProduct).
  - El pedido aparece en el dashboard del laboratorio.

**Test sugerido:** Crear pedido en landing lab con modo RETAIL, anotar total. Comparar con mismo pedido en modo WHOLESALE.

## 3. Landing laboratorio (modo WHOLESALE)

- **Panel lab:** "Precios en landing de impresión" = **Usar precio profesional** (WHOLESALE).
- **Verificar:** Mismos ítems que en RETAIL dan un total menor (precio mayorista).
- **Test sugerido:** Mismo pedido que en (2); comparar totales RETAIL vs WHOLESALE.

## 4. Resumen de reglas

| Landing   | ownerType   | photographerId | labId | Precios                          |
|----------|-------------|----------------|-------|----------------------------------|
| Fotógrafo| PHOTOGRAPHER| = ownerId      | null  | PhotographerProduct              |
| Lab      | LAB         | null           | = ownerId | Lab según usePriceForPhotographerOrders (RETAIL/WHOLESALE; AUTO = RETAIL en landing) |

## 5. Migración de base de datos

Ejecutar la migración que agrega `PrintOrderOwnerType` y columnas `ownerType` / `ownerId` en `PrintOrder`:

```bash
npx prisma migrate deploy
# o en desarrollo:
npx prisma migrate dev --name add_print_order_owner_type
```

Si la migración ya existe en `prisma/migrations/20260202170000_add_print_order_owner_type/`, solo hace falta aplicarla.
