# [DEMO COMERCIAL] DNX Partners — Etapa 2

Campaña de demostración para capturar publicidad real andando en Clickatón,
FotoRank, InfoSpot y ComprameLaFoto, sin tocar producción y sin usar marcas
comerciales reales.

**Estado:** creada, no ejecutada. El seed nunca corrió contra ninguna base.

Rama: `feat/partners-demo-comercial-e2`
Worktree: `dnx-suite-wt-etapa10-marquee`

## Las cinco marcas

Son las plataformas del propio ecosistema DNX anunciándose entre sí. Son tuyas: no
hacen falta autorizaciones ni se toma prestada la identidad de un tercero.

Ninguna marca aparece dentro de su propia app — el plan es de **promoción cruzada**,
que es lo que harías de verdad.

| Marca | Se anuncia en | Origen del archivo |
|---|---|---|
| Clickatón | InfoSpot, ComprameLaFoto | `apps/clickaton/public/brand/logo-mono-negro.png` |
| FotoRank | Clickatón, InfoSpot, ComprameLaFoto | `apps/fotorank/public/logo-fotorank.png` |
| ComprameLaFoto | FotoRank, Clickatón, InfoSpot | `images/formar-parte/allies/compramelafoto.png` |
| InfoSpot | Clickatón, ComprameLaFoto | `apps/infospot/public/brand/infospot-logo-horizontal.png` |
| FotoOffice | ComprameLaFoto, Clickatón, InfoSpot | `apps/fotoffice/public/fotoffice-wordmark.png` |

De cada marca se eligió la variante oficial que se lee **tanto sobre fondo claro como
sobre oscuro**, verificado componiendo cada logo sobre ambos fondos en el tamaño real
del slot del marquee. Las variantes descartadas (`clickaton-wordmark.png`,
`fotorank-logo.png`) tienen texto blanco y desaparecen sobre fondo claro.

### Dónde viven los archivos

Los assets canónicos están en `assets/` de esta misma carpeta. **No se versionan
dentro de `apps/*/public/`**: son material de demostración y no deben viajar al
bundle de producción.

Para verlos en local, copiálos a las cuatro apps:

```bash
bash docs/partners/demo-comercial/sync-assets.sh
```

Para quitarlos: `rm -rf apps/*/public/partners-demo`

Las capturas tampoco se versionan (pesan 20 MB y se regeneran en un minuto con
`harness/capture-demo.mjs`).

### Sobre FotoOffice

Aparece como **anunciante** en las otras plataformas. Eso no contradice su exclusión
de DNX Partners: la restricción es no montar superficies publicitarias *dentro* de
FotoOffice, y no se monta ninguna. Su código no se toca.

### Marcas ficticias de reserva

En `marcas-ficticias/` quedan los tres logotipos SVG dibujados para la versión
anterior de esta demo: Óptica Demostración, Café Muestra y Estudio Ejemplo. No se
usan, pero están si alguna vez hace falta simular un anunciante externo.

## Qué crea el seed

5 partners · 13 campañas · 11 placements · una participación global por marca y
aplicación · enlaces de seguimiento por marca, aplicación y tipo de placement.

Cubre los 11 placements montados hoy en este worktree:

| Aplicación | Placements |
|---|---|
| Clickatón | `CLICKATON_EVENT_WELCOME`, `CLICKATON_HOME_MARQUEE`, `CLICKATON_EVENT_MARQUEE` |
| FotoRank | `FOTORANK_CONTEST_WELCOME` |
| InfoSpot | `INFOSPOT_HOME_WELCOME`, `INFOSPOT_HOME_TOP`, `INFOSPOT_HOME_INLINE`, `INFOSPOT_HOME_MARQUEE` |
| ComprameLaFoto | `CLF_ALBUM_WELCOME`, `CLF_HOME_PROMO`, `CLF_LOGO_MARQUEE` |

