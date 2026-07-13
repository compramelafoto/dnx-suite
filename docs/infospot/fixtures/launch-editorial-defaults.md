# Defaults editoriales de lanzamiento (Info Spot)

Complemento corto de `44-editorial-operations-manual.md`.

## Categorías canónicas (DB)

```
deportes | cultura | fotografia | eventos
```

## Temas de redacción (no crear como categorías)

Deportes → Automovilismo, Motociclismo, Running, Ciclismo, Fútbol  
Cultura → Recitales, Capacitaciones, Solidarios, Turismo, Fiestas populares  
Fotografía → Buscan fotógrafos, galerías, oficio  
Eventos → Empresas, Convocatorias, agenda general

## Seed de borradores (no publica)

```bash
pnpm --filter @repo/db db:seed:infospot
pnpm --filter @repo/db db:seed:infospot-launch-drafts
```

Bloqueo en production: requiere `ALLOW_INFOSPOT_DEMO_SEED=1`.

## No usar en el día D (contra production)

```bash
pnpm --filter @repo/db db:seed:infospot-demo
pnpm --filter @repo/db db:seed:infospot-events
```

Esos scripts **publican** contenido DEMO.
