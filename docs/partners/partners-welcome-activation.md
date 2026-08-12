# DNX Partners — Activación destacada de sponsor

**Etapa:** Sponsor Global / Etapa 06 (admin + validación controlada)  
**Estado:** circuito administrativo en Clickatón `/admin/sponsors/[id]/campanas`; runtimes E3–E5 montados; **flags OFF por defecto**; **sin deploy productivo**.

## Qué es

Una **activación destacada** es un interstitial controlado (`WELCOME_INTERSTITIAL`) que muestra una pieza aprobada de un sponsor en una **superficie autorizada**. Nombre visible: **Activación destacada**. Descripción: *Ventana patrocinada que aparece una vez cada 24 horas en una superficie autorizada.*

## Flujo administrativo (Etapa 06)

Panel: **Clickatón** → Sponsors → ficha → **Campañas**.

1. Seleccionar sponsor existente.
2. Registrar asset (URL pública + alt) o reutilizar aprobado.
3. Crear campaña `DRAFT` (app autorizada, URL, vigencia, prioridad).
4. Creative `WELCOME_INTERSTITIAL` + asset aprobado + destino seguro.
5. **Alcance explícito** (participación GLOBAL / PLATFORM / EDITION / CONTEST / ALBUM) vía selector — **sin IDs a mano**.
6. Vincular **placement montado** únicamente.
7. Validar antes de publicar (errores + advertencia si flag OFF).
8. Preview = `PartnerWelcomeInterstitial` (sin impresión/clic/frecuencia).
9. Publicación multi-DB con snapshot público mínimo (reutiliza publisher existente).
10. Consultar sync por destino; analytics sin métricas inventadas; pausar campaña.

Dominio: `packages/partners/src/welcome-admin.ts`.  
Mutaciones UI: `apps/clickaton/lib/admin/partners/welcome-admin-mutations.ts`.  
Selectores: `WelcomeScopeLinkForm` + `WelcomeContextPicker` + `welcome-context-search.ts`.  
Preview: `WelcomeInterstitialAdminPreview`.

### Alcances

| Alcance | App | Contexto |
|---------|-----|----------|
| Global | Varias autorizadas | Participación `GLOBAL` explícita (no `null`) |
| Plataforma | Una | Participación `PLATFORM` explícita |
| Evento/edición | Clickatón | ID canónico edición |
| Concurso | FotoRank | ID canónico concurso |
| Álbum | CLF | ID canónico álbum |

Campañas **huérfanas** (`participation=null`) se **rechazan**. No interpretar `null` como global.

### Placements publicables (montados)

| App | Placement | Superficie |
|-----|-----------|------------|
| Clickatón | `CLICKATON_EVENT_WELCOME` | `/maratones/[slug]` |
| FotoRank | `FOTORANK_CONTEST_WELCOME` | `/concursos/[slug]` |
| InfoSpot | `INFOSPOT_HOME_WELCOME` | Home |
| CLF | `CLF_ALBUM_WELCOME` | `/album/[slug]` |

**Deshabilitados** (catálogo técnico, “Superficie todavía no habilitada”):  
`CLICKATON_HOME_WELCOME`, `FOTORANK_HOME_WELCOME`, `CLF_HOME_WELCOME`.

**Excluido:** FotoOffice (selector, placements, targets, preview, globales).

### Flags (solo lectura en panel)

| Flag | Runtime |
|------|---------|
| `CLICKATON_PARTNER_WELCOME_ENABLED` | CK evento |
| `FOTORANK_PARTNER_WELCOME_ENABLED` | FR concurso |
| `INFOSPOT_PARTNER_ADS_ENABLED` | IS |
| `CLF_PARTNER_ADS_ENABLED` | CLF kill switch |
| `CLF_PARTNER_ALBUM_WELCOME_ENABLED` | CLF álbum |

Publicar con flag OFF: permitido tras advertencia  
*“La campaña quedará configurada, pero no será visible mientras el runtime esté deshabilitado.”*  
El panel **no** modifica variables de Vercel.

### Validación previa

`validateWelcomeCampaignBeforePublish`: sponsor ACTIVE, formato, app, placement montado, FO ausente, alcance explícito, creative/asset aprobados, URL vía `assertSafePartnerDestinationUrl`, flags documentados.

### Preview

Mismo componente runtime; `href=null`; frequency store en memoria; label “Vista previa”; sin tracking.

### Analytics

Panel existente por app / placement / campaña / sponsor; ceros o “Sin actividad”; sin dismiss central.

### Prueba sintética

Tests: `partners-welcome-admin.test.ts` + `partners-welcome-admin-e2e.test.ts` (memoria, residuales 0).  
Sin sponsors/eventos/concursos/álbumes/pagos reales. Sin escritura productiva.

### Activación futura (no Etapa 6)

1. Fixture/staging aislado.
2. Flags locales o staging ON.
3. Validar superficies.
4. Solo entonces considerar producción (Etapa 7 — no iniciada).

## Arquitectura pública CLF — álbum (Etapa 05)

| Campo | Valor |
|-------|--------|
| Ruta canónica | `/album/[slug]` |
| Placement | `CLF_ALBUM_WELCOME` |
| Flags | `CLF_PARTNER_ADS_ENABLED` **y** `CLF_PARTNER_ALBUM_WELCOME_ENABLED` |

## Superficies previas

| Etapa | Placement | App |
|-------|-----------|-----|
| 03 | `CLICKATON_EVENT_WELCOME` | Clickatón |
| 04 | `FOTORANK_CONTEST_WELCOME` | FotoRank |
| — | `INFOSPOT_HOME_WELCOME` | InfoSpot |
| 05 | `CLF_ALBUM_WELCOME` | CLF |

## Limitaciones

- Homes CK/FR/CLF no montados.
- Sin migraciones Etapa 6.
- Frequency local; dismiss no central.
- Selectores contextuales dependen de datos en la misma DB administrativa (Clickatón).

## Código de referencia

| Pieza | Ruta |
|-------|------|
| Admin welcome dominio | `packages/partners/src/welcome-admin.ts` |
| Campañas UI | `apps/clickaton/app/admin/(panel)/sponsors/[partnerId]/campanas/page.tsx` |
| Preview | `WelcomeInterstitialAdminPreview.tsx` |
| Contexto scope | `packages/partners/src/campaign-edition-context.ts` |

## Próxima etapa (propuesta — **no iniciar**)

Elegir una: activación controlada en producción · montaje `CLF_HOME_WELCOME` · reporte comercial sponsors.
