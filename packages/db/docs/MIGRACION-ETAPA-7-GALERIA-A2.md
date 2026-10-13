# Aplicar la migración de la Galería (FOTOFFICE, etapa 7, Entrega A2: venta de fotos extra)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto. Requiere la migración de
la Entrega A1 (`20261101120000_fotoffice_etapa_7_galeria`) ya aplicada.

**Publicar el código antes que el SQL rompe** la página pública de la galería, el listado de galerías, la
pestaña Configuración de cada galería y Configuración → Galería (todas leen las columnas nuevas de
`FotofficeGaleria` y `FotofficeGaleriaAjustes`), y el webhook de pagos de galerías.

| | |
|---|---|
| Migración | `20261102120000_fotoffice_etapa_7_galeria_venta` |
| Archivo | `packages/db/prisma/migrations/20261102120000_fotoffice_etapa_7_galeria_venta/migration.sql` |
| Checksum (sha256) | `f5d0a439373b23bcf5e381f0b2ee6e81ccda24025f4c1b607f14e4548245dfdd` |
| Qué hace | Suma 9 columnas a `FotofficeGaleria` (`includedCount`, `pricingMode`, `unitPriceArs`, `packageSize`, `packagePriceArs`, `discountMode`, `discountPct`, `discountRules`, `incomeCategoryId`) y 1 a `FotofficeGaleriaAjustes` (`defaultIncomeCategoryId`); crea las tablas `FotofficeGaleriaCompra` y `FotofficeGaleriaCompraFoto` con sus índices (únicos en `providerPaymentRef` y `cashMovementId`), claves foráneas y CHECK de precios, descuentos, estados y montos. No borra ni actualiza filas: las galerías existentes quedan en `SELECCION` sin precios. |

## Antes de aplicar (precheck)

Las galerías existentes no pueden estar en modo de venta (la columna `saleMode` viene de A1 y el CHECK
`ventaCompleta` exige precios completos a toda galería que no sea `SELECCION`). Tiene que dar **0**:

```sql
SELECT count(*) FROM "FotofficeGaleria" WHERE "saleMode" <> 'SELECCION';
```

Si da más de 0, no aplicar: esas galerías hay que pasarlas a `SELECCION` o completarles el precio primero.

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción, todo junto en una transacción.
2. Registrarla sin volver a correrla: insertar en `_prisma_migrations` el nombre de la migración con el
   checksum de arriba (o `prisma migrate resolve --applied 20261102120000_fotoffice_etapa_7_galeria_venta`).
3. Comprobar:
   - las dos tablas nuevas existen y están vacías (`SELECT count(*) FROM "FotofficeGaleriaCompra"` y `"FotofficeGaleriaCompraFoto"` dan 0);
   - las 10 columnas nuevas existen:
     `SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('FotofficeGaleria','FotofficeGaleriaAjustes') AND column_name IN ('includedCount','pricingMode','unitPriceArs','packageSize','packagePriceArs','discountMode','discountPct','discountRules','incomeCategoryId','defaultIncomeCategoryId');`
     (10 filas);
   - los CHECK existen: `SELECT conname FROM pg_constraint WHERE conname LIKE 'FotofficeGaleria%' AND contype = 'c';` incluye `FotofficeGaleria_ventaCompleta`, `FotofficeGaleria_descuentoCompleto`, `FotofficeGaleriaCompra_status`, `FotofficeGaleriaCompra_montos`;
   - los índices únicos `FotofficeGaleriaCompra_providerPaymentRef_key` y `FotofficeGaleriaCompra_cashMovementId_key` existen.

## Mercado Pago

El aviso de pago (webhook) de las fotos extra es **un endpoint propio**, aparte del de cuotas, tienda y reservas:

```
https://<dominio de la app>/api/payments/mp/galerias-webhook
```

La preferencia de pago ya lo manda como `notification_url`, así que no hace falta configurarlo en el panel de
Mercado Pago. Siempre responde 200. El estudio necesita tener conectada su cuenta de Mercado Pago
(Configuración → Cobros): el cobro entra directo en su cuenta, sin comisión de plataforma.

## Descarga de originales

- Los originales ya están en el **bucket privado** (`galerias/<workspaceId>/<galeriaId>/<fotoId>/original`); no hay
  nada que migrar ni CORS nuevo: la descarga es un GET firmado de 5 minutos con `Content-Disposition: attachment`
  que el navegador sigue por navegación, no por `fetch`.
- Se activa por galería (o por defecto en Configuración → Galería) con **Descarga → "Sólo las fotos elegidas o
  compradas, en alta"**. El cliente baja el original de las fotos que pagó y, una vez enviada la selección, de
  las incluidas.

## Prueba en producción

1. En una galería de prueba (publicada, con un cliente de prueba con correo propio): Configuración → Venta de
   fotos extra: 1 foto incluida, precio por foto bajo (por ejemplo $ 100), y Descarga "Sólo las fotos elegidas o
   compradas, en alta".
2. Abrir el enlace del cliente **desde el celular**, elegir 3 fotos: el carrito dice 2 extras con el precio.
3. Pagar con una cuenta de Mercado Pago real (importe mínimo). Al volver, las 2 fotos aparecen como "Comprada"
   con el botón "Descargar", y la descarga baja el original con el nombre de la foto.
4. Enviar la selección: la foto incluida también se puede bajar. "Descargar todas las mías" baja las 3.
5. En el estudio: la compra figura como pagada con comisión y neto, el movimiento está en Caja (cuenta Mercado
   Pago) y el historial de la galería muestra el pago y las descargas.
6. Comprobar el aviso por correo al estudio y, si se quiere, devolver el pago de prueba desde Mercado Pago.
7. Archivar la galería de prueba.

## Deshacer

Con las compras vacías o descartadas: borrar `FotofficeGaleriaCompraFoto` y `FotofficeGaleriaCompra`, quitar los
CHECK y las columnas nuevas (`ALTER TABLE "FotofficeGaleria" DROP COLUMN ...` las 9, y
`"FotofficeGaleriaAjustes"."defaultIncomeCategoryId"`; los CHECK y las claves foráneas caen con las columnas o se
quitan antes con `DROP CONSTRAINT`), y borrar la fila de `_prisma_migrations`. Ojo: si ya hubo compras pagadas,
sus movimientos de Caja quedan; no se borran con esto.
