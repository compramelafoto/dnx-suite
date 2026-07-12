# Selector Editorial de Fotografías CLF — Info Spot

## Propósito

Permitir al redactor seleccionar fotos de álbumes ComprameLaFoto, generar **derivados editoriales independientes** y usarlas como portada, inline, galería o destacada — con autoría, crédito, licencia y CTA comercial — **sin exponer el original de venta**.

## Modelos

| Modelo | Rol |
|--------|-----|
| `InfoSpotEditorialPhoto` | Representación base idempotente (`sourcePhotoExternalId` = Photo.id) |
| `InfoSpotEditorialPhotoVariant` | Derivados 640/960/1280/1920 (webp + jpeg fallback) |
| `InfoSpotEditorialPhotoUsage` | Uso en artículo: COVER / INLINE / GALLERY / FEATURED |
| `InfoSpotEditorialAsset` | Compat portada legacy (`deliveryAssetId`) |

Enums: `processStatus` (PENDING→READY/FAILED), `editorialLicenseStatus`, `editorialUsageStatus`.

`InfoSpotArticle.coverOverridden` evita que sync inbound reemplace portada manual.

## Flujo de selección

1. Cobertura o artículo → «Agregar fotos desde ComprameLaFoto»
2. `GET /api/redaccion/editorial-photos` (paginado, auth redacción)
3. `selectEditorialPhotoAction` → crea/reusa foto + usage + ContentOrigin PHOTO
4. Pipeline genera variantes en `infospot/editorial/clf/{photoId}/`
5. Render público usa derivados + crédito + CTA `/api/r`

## Derivados / storage

- Namespace: `infospot/editorial/clf/{photoId}/w{width}.webp|.jpg`
- Sharp: rotate, resize inside, withoutEnlargement, sin EXIF
- Nunca se sirve `originalKey`
- Fuente de lectura: preview WM > thumb WM > original (solo server-side)

## Licencia

| Entorno | Default al seleccionar foto | Cómo autorizar |
|---------|----------------------------|----------------|
| Staging/dev | `PENDING`, o `AUTHORIZED` si `INFOSPOT_ALLOW_STAGING_EDITORIAL_LICENSE=1` | Flag staging o Director |
| Producción | **Siempre `PENDING`** salvo contrato | Director foto a foto, o `INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT=AUTHORIZED` **y** `INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=1` |

Bloqueo explícito: en producción, `DEFAULT=AUTHORIZED` **sin** `CONTRACT=1` se ignora (`license-policy.ts`).

**Pendiente de producto:** actualizar términos CLF que habiliten difusión editorial formal antes de activar contrato.

Revocación (`REVOKED`): placeholder público; sin CTA; nota no se rompe.  
Eliminación comercial (`DELETED`): derivados `AUTHORIZED` pueden permanecer; CTA desaparece.

## Créditos

`buildEditorialPhotoCredit` → `Foto: {nombre} / ComprameLaFoto`.  
No editable la identidad base; sí caption/alt.

## CTA comercial

`AVAILABLE` → «Ver y comprar» vía `/api/r?kind=ALBUM_CLICK|PURCHASE_CLICK`.  
`HIDDEN` / `DELETED` → sin CTA; artículo no se rompe.  
Imagen editorial permanece solo con licencia `AUTHORIZED`.

## Protección disuasoria

- `draggable=false`, sin menú contextual nativo
- Popover con autor + CTA
- **No** se afirma bloqueo de capturas de pantalla (imposible de garantizar en web)

## Checklist

Bloquea publicar si alguna foto CLF:

- no está READY;
- sin autor / crédito;
- licencia ≠ AUTHORIZED;
- sin derivado;
- DELETED sin licencia válida.

## Reconciliación

`reconcileEditorialPhotoCommercialStatus` refresca estados desde álbumes CLF.

## Capturas de pantalla

Una web no puede impedir capturas de forma confiable. Las medidas son disuasorias; el original comercial nunca se entrega; la resolución editorial no sustituye el archivo comprado.

## Futuras mejoras

- Worker async dedicado
- AVIF
- Nodo TipTap `clfEditorialPhoto` dedicado
- Perfiles públicos de fotógrafo
- Firmado CDN con expiración

## Migración

`20260712250000_infospot_editorial_photo_selector` — solo staging.
