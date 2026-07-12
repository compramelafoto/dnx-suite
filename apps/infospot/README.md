# Info Spot

Portal público/editorial de noticias y eventos del ecosistema **DNX Suite**.

## Desarrollo

```sh
pnpm --filter infospot dev
```

App en [http://localhost:3004](http://localhost:3004).

## CMS (Redacción)

Rutas privadas (requieren sesión DNX + `InfoSpotUserRole` ACTIVE):

- `/redaccion` — panel y listado
- `/redaccion/nueva` — crear
- `/redaccion/noticias/[id]/editar` — editar
- `/redaccion/noticias/[id]/preview` — preview

### Cómo crear la primera noticia

1. Tener rol en `InfoSpotUserRole` (`pnpm --filter @repo/db db:seed:infospot`).
2. Iniciar sesión en otra app DNX (cookie `dnx_session`) o configurar sesión compartida.
3. Abrir `/redaccion/nueva`, completar título/contenido y guardar borrador o publicar.
4. Ver en `/noticias` y `/noticias/[slug]` solo si quedó `PUBLISHED`.

### Política de permisos (actual)

- **DIRECTOR** y **REDACTOR** pueden crear, editar y (si `canPublish`) publicar/despublicar.
- El helper `canEditInfoSpotArticle` permite editar **todas** las noticias (no solo las propias).
- Solo **DIRECTOR** (o SUPER_ADMIN) entra a `/admin` (settings/usuarios — stub).

### Editor

TipTap visual (`@repo/editor`) con persistencia Markdown en `content`. Round-trip MD↔HTML; figuras editoriales como islas HTML con alt/crédito. Público: `react-markdown` + `remark-gfm` + `rehype-raw` sanitizado.

### Uploads

Mismo bucket R2 que ComprameLaFoto (`infospot/covers/*`). Sin R2 en local: `public/uploads/infospot/`.

Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

## Seeds

```sh
pnpm --filter @repo/db db:seed:infospot
pnpm --filter @repo/db db:seed:infospot-demo   # 5 notas demo; bloqueado en production
```

## Integración CLF (Paso 4)

En `/redaccion/noticias/[id]/editar`:

1. Buscar evento CLF
2. Elegir álbum del evento
3. Seleccionar fotos → importar como copia editorial permanente (`infospot/editorial/...`)
4. Uso: COVER / INLINE / GALLERY

Helper compartido: `resolveClfAlbumCommercialAvailability` en `@repo/db`.

Auditoría: `docs/operations/infospot-clf-integration-audit.md`.

## Estado

CMS + vínculo editorial CLF. Sin inscripciones/acreditaciones/IA/aprobación.
