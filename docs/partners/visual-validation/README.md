# Sponsor Global — validación visual (Etapa 8 / 8B)

Fecha: **2026-08-12**  
Componente: **`PartnerWelcomeInterstitial`** (`@repo/design-system/components/partners`)  
Tracking: **deshabilitado** (sin `href` / sin `creativeId` ⇒ sin `PartnerViewableImpression`, sin `/r/`, sin beacon)  
Frequency cap: **deshabilitado** solo en harness (`disableFrequencyCap`)  
Campañas reales: **ninguna**  
Flags productivos welcome: **no activados**

> Estas capturas NO representan una campaña publicada. Usan un **sponsor sintético** (“Sponsor de ejemplo”) y fondos tomados de páginas públicas con flags OFF.  
> Pack compartible: [`sponsor-global-validacion-visual.zip`](./sponsor-global-validacion-visual.zip) (`desktop/`, `mobile/`, `README.md`).

## Método

1. Captura de fondos desde superficies públicas reales (sin welcome visible).
2. Harness local Vite (`harness/`) que monta el **componente real** sobre esos fondos.
3. Screenshots desktop `1440×900` y mobile `390×844`.

El harness es **solo local** (`127.0.0.1:5199`). No se desplegó.

## Capturas desktop

| # | Plataforma | Superficie | Archivo | Viewport | Animación captura |
|---|------------|------------|---------|----------|-------------------|
| 1 | Clickatón | Evento público | [`01-clickaton-event-sponsor-welcome.png`](./01-clickaton-event-sponsor-welcome.png) | 1440×900 | fade |
| 2 | FotoRank | Concurso `public-ui` | [`02-fotorank-contest-sponsor-welcome.png`](./02-fotorank-contest-sponsor-welcome.png) | 1440×900 | slide-up |
| 3 | InfoSpot | Portada | [`03-infospot-home-sponsor-welcome.png`](./03-infospot-home-sponsor-welcome.png) | 1440×900 | slide-left |
| 4 | ComprameLaFoto | Álbum público | [`04-clf-album-sponsor-welcome.png`](./04-clf-album-sponsor-welcome.png) | 1440×900 | slide-right |

## Capturas mobile

| # | Archivo | Viewport |
|---|---------|----------|
| 1b | [`01b-clickaton-event-sponsor-welcome-mobile.png`](./01b-clickaton-event-sponsor-welcome-mobile.png) | 390×844 |
| 2b | [`02b-fotorank-contest-sponsor-welcome-mobile.png`](./02b-fotorank-contest-sponsor-welcome-mobile.png) | 390×844 |
| 3b | [`03b-infospot-home-sponsor-welcome-mobile.png`](./03b-infospot-home-sponsor-welcome-mobile.png) | 390×844 |
| 4b | [`04b-clf-album-sponsor-welcome-mobile.png`](./04b-clf-album-sponsor-welcome-mobile.png) | 390×844 |

## Sponsor sintético

- Nombre: Sponsor de ejemplo  
- Asset: `sponsor-ejemplo.svg` + `harness/public/sponsor-ejemplo.svg`  
- **Sin CTA interno** en el SVG (Etapa 8B): el único CTA es el de `PartnerWelcomeInterstitial`  
- **No** incorporado a DNX Partners Production  

## Fondos de referencia

| Plataforma | Origen (solo lectura) | Archivo |
|------------|----------------------|---------|
| Clickatón | `maratonfotografica.com/maratones/clickaton-argentina-2026` | `backgrounds/bg-clickaton.jpg` |
| FotoRank | `fotorank.com/concursos/santa-fe-en-foco` | `backgrounds/bg-fotorank.jpg` |
| InfoSpot | `infospot.com.ar/` | `backgrounds/bg-infospot.jpg` |
| CLF | álbum público en `compramelafoto.dnxsuite.com` | `backgrounds/bg-clf.jpg` |

## Cómo reproducir (local)

```bash
cd docs/partners/visual-validation/harness
pnpm install --ignore-workspace
pnpm exec vite --host 127.0.0.1 --port 5199
# otra terminal:
node capture.mjs
```

## Nota sobre el proyecto Vercel accidental

El proyecto `dnx-clf-album-runtime` (`prj_Oda8ogRLhGGvUJfvKIPlvquYPmEh`) se auditó y **eliminó** de forma permanente tras confirmar: sin dominios custom, sin alias productivo, sin relación con `compramelafoto-dnxsuite`.  
`compramelafoto.dnxsuite.com` sigue en `compramelafoto-dnxsuite` (`dpl_BSGLsR8utLsm93iT2ZgVwZoaHqcs`).
