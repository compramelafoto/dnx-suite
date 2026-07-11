# Info Spot — Checklist de lanzamiento

Fecha objetivo: **antes del 15 de julio**.  
App: `apps/infospot` · Dominio: configurar en `NEXT_PUBLIC_INFOSPOT_URL` / `InfoSpotSettings.publicUrl`.

## 1. Variables de entorno

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | Postgres (Neon u otro) |
| `DIRECT_URL` | Recomendada | Migraciones Prisma |
| `NEXT_PUBLIC_INFOSPOT_URL` | Sí (prod) | URL canónica pública `https://…` |
| `DNX` / auth session (`dnx_session`) | Sí | Cookie compartida `@repo/auth` |
| `R2_ACCOUNT_ID` | Sí si hay uploads | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Sí si hay uploads | |
| `R2_SECRET_ACCESS_KEY` | Sí si hay uploads | |
| `R2_ENDPOINT` | Sí si hay uploads | |
| `R2_BUCKET_NAME` o `R2_BUCKET` | Sí si hay uploads | |
| `R2_PUBLIC_URL` o `R2_PUBLIC_BASE_URL` | Sí si hay uploads | |
| `INFOSPOT_IP_HASH_SALT` | Recomendada | Hash de IP en envíos de eventos |
| `INFOSPOT_DIRECTOR_EMAIL` | Seed | Usuario DIRECTOR |
| `ALLOW_INFOSPOT_DEMO_SEED` | No en prod | Solo si se fuerza seed demo |

## 2. Dominio y DNS

- [ ] Dominio apuntando a Vercel (o host elegido)
- [ ] HTTPS activo
- [ ] `NEXT_PUBLIC_INFOSPOT_URL` = URL final (sin slash final)
- [ ] `InfoSpotSettings.publicUrl` alineada

## 3. Base de datos y migraciones

```bash
pnpm --filter @repo/db exec prisma validate
pnpm --filter @repo/db exec prisma migrate deploy
pnpm --filter @repo/db exec prisma generate
```

- [ ] Migración `20260710180000_add_infospot_events_mvp`
- [ ] Migración `20260710190000_infospot_launch_readiness`
- [ ] Seed base (no demo): `pnpm --filter @repo/db db:seed:infospot`
- [ ] **No** correr seeds demo en production

## 4. R2 / assets

- [ ] Bucket y CORS OK
- [ ] Prefijos `infospot/covers` e `infospot/events`
- [ ] OG default configurada (URL real o asset en `/public`)
- [x] PNG oficiales activos en UI (`docs/infospot/09-brand-assets.md`)

## 5. Usuario DIRECTOR y emails

- [ ] Usuario con `InfoSpotUserRole` = `INFOSPOT_DIRECTOR`
- [ ] Email editorial y de prensa en `/admin/configuracion`
- [ ] Redes solo si existen (no inventar)

## 6. Contenido real

Panel: `/admin/lanzamiento`

- [ ] Noticias `DEMO` reemplazadas o archivadas
- [ ] Eventos `demo-*` reemplazados o archivados
- [ ] Portadas reales (sin stock temporal en home)
- [ ] Etiquetar contenido definitivo como `REAL`
- [ ] Revisar checklist editorial al publicar

## 7. SEO y discovery

- [ ] `/robots.txt` y `/sitemap.xml` responden
- [ ] Search Console: propiedad + sitemap
- [ ] Metadata home / noticia / evento
- [ ] JSON-LD Organization + Article + Event
- [ ] No index: `/admin`, `/redaccion`, `/design-system`

## 8. Pruebas pre-deploy

- [ ] Navegación header/footer (sin 404)
- [ ] `/publicar-evento` + revisión DIRECTOR
- [ ] `/api/health` → `{ status: "ok" }`
- [ ] 404 amigable
- [ ] Mobile + desktop
- [ ] Contraste de CTAs
- [ ] Formularios y rate limit

## 9. Analytics

- [ ] Definir herramienta (si aplica) sin bloquear lanzamiento
- [ ] No hardcodear IDs inventados

## 10. Rollback

- [ ] Commit/tag de release conocido
- [ ] `vercel rollback` / redeploy previo
- [ ] DB: no correr seeds destructivos; migraciones forward-only

## 11. Post-deploy

- [ ] Healthcheck prod
- [ ] Home carga con eventos/noticias reales
- [ ] Contacto muestra emails configurados
- [ ] Sitemap en Search Console
- [ ] Probar envío de evento y login DIRECTOR

## Bloqueos conocidos (no implementados a propósito)

- Login propio de Info Spot
- Cuentas de organizadores / edición autónoma
- Convocatorias, inscripciones, acreditaciones, pagos
- Integración profunda CLF
- Mapas / geo personalizada
- Analytics / “Lo más leído” con métricas reales (hoy: “Selección editorial”)
