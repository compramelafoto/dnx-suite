# 15 — Pendientes para después del cutover

Cosas detectadas durante la migración que **no bloquean** el cambio y conviene hacer
después, con legacy congelado y un solo código que mantener.

Cada una dice por qué no se hizo antes y cuándo es el momento adecuado.

---

## P-01 — Renombrar los campos `*Cents` que guardan pesos

**Prioridad:** alta
**Momento:** después del freeze de legacy, antes de tocar cualquier código de precios
**Riesgo de hacerlo:** bajo (el compilador verifica) · **Riesgo de NO hacerlo:** alto

### El problema

18 campos con sufijo `Cents` guardan **ARS enteros**, no centavos. El nombre miente.

Y lo peor: **no es uniforme**. El dominio Clickatón / DNX Pagos usa el mismo sufijo para
guardar centavos de verdad. Las dos convenciones conviven en el mismo esquema, y hasta
dentro del mismo archivo:

```ts
// app/api/precompra/order/route.ts
241:  let totalCents = 0;
243:  totalCents += it.priceCents * it.quantity;        // PreCompraOrderItem.priceCents → CENTAVOS
246:  const orderTotalArs = Math.round(totalCents / 100);
263:  totalCents: orderTotalArs,                        // Order.totalCents → PESOS
```

### Cómo se descubrió

Reportando la prueba de compra dividí por 100 y di los montos cien veces menores
($34,50 en vez de $3.450). El titular lo detectó comparando con Mercado Pago.

Es exactamente el error que el nombre induce, cometido por alguien que había leído el
esquema. Va a volver a pasar.

### Escala verificada (contra Mercado Pago y contra el código)

| Campo | Guarda |
|--|--|
| `Order.totalCents` | **pesos** |
| `Order.platformCommissionCents` | **pesos** |
| `Album.digitalPhotoPriceCents` | **pesos** |
| `PreCompraOrder.totalCents` | **pesos** |
| `PreCompraOrderItem.priceCents` | **centavos** |

**El resto NO está verificado.** Antes de renombrar hay que confirmar cada uno siguiendo
el código o mirando la magnitud de los datos reales. Casos ambiguos detectados:
`CuantoCobroQuote.*` (351.834 a 3.245.045) y `CatalogProduct.basePriceCents`.

### Cómo hacerlo sin riesgo

Prisma permite separar el nombre del campo del nombre físico de la columna:

```prisma
totalPesos  Int  @map("totalCents")
```

- La columna en la base **no cambia** → nada que migrar, cero riesgo sobre los datos
- El código pasa a leer `totalPesos` → el nombre deja de mentir
- El compilador marca cada uso viejo → no se puede olvidar ninguno

### Tamaño

| | |
|--|--:|
| Campos | 18 |
| Tablas | 16 |
| Menciones en el código | **2.006** en 202 archivos |

### Por qué no antes del cutover

Es un cambio grande sobre el código que maneja dinero, justo en la ventana de mudanza.
Y **no arregla ningún error**: el sistema calcula bien, cobra bien y Mercado Pago recibe
el monto correcto. Arregla una trampa de lectura.

Mitigación aplicada mientras tanto: aviso al inicio de `packages/db/prisma/schema.prisma`
con las dos convenciones, los campos verificados y el ejemplo del archivo que las mezcla.

---

## P-02 — Aviso de términos nuevos en el panel del fotógrafo

**Prioridad:** baja · **Momento:** cuando el titular decida comunicarlo

Los términos cambiaron (`2026-01-26` → `2026-07-21`, agrega la cláusula Info Spot). La
venta ya no depende de eso — ver `14-bloqueante-terminos-corta-la-venta.md` — así que es
una decisión de comunicación, no un requisito.

**Detalle a tener en cuenta si se implementa:** `/api/terms/accept` registra la aceptación
del **usuario**, pero la venta lee `Album.termsVersion`. Un aviso que solo llame a esa ruta
deja constancia legal sin cambiar nada operativo. Si se quiere que además actualice los
álbumes, hay que agregar esa propagación.

---

## P-03 — Alinear las versiones de Prisma

**Prioridad:** media · **Momento:** antes del próximo cambio de esquema

| | Versión |
|--|--|
| `packages/db` declara | `^6.9.0` → instalada **6.19.2** |
| `@prisma/client` resuelto | **7.8.0** |
| `npx prisma` en la raíz | **7.8.0** |

Prisma 7 **rechaza** el esquema actual: `url` y `directUrl` ya no van en el schema, deben
moverse a `prisma.config.ts`. Hoy funciona porque el CLI 6.19.2 de `packages/db` es el que
corre, pero cualquiera que use `npx prisma` desde la raíz se choca con el error.

---

## P-04 — Logo de sponsor roto en la portada

**Prioridad:** baja · **Preexistente, no es regresión**

El logo de "Vicario" apunta a `/api/media/clickaton/partners/...`, una ruta que **no existe
en CompraMeLaFoto**: vive en Clickatón. Da 404 en los dos sitios.

La URL está guardada en la base como ruta relativa, así que solo funciona en el dominio de
Clickatón. Hay que guardar la URL absoluta o exponer la ruta en CLF.

---

## P-05 — Las 7 rutas no migradas

**Prioridad:** baja · **Decisión consciente**

| Ruta | Motivo |
|--|--|
| `api/upsells/applicable` | nadie la llama en ninguno de los dos |
| `api/system-settings` | nadie la llama en ninguno de los dos |
| `api/cron/analysis-health` | nadie la llama; falta `lib/analysis/collect-pipeline-health.ts` |
| `api/debug-env` | diagnóstico de desarrollo |
| `api/test/whatsapp`, `api/test/env-whatsapp` | pruebas |

Revisar si alguna hace falta cuando se retome el módulo de análisis.

---

## P-06 — El cartel de "Cargando álbum…" no se apaga

**Prioridad:** baja · **Preexistente, no es regresión**

En la galería pública el texto queda visible aunque las fotos ya se hayan cargado.
Verificado: pasa **igual en legacy**. Cosmético, pero se ve descuidado.

---

## P-07 — Menú superior cortado en pantallas angostas

**Prioridad:** baja · **Preexistente, no es regresión**

A menos de ~600px el menú desborda y el último botón queda cortado. Idéntico en legacy
(`scrollWidth 542 > clientWidth 375`). Puede ser intencional (barra con desplazamiento
horizontal), pero no se lee como tal.

---

## P-08 — Limpieza de la migración

**Prioridad:** media · **Momento:** una vez estable en producción

- Borrar el usuario de prueba `qa-migracion@dnx.test` (existe solo en la copia)
- Borrar las ramas Neon `migracion-monorepo-20260829` y `migracion-monorepo-prueba2`
- Decidir qué hacer con la rama `development`, que quedó desactualizada desde enero
- Congelar legacy: deshabilitar sus crons y sus deploys
