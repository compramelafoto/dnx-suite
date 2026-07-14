# 60 — Home adaptativa según perfiles públicos (22S)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado:** implementado en código · **validado en Production** (Etapa 22T · [`61`](./61-adaptive-home-production-validation.md)) · commit servido `06a8701`  
**Dependencias:** [`57`](./57-public-profile-onboarding-and-editorial-access.md) · [`59`](./59-public-profiles-production-migration.md)

No incluye secretos. Sin cambios Prisma / OAuth / Redacción / CLF / DNS.

---

## Objetivo

Reordenar la Home y los CTAs del header según perfiles públicos ACTIVE (`DnxUserProfile`): **CUSTOMER**, **PHOTOGRAPHER**, **ORGANIZER**.  
No crea features de negocio nuevas: solo composición y accesos a rutas existentes.

---

## Resolver central

`apps/infospot/lib/home-experience.ts` → `resolveHomeExperience()`

Entrada:

- `activeProfiles` (desde `listActivePublicProfiles`)
- `preferredMode` (cookie visual, opcional)

Salida:

- `mode` · `blocks[]` · `headerPrimaryCta` · `headerSecondaryLinks` · `canSwitchMode`

### Prioridad multi-perfil (default)

Si hay varios perfiles ACTIVE y **no** hay cookie válida:

1. **ORGANIZER**
2. **PHOTOGRAPHER**
3. **CUSTOMER**

Constante: `HOME_MODE_DEFAULT_PRIORITY`.

Visitante sin sesión → modo **GUEST** (orden marketing actual).

---

## Orden de bloques por modo

| Modo | Prioridad (resumen) |
|------|---------------------|
| CUSTOMER | Próximos → Cerca mío → Categorías → Coberturas → Noticias |
| PHOTOGRAPHER | Convocatorias → Coberturas → Próximos → Noticias |
| ORGANIZER | Publicar/pitch → Destacados → Próximos → Convocatorias → Noticias |
| GUEST | Pitch organizador + agenda + convocatorias (home histórica) |

Bloques omitidos si no hay datos (p. ej. `category_favorites` sin `categoryBlocks`).

---

## Persistencia del modo visual

- Cookie HttpOnly: `infospot_home_experience`
- Valores: `CUSTOMER` \| `PHOTOGRAPHER` \| `ORGANIZER`
- Acción: `setHomeExperienceModeAction` (solo si el perfil está ACTIVE)
- **No** modifica `DnxUserProfile` ni roles editoriales

UI: `HomeExperienceSwitcher` («Ver como») cuando `canSwitchMode`.

---

## Header

`resolveSiteHeaderChrome()`:

- CTAs según modo (Eventos / Convocatorias / Publicar evento, etc.)
- **Panel** solo si hay rol editorial / admin
- Nunca enlaces a `/redaccion` o `/admin` vía CTAs de perfil público

---

## Archivos clave

| Pieza | Ruta |
|-------|------|
| Resolver | `lib/home-experience.ts` |
| Cookie action | `app/actions/home-experience.ts` |
| Home | `app/page.tsx` + `components/home/HomeAdaptiveSections.tsx` |
| Switcher | `components/home/HomeExperienceSwitcher.tsx` |
| Header | `resolve-site-header-auth.ts` · `SiteHeader` · `AppChrome` |
| Tests | `lib/home-experience.test.ts` |

---

## QA checklist

| Caso | Esperado |
|------|----------|
| Sin login | GUEST · CTA Publicar evento · sin switcher |
| Solo CUSTOMER | Agenda / cerca / categorías arriba |
| Solo PHOTOGRAPHER | Convocatorias arriba · CTA Eventos/Convocatorias |
| Solo ORGANIZER | Pitch + Publicar evento |
| Multi + cookie | Cookie gana si el perfil sigue ACTIVE |
| Multi sin cookie | ORGANIZER por defecto |
| Editorial | Panel visible; CTAs públicos no apuntan a redacción |
| Responsive | Switcher + CTAs en menú móvil |
| a11y | `role="group"` · `aria-pressed` en switcher · labels |

```bash
pnpm --filter infospot test:home-experience
pnpm --filter infospot check-types
```
