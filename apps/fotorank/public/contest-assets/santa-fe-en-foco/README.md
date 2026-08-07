# Santa Fe en Foco — assets locales

Colocar aquí únicamente archivos oficiales del concurso / organizadores.

## Nombres canónicos

| Slot | Ruta relativa |
|------|----------------|
| Hero desktop | `hero/hero-desktop.webp` (o `.jpg` / `.png`) |
| Hero mobile | `hero/hero-mobile.webp` |
| Logo concurso | `identity/contest-logo.png` |
| Logo organizador | `identity/organizer-logo.png` |
| Logo secundario | `identity/logos-secondary/senado.png` |
| Overview | `editorial/overview.webp` |
| Categories | `editorial/categories.webp` |
| Participation | `editorial/participation.webp` |
| Organizer | `editorial/organizer.webp` |
| Prizes | `editorial/prizes.webp` |
| Galería | `gallery/gallery-01.webp` … `gallery-08.webp` |
| Social | `social/social-cover.webp` |

Después de copiar un archivo, setear `file` en:

`app/lib/fotorank/contest-assets/santa-fe-en-foco-assets.ts`

y ejecutar:

```bash
node apps/fotorank/scripts/validate-santa-fe-visual-assets.mjs
```

Sin archivo conectado en el manifiesto, la landing usa fallback tipográfico.
No dejar archivos de prueba ni capturas en estas carpetas.
