# Guía paso a paso: probar y validar cada Estrategia de upsell

Esta guía te permite activar y comprobar una por una las estrategias de upsell (Ventas digitales, Impresiones, Retoque pro, Entrega express, Extensión de almacenamiento).

---

## Antes de empezar

1. **Tener las estrategias en la base de datos**  
   Si aún no las corriste:
   ```bash
   npx ts-node scripts/seed-upsell-strategies.ts
   ```
2. **Usuario fotógrafo** con el que vas a probar (logueado en el panel).
3. **Un álbum** de ese fotógrafo con fotos y, para “Extensión de almacenamiento”, con **días de extensión** configurados (en el álbum).

---

## Dónde se configura todo

- **Qué ofrecés (global del fotógrafo):**  
  Panel → **Qué ofrecés** (`/dashboard/sales-settings`).  
  Ahí activás cada tipo de venta y completás precios / lista de impresiones / entrega.
- **Por álbum (opcional):**  
  Panel → **Álbums** → elegir un álbum → pestaña/sección de **Ventas / Sales** (si existe).  
  Ahí podés heredar del fotógrafo o desactivar/activar capabilities por álbum.
- **API de upsells aplicables:**  
  `GET /api/upsells/applicable?albumId=<ID>`  
  Devuelve la lista de estrategias que aplican para ese álbum según capabilities y configuración.

---

## 1. Ventas digitales → estrategia “Agregar más fotos al pack digital” (PACK_DIGITAL_ADD_MORE)

**Capability:** `DIGITAL_SALES`

### Pasos

1. Ir a **Qué ofrecés** (`/dashboard/sales-settings`).
2. Dejar **Ventas digitales** activado (por defecto suele estar).
3. Guardar.
4. **Validar en API:**  
   Abrir en el navegador (o con `curl`):  
   `https://tu-dominio.com/api/upsells/applicable?albumId=<ID_ALBUM>`  
   (reemplazá `<ID_ALBUM>` por el id de un álbum de ese fotógrafo).  
   En la respuesta debe aparecer un upsell con `slug: "PACK_DIGITAL_ADD_MORE"` (o el nombre “Agregar más fotos al pack digital”).
5. **Validar en la tienda:**  
   Entrar al flujo de compra del álbum (`/a/<id>/comprar`).  
   - Debe poder elegirse **“Descarga”** (digital).  
   - El cliente puede agregar fotos al carrito y comprarlas en digital.  
   Eso es la base de la estrategia “agregar más fotos al pack digital”.

**Checklist**

- [ ] Ventas digitales activado en Qué ofrecés.
- [ ] `/api/upsells/applicable?albumId=X` incluye estrategia de venta digital.
- [ ] En `/a/[id]/comprar` se puede elegir descarga y agregar fotos digitales al carrito.

---

## 2. Impresiones → estrategia “Impresiones” (PRINTS)

**Capabilities:** `PRINT_SALES`  
**Config requerida:** lista de precios + fulfillment (quién entrega).

### Pasos

1. Ir a **Qué ofrecés** (`/dashboard/sales-settings`).
2. Activar **Impresiones**.
3. En **Configuración de impresiones**:
   - Elegir **lista de precios**: “Usar lista de un laboratorio” (y elegir lab) **o** “Lista de precios propia”.
   - Completar **¿Quién entrega las impresiones?** (vos, laboratorio o retiro en estudio).
4. Guardar.  
   Debe verse **Configurado** en Impresiones.
5. **Validar en API:**  
   `GET /api/upsells/applicable?albumId=<ID>`  
   Debe incluir un upsell con `slug: "PRINTS"`.
6. **Validar en la tienda:**  
   En `/a/<id>/comprar`:  
   - Debe poder elegirse **“Impresa”** en las fotos.  
   - Selector de laboratorio (si aplica).  
   - Tamaños y precios según la lista.  
   - Al final, mensaje de retiro/entrega según lo configurado.

**Checklist**

- [ ] Impresiones activado y lista + entrega configurados.
- [ ] API devuelve estrategia PRINTS.
- [ ] En comprar se ve opción impresa, tamaños, precios e info de retiro/entrega.

---

## 3. Retoque pro → estrategia “Retoque profesional” (RETOUCH_PRO)

**Capability:** `RETOUCH_PRO`  
**Config:** precio de retoque en Qué ofrecés.

### Pasos

1. Ir a **Qué ofrecés** (`/dashboard/sales-settings`).
2. Activar **Retoque pro**.
3. Bajar a **Precio retoque pro** y cargar un monto (ej. 1500). Guardar.
4. **Validar en API:**  
   `GET /api/upsells/applicable?albumId=<ID>`  
   Debe incluir `slug: "RETOUCH_PRO"`.
5. **Validar en la tienda:**  
   La oferta de retoque pro se muestra como add-on al comprar digital o impresa (según cómo esté implementado en el flujo de compra).  
   Comprobar que en el flujo de compra aparezca la opción de retoque y que el precio sea el configurado.

**Checklist**

