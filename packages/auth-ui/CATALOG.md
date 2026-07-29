# Catálogo Auth UI DNX

Historias declarativas en `src/catalog/stories.ts`.

```bash
pnpm --filter @repo/auth-ui selfcheck
```

## Historias

| ID | Descripción |
| -- | ----------- |
| login-standard | Login base |
| login-clickaton | Marca Clickatón + contexto |
| login-fotorank | Marca FotoRank |
| login-clf | Marca ComprameLaFoto |
| login-infospot | Invitation-only |
| login-fotoffice | Google emphasized (orden intacto) |
| register | Registro canónico |
| forgot / reset | Recuperación |
| error / loading | Estados |
| google-only | Copy Google-only en forgot |
| invitation-only | Registro bloqueado |
| mobile | Ancho móvil |

Para Storybook futuro: importar `listAuthUiStories()` y renderizar `DnxLoginPanel` / etc. según `panel`.