Cada franja de logos queda con **cuatro marcas**, que es lo que hace que esa captura
se vea bien.

### Por qué crea participaciones globales

Sin una participación con `contextType = GLOBAL`, los marquees de Clickatón, la
placa de FotoRank y la de ComprameLaFoto descartan la campaña: en esos casos el
motor no trata «sin participación» como global, justamente para evitar campañas
huérfanas. Las participaciones se crean `ACTIVE` y `PUBLIC`, sin fechas.

## Guardas

El seed y la limpieza comparten `assertSafeEnvironment()`, que corre **antes** de
abrir ninguna conexión. Aborta si:

1. `NODE_ENV=production`.
2. Falta `DATABASE_URL`.
3. La URL contiene un fragmento de base remota: `neon.tech`, `aws`, `azure`,
   `gcp`, `supabase`, `vercel`, `render.com`, `railway`, `pooler`, `ep-`, `br-`,
   `divine-hall`.
4. El host no está en la lista permitida: `localhost`, `127.0.0.1`, `::1`,
   `0.0.0.0`, `host.docker.internal`, `postgres`, `db`, `database`.
5. Hay alguna variable de publicación multi-base en el entorno:
   `DNX_PARTNERS_INFOSPOT_DATABASE_URL`, `DNX_PARTNERS_CLF_DATABASE_URL`,
   `DNX_PARTNERS_FOTORANK_DATABASE_URL`.

Los mensajes de error enmascaran usuario y contraseña: solo muestran protocolo,
host, puerto y nombre de base.

El seed **no llama** a `publishCampaignToApps` ni a `setCampaignPublishTargets`.
La campaña vive solo en la base donde se la sembró.

## Uso

```bash
cd apps/clickaton

# Ver el plan sin escribir nada
DATABASE_URL=postgresql://user:pass@localhost:5432/dnx_demo \
  pnpm exec tsx scripts/partners-demo-comercial-seed.ts --dry-run

# Aplicar
DATABASE_URL=postgresql://user:pass@localhost:5432/dnx_demo \
  pnpm exec tsx scripts/partners-demo-comercial-seed.ts

# Ver qué se borraría
DATABASE_URL=postgresql://user:pass@localhost:5432/dnx_demo \
  pnpm exec tsx scripts/partners-demo-comercial-cleanup.ts --dry-run

# Borrar todo
DATABASE_URL=postgresql://user:pass@localhost:5432/dnx_demo \
  pnpm exec tsx scripts/partners-demo-comercial-cleanup.ts
```

El seed es idempotente: correrlo dos veces actualiza en lugar de duplicar.

La limpieza se guía por el prefijo de slug `demo-comercial-`. No toca nada más, y
deja intacto el catálogo de placements, que es definición del sistema y no dato de
demostración.

### Variables opcionales

| Variable | Default | Para qué |
|---|---|---|
| `DEMO_PARTNERS_DESTINATION_URL` | `http://localhost:3005/demo-partners` | Destino de los enlaces, por si Clickatón no corre en el 3005. El seed le agrega `?marca=<slug>` para que la landing sepa de dónde vino el clic |

## Página de destino

`apps/clickaton/app/(public)/demo-partners/page.tsx`

Responde 404 cuando `NODE_ENV=production` y está marcada `noindex`. Existe para
que el clic en una creatividad termine en una página real y se pueda capturar el
redirect `/r/[trackingKey]` funcionando.

## Pendiente para la etapa siguiente

Nada de esto se hizo todavía: levantar una base efímera, crear los `.env.local`,
encender los flags y sacar las capturas.

### Nota sobre los formatos de archivo

Los cinco logos son PNG, que es como están en el repositorio. `PARTNER_SVG_ENABLED`
vale `false` en `packages/partners/src/assets-limits.ts`, así que el panel de
administración no acepta subir SVG — con PNG el flujo de carga manual desde el panel
también se puede demostrar, sin conversiones.