- [ ] Retoque pro activado y precio configurado.
- [ ] API devuelve RETOUCH_PRO.
- [ ] En el flujo de compra se ofrece retoque y se ve el precio.

---

## 4. Entrega express → estrategia “Entrega express” (EXPRESS_DELIVERY)

**Capability:** `EXPRESS_DELIVERY`  
**Config:** precio de entrega express.

### Pasos

1. Ir a **Qué ofrecés** (`/dashboard/sales-settings`).
2. Activar **Entrega express**.
3. En **Precio entrega express** cargar un monto (ej. 2000). Guardar.
4. **Validar en API:**  
   `GET /api/upsells/applicable?albumId=<ID>`  
   Debe incluir `slug: "EXPRESS_DELIVERY"`.
5. **Validar en la tienda:**  
   La opción de entrega express se ofrece al finalizar el pedido de impresiones (checkout).  
   Verificar que aparezca la opción y el monto cuando el carrito tenga impresiones.

**Checklist**

- [ ] Entrega express activada y precio configurado.
- [ ] API devuelve EXPRESS_DELIVERY.
- [ ] En checkout de impresiones se ofrece express con el precio correcto.

---

## 5. Extensión de almacenamiento → estrategia “Extender almacenamiento del álbum” (STORAGE_EXTEND)

**Capability:** `STORAGE_EXTEND`  
**Config:** precio de extensión en Qué ofrecés **y** que el álbum tenga **días de extensión** (y/o fecha de vencimiento).

### Pasos

1. Ir a **Qué ofrecés** (`/dashboard/sales-settings`).
2. Activar **Extensión de almacenamiento**.
3. En **Precio extensión de almacenamiento** cargar un monto (ej. 500). Guardar.
4. **Álbum:**  
   En el álbum que uses para probar, asegurate de que tenga configurado **días de extensión** (o fecha de vencimiento que permita ofrecer extensión).  
   Esto suele estar en la edición del álbum (ej. “Días de extensión” o “Vencimiento”).
5. **Validar en API:**  
   `GET /api/upsells/applicable?albumId=<ID>`  
   Debe incluir `slug: "STORAGE_EXTEND"` **solo** para álbumes que cumplan la condición de vencimiento/extensión.
6. **Validar en la tienda:**  
   En `/a/<id>/comprar` (o en la página de resumen), cuando el álbum está en período extendido o se ofrece extensión, debe verse el recargo por extensión (`extensionPricingActive`, `extensionSurchargePercent`).  
   Verificar que el total incluya el recargo cuando corresponda.

**Checklist**

- [ ] Extensión de almacenamiento activada y precio configurado.
- [ ] El álbum tiene días de extensión / vencimiento configurado.
- [ ] API devuelve STORAGE_EXTEND para ese álbum.
- [ ] En comprar/resumen se muestra el recargo de extensión cuando aplica.

---

## Resumen rápido por estrategia

| Estrategia (slug)        | Qué activar en “Qué ofrecés”     | Config extra              | Dónde validar en la tienda                    |
|--------------------------|-----------------------------------|----------------------------|-----------------------------------------------|
| PACK_DIGITAL_ADD_MORE    | Ventas digitales                  | —                          | Opción “Descarga” y agregar fotos al carrito  |
| PRINTS                   | Impresiones                       | Lista + entrega            | Opción “Impresa”, tamaños, retiro/entrega     |
| RETOUCH_PRO              | Retoque pro                       | Precio retoque             | Add-on retoque al comprar digital/impresa     |
| EXPRESS_DELIVERY         | Entrega express                   | Precio express             | Opción express en checkout de impresiones     |
| STORAGE_EXTEND           | Extensión de almacenamiento       | Precio + álbum con vencimiento | Recargo por extensión en comprar/resumen  |

---

## Ver todas las estrategias (admin)

- **Admin:** `/admin/upselling`  
  Lista de estrategias, estado (BETA, etc.), activación global y rollout.  
  Si no ves estrategias, ejecutá el seed (ver “Antes de empezar”).

---

## Troubleshooting

- **La API no devuelve una estrategia:**  
  Revisá que en Qué ofrecés esté activado el tipo de venta y que la config mínima esté completa (precios, lista de impresiones, entrega, etc.).  
  Para STORAGE_EXTEND, que el álbum tenga `expirationExtensionDays` (o lógica equivalente) configurado.
- **En la tienda no aparece la opción:**  
  El flujo de compra usa las capabilities y la config del álbum (pricing, etc.).  
  Confirmá que el álbum herede o tenga activada la capability correspondiente y que la API de pricing del álbum devuelva los flags correctos (ej. `enablePrintedPhotos`, `extensionPricingActive`).
- **Usuario por estrategia:**  
  Si existe configuración por usuario (UserUpsellConfig), que la estrategia esté habilitada para ese fotógrafo (por defecto suele ser `enabled: true`).

Si querés, en el siguiente paso podemos bajar al detalle de una estrategia concreta (por ejemplo solo PRINTS o solo STORAGE_EXTEND) y revisar juntos cada pantalla y cada llamada API.
