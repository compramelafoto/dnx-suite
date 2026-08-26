# Santa Fe en Foco — Ingestión manual de assets visuales

Operativa ETAPA 02 IMPLEMENTACIÓN 02.  
Mecanismo **temporal y manual** hasta el editor «Estética y diseño». Sin upload, sin DB, sin migraciones.

## 1. Dónde colocar cada archivo

Raíz canónica:

```text
apps/fotorank/public/contest-assets/santa-fe-en-foco/
```

| Slot | Carpeta | Nombre canónico sugerido |
|------|---------|---------------------------|
| Hero desktop | `hero/` | `hero-desktop.webp` |
| Hero mobile | `hero/` | `hero-mobile.webp` |
| Logo concurso | `identity/` | `contest-logo.png` |
| Logo organizador (SFPR) | `identity/` | `organizer-logo.png` |
| Logo secundario (Senado) | `identity/logos-secondary/` | `senado.png` |
| Overview | `editorial/` | `overview.webp` |
| Categories | `editorial/` | `categories.webp` |
| Participation | `editorial/` | `participation.webp` |
| Organizer (editorial) | `editorial/` | `organizer.webp` |
| Prizes | `editorial/` | `prizes.webp` |
| Galería | `gallery/` | `gallery-01.webp` … `gallery-08.webp` |
| Social / OG | `social/` | `social-cover.webp` |

Formatos: **JPEG, PNG, WebP**. No SVG.

## 2. Cómo nombrarlo

Preferir los nombres de la tabla. Si usás otra extensión (`.jpg`, `.png`), actualizá la ruta en el manifiesto para que coincida exactamente.

## 3. Cómo ejecutar el validador

Desde la raíz del monorepo:

```bash
node apps/fotorank/scripts/validate-santa-fe-visual-assets.mjs
```

## 4. Cómo interpretar errores y warnings

| Severidad | Significado | Exit |
|-----------|-------------|------|
| **ERROR** | Manifiesto roto, archivo faltante, extensión inválida, alt inválido, galería > 8 | `1` |
| **WARNING** | Dimensiones/peso/aspecto fuera de lo recomendado, archivo en disco no usado, galería < 3 | `0` |
| **INFO** | Dimensiones reales, estado de conexión, slots pendientes | `0` |

Una diferencia leve respecto a 2400×1100 **no bloquea** si la calidad es suficiente (WARNING).

## 5. Cómo conectar o desconectar un asset

Archivo de manifiesto:

`apps/fotorank/app/lib/fotorank/contest-assets/santa-fe-en-foco-assets.ts`

- **Conectar:** colocar el archivo → setear `file: "hero/hero-desktop.webp"` (ruta relativa al slug) → alt descriptivo → correr validador.
- **Desconectar:** `file: null` → la landing vuelve al fallback sin 404.

No editar URLs dentro de `ContestPublicLanding.tsx`.

## 6. Cómo reemplazar una fotografía

1. Backup del archivo anterior (fuera o con sufijo `.bak` fuera de `public` si hace falta).
2. Sobrescribir el archivo en la misma ruta **o** poner uno nuevo y actualizar `file`.
3. Revisar alt / crédito / focal.
4. Ejecutar validador + capturas visuales.

## 7. Cómo cambiar el focal point

En el mismo manifiesto, campos `focalPointX` / `focalPointY` (0–100).  
Se convierten a `object-position` vía `focalToObjectPosition`.

## 8. Cómo volver al fallback

`file: null` en el slot (o borrar el archivo **y** dejar `file: null`).  
No dejar `file` apuntando a un path inexistente (ERROR del validador).

## 9. Mínimo para publicar identidad visual

Recomendado mínimo:

1. `hero.desktop` (y idealmente `hero.mobile`)
2. `identity.organizerLogo` (SFPR)
3. Alt correctos en ambos

Opcional pero deseable: logo del concurso, logo Senado, overview, social, galería 3–8.

## 10. Recursos opcionales

- Editorial (`categories`, `participation`, `organizer`, `prizes`)
- Galería
- Social (se conecta a `generateMetadata` solo si existe)
- Logos secundarios

## Selfcheck

```bash
pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/contest-assets/contest-assets.selfcheck.ts
```

## Capturas

```bash
pnpm --filter fotorank dev
node apps/fotorank/scripts/visual-capture-etapa02-impl02.mjs
```

Salida: `.tmp/fotorank-etapa02-impl02-visual/`
