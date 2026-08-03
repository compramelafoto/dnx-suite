# `@repo/content-ui`

UI admin compartida del CMS DNX (TipTap, formulario de post, biblioteca multimedia).

## Arquitectura — callbacks / adapters en props

No hay contenedor DI. Cada app inyecta transporte y branding vía props:

| Pieza | Rol |
| --- | --- |
| `onSubmit` / `onDelete` / `onCreated` / `onSaved` | Persistencia de posts (create/update/delete + navegación en la app) |
| `ContentMediaAdapter` | `listMedia` / `uploadMedia` / `updateMedia` / `deleteMedia` (+ opcional `uploadHero`) |
| `options` o carga en el wrapper | Categorías, tags, autores |
| `ContentUiLabels` | Copy i18n/branding sin hardcodear nombres de producto |
| `--content-ui-accent` | Acento CSS (default neutro `#525252`). La app host setea el suyo en el wrapper |

### Qué incluye

- `ContentEditor` (TipTap + toolbar)
- `ContentPostForm` + `buildContentPostSubmitPayload`
- `ContentMediaLibrary` / `ContentMediaPicker` / `ContentHeroImageField`
- Selectores de taxonomía/tags/autor
- Labels y tipos neutros

### Qué no incluye

- Auth, Prisma, R2, cookies, Next.js routing
- URLs hardcodeadas de API admin
- Branding de producto / marketplace específico
- Managers de categoría/tag/autor, listados admin, shell de nav (quedan en la app — Alternativa B)

### Dependencias

- `@repo/content` (extensiones TipTap, slugify, enums)
- peer: `react`, `react-dom`
- TipTap (`@tiptap/react`, `@tiptap/core`) — sin dependencia de `next` (la app puede hacer `next/dynamic` del editor/form)

### Tests

Sin jsdom/testing-library: se cubren neutralidad de fuentes, labels por defecto y el builder de payload puro. Ver `src/*.test.ts`.
