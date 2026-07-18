# Referencias visuales curadas por nicho

Ninguna fotografía puede mostrarse por el asistente sólo por estar disponible técnicamente. Debe existir autorización explícita y verificable para el uso correspondiente.

Durante esta etapa las referencias visuales sólo están disponibles en el laboratorio local. El asistente público no muestra imágenes.

## Propósito y alcance

Catálogo local curado para el laboratorio de revisión. Sin búsqueda web, sin APIs externas, sin generación de imágenes, sin exposición pública.

## Arquitectura

```text
src/visual-references/
  domain/          # VisualReference, rights, source, niches
  catalog/         # carga local + paths
  provider/        # VisualReferenceProvider + LocalCurated
  selection/       # selección determinista (máx. 6)
  validation/      # derechos, MIME, traversal, tamaño
  serialization/   # vista pública sin rutas absolutas
  cli/             # validate / list / checklist / add / approve
```

## Catálogo

| Recurso | Ubicación |
|---------|-----------|
| Ejemplo versionado | `config/visual-references/catalog.example.json` |
| Catálogo local (Gitignored) | `.local/visual-references/catalog.json` |
| Assets locales (Gitignored) | `.local/visual-references/assets/` |

## Derechos

Obligatorio para mostrar:

* `usageAuthorized = true`
* `authorizedForInternalReview = true`
* `authorizationBasis ≠ UNKNOWN`
* no vencida
* atribución si `attributionRequired`
* `authorizedForPublicAssistant = false` (esta etapa)

## Nichos

Reutiliza el catálogo de `VisualNiche` (bodas, quince, deportiva, etc.).

## Comandos

```bash
pnpm --filter dnx-sales-assistant visual-references:checklist
pnpm --filter dnx-sales-assistant visual-references:add -- --file ./foto.jpg --title "..." --niche "bodas"
# Completar derechos en catalog.json (DRAFT)
pnpm --filter dnx-sales-assistant visual-references:approve <id>
pnpm --filter dnx-sales-assistant visual-references:validate
pnpm --filter dnx-sales-assistant visual-references:list
pnpm --filter dnx-sales-assistant conversation:lab
```

## Laboratorio

URL: `http://localhost:8799/review-lab`

Endpoints (solo con lab activo):

* `GET /review-lab/api/visual-references`
* `GET /review-lab/api/visual-references/:id`
* `GET /review-lab/assets/visual-references/:id`
* `POST /review-lab/api/visual-review`

## Fuentes futuras (no implementadas)

Contrato `VisualReferenceSource.kind`: `COMPRAMELAFOTO_FUTURE`, `GOOGLE_DRIVE_FUTURE`, `EXTERNAL_PROVIDER_FUTURE`. Sin conectores ni red.

## Seguridad

* Path traversal bloqueado
* Solo JPEG/PNG/WebP ≤ 10 MB
* Resolución por ID, no por path arbitrario
* Sin directory listing
* Bloqueo en production / sin flag de lab
