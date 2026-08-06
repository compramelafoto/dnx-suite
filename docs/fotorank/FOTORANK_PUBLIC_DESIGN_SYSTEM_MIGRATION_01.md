# FotoRank — Migración del sistema visual público

**Rama:** `feat/fotorank-public-participant-design-system-01`  
**Worktree:** `dnx-suite-fotorank-public-ds-01`  
**Commit base de arranque:** `43553fbd`  
**HEAD de la rama (IMPL 02):** `eead7d49`  
**Commits IMPL 02:** `7e659cc0` → `f9211021` → `d2d44671` → `eead7d49`  
**Etapas:** IMPL 01 → IMPL 02 (cierre visual público; deploy productivo bloqueado)

---

## Decisión de identidad visual (IMPL 02)

| Token | Valor | Uso |
|-------|-------|-----|
| `--background` | `#141414` | Base editorial (no negro puro) |
| `--surface` / `--surface-secondary` | `#1c1c1c` / `#242424` | Cards y bandas |
| `--primary` | `#c4a35a` | Acento de marca **limitado** (CTA, links, focus) |
| `--foreground` / muted | `#f4f4f5` / `#a1a1aa` | Texto |

**Justificación del acento:** el wordmark/isologo real de FotoRank es dorado. Se conserva un dorado **más contenido** (`#c4a35a`, no `#d4af37` legacy ni `#FFC400` Clickatón), aplicado solo a acciones primarias y énfasis. Se evita relleno dorado masivo, glow, glassmorphism y estética “lujo/casino”.

Superficies: neutros fríos; tipografía DM Sans; fotografía como protagonista cuando hay asset real.

---

## Home pública — completamente migrada

Migrada a `components/public-home/HomeView.tsx` + `PublicShell` / `PublicHeader` (`variant="marketing"`) / `PublicFooter`.

**Ya no usa:** `LandingHeader`, `HeroSection`, `ProblemSection`, `HowItWorksSection`, `BenefitsSection`, `ParaQuienEsSection`, `CredibilidadSection`, `FeaturedContestsSection`, `FinalCTASection`, `PhotoBanner`, `FullscreenMenu`, spacer de header legacy.

Prioridad de contenido: descubrir concursos y participar (CTA principal «Ver concursos»).

En producción actual (`fotorank.com`, lectura 2026-08-06) la home **todavía** muestra el sistema legacy orientado a organizadores. Esta rama la reemplaza por la home participante-first.

---

## Rutas sin legacy en alcance público

| Ruta | Sistema |
|------|---------|
| `/` | public-ui |
| `/concursos/[slug]` | public-ui |
| `/concursos/[slug]/inscripcion` | public-ui |
| `/participaciones` + `(participant)` | public-ui |

**Legacy todavía existente (fuera de alcance):** dashboard organizador, wizard, `/concursos/[slug]/jurados`, `/resultados`, carpeta `components/landing/*` (huérfana respecto de `/`; `Footer.tsx` reexporta `PublicFooter`).

Guard automático: `legacy-public-routes.guard.test.ts` + `home-and-header.guard.test.ts`.

---

## Header y footer unificados

- Un solo `PublicHeader` para marketing / concurso / participante.
- Menú móvil: `aria-expanded`, `aria-controls`, `role="dialog"`, cierre con Escape, overflow body.
- `PublicFooter` en home, landing, inscripción y área participante.

---

## Ritmo vertical

Ver `.cursor/rules/fotorank_public_composition.mdc` y tokens `--public-stack-*` (contrato tipo Clickatón, sin tokens `--ck-*`).

---

## Validación con datos reales

### Producción (solo lectura)

| URL | Resultado |
|-----|-----------|
| `https://fotorank.com/` | 200 — home **legacy** (aún no desplegada esta rama) |
| `https://fotorank.com/concursos/santa-fe-en-foco` | 200 — landing real Santa Fe en Foco (redirige a host dnxsuite) |

Hechos verificados en landing real (lectura HTML, sin mutaciones):

- Nombre: Santa Fe en Foco  
- Organizador: Sociedad de Fotógrafos Profesionales de Rosario  
- Inscripciones abiertas; categorías Amateur / Profesional / Reportero Gráfico (y más)  
- Fechas de apertura/cierre/evaluación/resultados presentes  
- Bases y privacidad referenciadas  
- Instagram: no aparece en el HTML público de la landing (puede vivir solo en inscripción)  

### Entorno del agente

- Sin `DATABASE_URL`: home local lista vacía de concursos (degradación segura).
- Preview no indexable: `/dev/public-ds-preview` (solo `ENABLE_PUBLIC_DS_PREVIEW=1`).
- Capturas IMPL 02: `apps/fotorank/test-results/public-ds-02-real-captures/` (gitignored).
- Comparativa prod “antes”: `…/compare/prod-*-before.png`.
- Recorrido autenticado productivo: **no ejecutado** (sin cuenta de prueba autorizada). Límite: UI pública + preview de estados.

---

## Integración / deploy

- `origin/main` HEAD (al momento del trabajo): `0b9cf3b5` (cambios CLF TypeScript), distinto del commit base FotoRank `43553fbd`.
- Último release FotoRank en main relacionado: `d8cb62ef` (Santa Fe ETAPA 09 registration go-live).
- Esta rama **no** es fast-forward sobre producción.
- **Deploy productivo bloqueado** hasta integración controlada (rebase/cherry-pick) sobre la punta productiva de FotoRank, sin pisar trabajo `SANTA FE` / pipeline.

Rollback: revert de los commits de esta rama en el deploy objetivo.

---

## Tests

```bash
pnpm --filter fotorank test:public-ui
pnpm --filter fotorank check-types
pnpm --filter fotorank lint
pnpm --filter fotorank build
```

---

## Pendientes fuera de alcance

- Migrar `/jurados` públicos y `/resultados` públicos
- Eliminar carpeta `components/landing/*` legacy cuando no queden consumidores
- Validación autenticada con cuenta de prueba autorizada en producción
- Integración/deploy a `fotorank.com` tras alinear con tip productivo
- Home productiva sigue legacy hasta ese deploy
