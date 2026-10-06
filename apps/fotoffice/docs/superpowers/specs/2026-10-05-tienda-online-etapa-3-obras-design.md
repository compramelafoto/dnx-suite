# Tienda online de FOTOFFICE — Etapa 3: venta de obras de concursos de FotoRank

**Fecha:** 2026-10-05 · **Depende de:** etapas 1 y 2 (en producción).

**Decisiones de Daniel (2026-10-05):**
- **Permiso:** si las bases del concurso autorizan impresión y uso comercial, la obra se puede vender y se le avisa al autor, que puede retirarla con un clic. Si las bases no lo autorizan, se le pide permiso expreso.
- **Qué obras:** las que elige la institución, una por una, entre las que tienen permiso.
- **Regalía:** un porcentaje configurable por concurso (sugerido 20 %, sin contar el envío), con liquidación mensual que paga la institución.
- **Producción:** la imprime la institución con su laboratorio. El panel le da el archivo original y los datos del formato.

## 1. Qué resuelve

Una institución que organizó un concurso en FotoRank puede vender **copias impresas y cuadros** de las obras en su tienda online, con permiso del autor, pagándole una regalía y usando el mismo carrito, cobro, envío y panel de pedidos de las etapas 1 y 2.

## 2. Hechos del código que condicionan el diseño

- FOTOFFICE y FotoRank comparten base y tabla `User`; **no existe vínculo** Workspace ↔ `ContestOrganization`.
- Los originales de las obras están en el bucket privado `fotorank-private-prod` (R2, token acotado a ese bucket). FOTOFFICE usa su propio bucket `fotoffice-media`. FotoRank genera THUMBNAIL (480 px) y JURY_PREVIEW (2000 px), sin marca de agua.
- Las bases tienen `rights.allowCommercial`, `rights.allowPrint`, `rights.attributionRequired` (`apps/fotorank/app/lib/fotorank/rules-config/types.ts`), dentro de la configuración versionada del concurso. Santa Fe en Foco las tiene en `true`.
- Los resultados públicos sólo muestran códigos anónimos; ganadores/finalistas se resuelven por `FotorankResultEntry` → `FotorankJuryEntrySnapshot.entryId`.
- FOTOFFICE ya tiene `sharp` y envía correos con `sendAndLogEmail` (Resend).

## 3. Decisiones de diseño

