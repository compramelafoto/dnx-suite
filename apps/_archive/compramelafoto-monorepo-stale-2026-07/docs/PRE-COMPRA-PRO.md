# Pre-venta PRO (escuelas) – Estado de implementación

## Hecho

### 1. Modelo de datos (Prisma)
- **Album**: `preCompraCloseAt`, `requireClientApproval`, relaciones a `AlbumProduct`, `PreCompraOrder`, `Subject`.
- **AlbumProduct**: producto por álbum (name, description, price, mockupUrl, minFotos, maxFotos, requiresDesign, suggestionText). Relación opcional a `Template`.
- **PreCompraOrder** / **PreCompraOrderItem**: pedido sin pago, ítems por producto, estados `PreCompraOrderItemStatus`, `ApprovalProof`.
- **Subject** / **SubjectSelfie**: niños por orden, selfies para matching.
- **PhotoFace** / **FaceMatch** / **PhotoClaim**: caras en fotos, matches con subjects, reclamos "esta foto es mi hijo".
- **Selection** / **SelectionPhoto**: selección de fotos por ítem (min/max).
- **Template** / **TemplateSlot**: plantilla JPG, huecos verdes, máscaras.
- **DesignProject** / **DesignRevision**: proyecto de diseño, revisiones, export JPG.

Migración: `prisma/migrations/20260225180000_precompra_pro_models/migration.sql`.

Aplicar con: `npx prisma migrate deploy` (o `migrate dev` en local).

### 2. APIs
- **GET** `/api/public/album/[slug]/precompra` – Catálogo público (álbum + productos si `preCompraCloseAt` vigente).
- **POST** `/api/precompra/order` – Crear pedido (albumId, buyerEmail, items: [{ albumProductId, quantity }]).
- **GET** `/api/precompra/order/[id]` – Detalle del pedido (ítems, subjects, selfies).
- **POST** `/api/precompra/order/[id]/subjects` – Crear subject (label).
- **POST** `/api/precompra/order/[id]/selfie` – Subir selfie (FormData: subjectId, file).
- **GET/POST** `/api/dashboard/albums/[id]/precompra-products` – Listar y crear productos de pre-venta (fotógrafo).
- **PATCH** `/api/dashboard/albums/[id]` – Acepta `preCompraCloseAt` y `requireClientApproval`.

### 3. Páginas
- **/album/[slug]/preventa** – Catálogo de productos, cantidades, email, botón "Confirmar pre-venta" → redirige a `/order/[id]/selfies`. La ruta `/album/[slug]/precompra` redirige aquí.
- **/order/[id]/selfies** – Lista de subjects, agregar niño, subir selfie por niño; en desktop muestra aviso + placeholder QR para abrir en celular.

### 4. Flujo actual
1. Fotógrafo: en el álbum (dashboard) configurar `preCompraCloseAt` (y opcionalmente `requireClientApproval`) vía PATCH; crear productos con POST a `precompra-products`.
2. Cliente: abrir `/album/[publicSlug]/preventa`, elegir productos y cantidades, email, confirmar → se crea `PreCompraOrder` y redirige a `/order/[id]/selfies`.
3. Cliente: en selfies agregar niños (subjects) y subir una selfie por niño (la selfie se guarda en R2 y se crea `SubjectSelfie`).

## Pendiente (para completar el flujo PRO)

- **Matching facial**: al subir fotos al álbum, ejecutar detección de caras → `PhotoFace`; matching con selfies del álbum → `FaceMatch`; si hay match y el ítem permite `approvalProof = FACE_MATCH`, marcar ítem como `APPROVED_BY_MATCH`. Integración con Rekognition u otro proveedor.
- **PhotoClaim**: UI "Esta foto es mi hijo" en galería cliente; API para crear reclamo y para que el fotógrafo apruebe/rechace (y al aprobar crear `FaceMatch` manual).
- **Galería filtrada**: `/album/[slug]/mis-fotos?orderId=` – fotos del álbum filtradas por subject (solo fotos con match o en las que el subject aparece en grupo).
- **Selector**: `/order-item/[id]/seleccion` – elegir fotos respetando min/max del producto, validar y crear `Selection` + `SelectionPhoto`; al enviar, si `approvalProof = SELECTION`, aprobar ítem.
- **Wizard de plantillas**: subir JPG, elegir verde (picker), tolerancia, detección de componentes verdes (flood fill), ordenar slots, generar máscaras PNG por slot → `Template` + `TemplateSlot`.
- **Editor PRO**: canvas 2D con plantilla base, por cada slot pintar foto transformada con máscara (destination-in), zoom/encuadre/rotación, snap, grid, safe area; validar resolución mínima; export JPG sRGB a (cm/2.54)*300 px.
- **DesignProject**: al aprobar ítem (por match o selección) y si el producto tiene `requiresDesign`, crear `DesignProject` y redirigir a `/order-item/[id]/diseno`; el cliente diseña, envía; fotógrafo aprueba o pide 1 cambio (`NEEDS_CHANGES`); al aprobar, export final y estado `APPROVED`/`EXPORTED`.
- **Dashboard fotógrafo**: sección Pre-venta en álbum (preCompraCloseAt, requireClientApproval, link al catálogo); CRUD productos (ya hay POST, faltan PUT/DELETE por producto); wizard de plantillas; inbox de reclamos y diseños pendientes de aprobación.
- **QR real**: en `/order/[id]/selfies` usar librería (ej. `qrcode.react`) para generar QR con la URL de la misma página.

## Cómo probar lo implementado

1. Aplicar migración: `npx prisma migrate deploy`.
2. En la base de datos (o vía API): actualizar un álbum con `preCompraCloseAt` en el futuro (ej. mañana) y crear al menos un `AlbumProduct` para ese álbum.
3. Abrir `/album/[publicSlug]/preventa` (reemplazar por el `publicSlug` del álbum): ver catálogo, agregar cantidades, email, confirmar.
4. En `/order/[id]/selfies`: agregar un niño, subir una selfie (elige imagen); verificar que aparece "Selfie cargada".