| # | Decisión | Por qué |
|---|---|---|
| O1 | Vínculo explícito `WorkspaceContestOrganizationLink` (workspace ↔ organización). Lo crea una persona que es **dueña o admin en los dos lados** (`WorkspaceMembership` OWNER/ADMIN y `ContestOrganizationMember` ACTIVE OWNER/ADMIN). Se puede quitar | Lo prometido: no "mismo email", sino un vínculo que sobrevive a cambios de personas. |
| O2 | **Acceso firmado a FotoRank** para las imágenes: una ruta nueva en FotoRank `GET /api/fotorank/external/entry-image` que recibe `entryId`, `variant` (`preview` \| `original`), `exp` y `sig` (HMAC-SHA256 con el secreto compartido `DNX_FOTORANK_LINK_SECRET`). `preview` devuelve un JPEG de 1600 px de lado mayor **con marca de agua** ("Muestra · <institución>"); `original` devuelve el archivo original. Enlaces de 10 minutos. Sin sesión de FotoRank | Menor privilegio: FOTOFFICE no recibe credenciales del bucket de FotoRank; no hace falta crear nada en Cloudflare. Mismo patrón que el jurado único de Clickatón. |
| O3 | Al **publicar** una obra, FOTOFFICE pide la vista previa firmada y la guarda en su propio R2 público (`fotoffice/artwork-previews/`). La tienda nunca le pega a FotoRank por cada visita | Rendimiento y aislamiento. |
| O4 | Base del permiso por concurso: si la última versión publicada de las bases tiene `allowPrint && allowCommercial` → **RULES** (vendible, se avisa al autor, puede retirarla). Si no → **EXPLICIT** (se le pide; vendible sólo si acepta) | Decisión de Daniel. |
| O5 | El permiso se gestiona con un **enlace por correo** a una página pública de FOTOFFICE (`/w/<slug>/obras/permiso/<token>`), sin cuenta: muestra la obra (vista previa), la institución, los formatos y precios, el % de regalía, y los botones "Acepto" / "No acepto" (EXPLICIT) o "Retirar mi obra de la tienda" (RULES). Token aleatorio, se guarda el hash, vence a los 60 días, reenviable | El autor no necesita entrar a FotoRank. |
| O6 | La institución elige qué obras publicar desde un **listado del concurso** con filtros (premiadas, finalistas, admitidas) que muestra el estado del permiso. Publicar exige permiso vigente (RULES no retirado, o EXPLICIT aceptado) | Decisión de Daniel. |
| O7 | **Formatos** = catálogo de la institución (p. ej. "Impresión 30×45 papel mate", "Cuadro 40×60 marco negro"): tipo (impresión/cuadro), medidas en cm, precio, costo opcional, peso y medidas de embalaje (para el envío de la etapa 2), activo. Mismo precio para todas las obras | Simple y lo que hace cualquier laboratorio. |
| O8 | **Resolución mínima**: un formato se ofrece para una obra sólo si el lado mayor del original alcanza `ladoMayorCm / 2,54 × dpiMínimo` (dpi mínimo configurable por institución, por omisión 150). La obra se imprime completa: si la proporción no coincide, con bordes (se aclara en la ficha y en el pedido) | Calidad de impresión sin recortes inesperados. |
| O9 | El carrito y el pedido admiten **renglones de obra** (`artworkListingId` + `printFormatId`) además de productos. Sin stock (se imprime a pedido), sin reserva | Reutiliza todo el circuito. |
| O10 | En la `Sale`, cada obra va como renglón suelto "Obra «título» — <formato>" con costo = costo del formato | `recordSale` ya admite renglones sueltos. |
| O11 | **Regalía**: `% configurable por concurso` (por omisión 20 %) sobre el precio de la línea, **sin envío**. Se congela en el pedido. Al acreditarse el pago se crea un `ArtworkRoyalty` ACCRUED por línea; al cancelar el pedido pasa a VOIDED. Pantalla "Regalías" con resumen mensual por autor (hora argentina) y "Marcar pagado" con referencia | Decisión de Daniel. |
| O12 | **Producción**: en el detalle del pedido, cada renglón de obra muestra formato, medidas, aviso de bordes y el botón **"Descargar original"** (enlace firmado de 10 minutos, sólo para quien opera la tienda) | Decisión de Daniel. |
| O13 | Crédito del autor: se muestra su nombre (`FotorankProfile.displayName`, o nombre de usuario) cuando las bases piden atribución o el autor aceptó; si el autor retira o rechaza, la obra se despublica sola y los pedidos ya pagados siguen | Respeto de derechos. |
| O14 | Todo vive en el módulo `store`, con la acción de permiso `store.configure` para vínculos, formatos, publicación y regalías, y `MANAGE` para ver/operar pedidos | Mismo modelo de permisos. |
| O15 | Fuera de alcance: edición limitada numerada y certificado (etapa 4), laboratorio conectado, venta de archivos digitales, obras de Clickatón (otra base) | Etapas siguientes. |

## 4. Modelo de datos (migración `20261005180000_store_artworks`, aditiva)

```prisma
model WorkspaceContestOrganizationLink {
  id, workspaceId, organizationId, linkedByUserId Int, createdAt
  @@unique([workspaceId, organizationId])
}

model StorePrintSettings { id, workspaceId @unique, minDpi Int @default(150), createdAt, updatedAt }

model PrintFormat {
  id, workspaceId, name, kind String // PRINT | FRAME
  widthCm Int, heightCm Int, priceArs Decimal(12,2), costArs Decimal(12,2)?,
  weightGrams Int?, packLengthCm Int?, packWidthCm Int?, packHeightCm Int?,
  isActive Boolean @default(true), sortOrder Int @default(0), createdAt, updatedAt
  @@index([workspaceId, isActive])
}

model ContestStoreSettings {        // por (workspace, concurso)
  id, workspaceId, contestId, royaltyBps Int @default(2000), createdAt, updatedAt
  @@unique([workspaceId, contestId])
}

model ArtworkConsent {              // uno por (workspace, obra)
  id, workspaceId, contestId, entryId, authorUserId Int
  basis String        // RULES | EXPLICIT
  status String       // NOTIFIED | GRANTED | PENDING | DECLINED | WITHDRAWN
  tokenHash String @unique, tokenExpiresAt DateTime
  notifiedAt DateTime?, respondedAt DateTime?, createdAt, updatedAt
  @@unique([workspaceId, entryId])
}

model ArtworkListing {
  id, workspaceId, contestId, entryId, slug
  title String, authorDisplayName String?, awardLabel String?
  previewUrl String, previewWidth Int, previewHeight Int
  originalWidth Int, originalHeight Int
  status String       // DRAFT | PUBLISHED | WITHDRAWN
  publishedAt DateTime?, withdrawnAt DateTime?, sortOrder Int @default(0), createdAt, updatedAt
  @@unique([workspaceId, entryId])
  @@unique([workspaceId, slug])
  @@index([workspaceId, status])
}

// StoreOrderItem: columnas nuevas, nulas
artworkListingId String?, printFormatId String?, printFormatName String?,
royaltyBps Int?, artworkAuthorUserId Int?

model ArtworkRoyalty {
  id, workspaceId, orderId, orderItemId @unique, authorUserId Int, contestId,
  baseArs Decimal(12,2), royaltyBps Int, amountArs Decimal(12,2),
  status String @default("ACCRUED") // ACCRUED | PAID | VOIDED
  paidAt DateTime?, paidReference String?, paidByUserId Int?, createdAt, updatedAt
  @@index([workspaceId, status, createdAt])
}
```

`ProductStoreListing` no cambia: las obras no son `Product`.

## 5. Flujos

1. **Vincular** (Ventas → Tienda → Obras → "Vincular organización de FotoRank"): lista las organizaciones donde la persona es OWNER/ADMIN activa; al elegir, se crea el vínculo.
2. **Configurar** formatos (alta/edición/baja) y dpi mínimo; por concurso, el % de regalía.
3. **Elegir obras**: por concurso de una organización vinculada (estados COMPLETED/FINALISTS/JUDGING/CLOSED/ARCHIVED; obras CONFIRMED y no REJECTED/WITHDRAWN), con filtros por premio. "Pedir permiso / avisar" crea los `ArtworkConsent` (basis según las bases) y manda el correo; un `NOTIFIED` (RULES) o `GRANTED` (EXPLICIT) habilita "Publicar". Publicar trae la vista previa firmada, la guarda en R2 de FOTOFFICE, arma título ("título de la obra" o "Obra <número>"), autor (O13) y premio.
4. **Autor** (enlace del correo): acepta / no acepta / retira. Retirar o no aceptar despublica la obra.
5. **Tienda pública**: sección "Obras" (`/tienda/obras`) con grilla por concurso y ficha de obra (vista previa, autor, concurso, premio, formatos disponibles por resolución con precios, aviso de bordes). Agregar al carrito.
6. **Checkout y pedido**: renglones de obra validados en el servidor (listing PUBLISHED, permiso vigente, formato activo y elegible por resolución, precio del formato); el envío usa peso y embalaje del formato.
7. **Cobro y acreditación**: igual que productos; `finalizePaidOrder` agrega los renglones de obra a la venta y crea las regalías.
8. **Producción y despacho**: panel del pedido con "Descargar original" por renglón; despacho igual que etapa 2.
9. **Regalías**: resumen mensual por autor (email y nombre), totales, "Marcar pagado". Cancelar un pedido anula sus regalías ACCRUED; una regalía PAID de un pedido cancelado queda marcada "a recuperar".

## 6. Seguridad y bordes

- La ruta firmada de FotoRank: compara la firma en tiempo constante, rechaza vencidos, no revela si la obra existe, responde con `Cache-Control: private, no-store` para originales; sólo sirve obras **no retiradas por el autor** (consulta `ArtworkConsent` por `entryId`: si todos los consentimientos están DECLINED/WITHDRAWN, 404 para `preview`; el `original` sigue disponible sólo si existe un pedido pagado con esa obra — se valida en FOTOFFICE antes de firmar).
- `DNX_FOTORANK_LINK_SECRET`: mismo valor en los dos proyectos de Vercel; sin él, las funciones de obras quedan apagadas con un aviso en el panel.
- Correos sin datos de otros autores; tokens con hash; logs sin datos personales.
- Una obra de un concurso de una organización **no vinculada** nunca se lista ni se vende (se verifica en cada lectura).

## 7. Pruebas

Puras: elegibilidad por resolución, base del permiso según bases, firma/verificación HMAC, cálculo de regalía (sin envío, redondeo), transiciones de permiso. Servidor con dobles: vínculo exige rol en los dos lados; publicar sin permiso falla; retiro despublica; checkout rechaza obra despublicada o formato no elegible; acreditación crea venta con renglón de obra y regalía; cancelación anula regalía. FotoRank: ruta firmada (firma inválida, vencida, variante, obra retirada).

## 8. Orden de construcción

1. Esquema y migración. 2. Lógica pura (resolución, permiso, regalía, firma). 3. Ruta firmada en FotoRank + cliente en FOTOFFICE. 4. Vínculo con organizaciones. 5. Formatos y ajustes. 6. Permisos de autores (correo + página pública). 7. Elegir y publicar obras. 8. Tienda pública de obras. 9. Carrito, checkout y pedido con obras. 10. Acreditación, regalías y cancelación. 11. Producción (descarga del original) y pantalla de regalías. 12. Verificación final.
