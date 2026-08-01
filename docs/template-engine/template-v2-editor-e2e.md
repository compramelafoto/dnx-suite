# Template V2 — Smoke E2E del editor (P0-04)

## Flujo real del editor (auditoría)

| PANTALLA | ACCIÓN | ENDPOINT | REQUEST | RESPUESTA | ESTADO UI |
|---|---|---|---|---|---|
| `/fotografo/diseno/plantillas/v2` | Abrir dashboard | — | — | SSR listado | `template-v2-dashboard` |
| Dashboard | Nueva plantilla | `POST /api/template-v2/templates/create` | `{}` | `{ ok, templateId, versionId }` | Navega al editor |
| `/fotografo/diseno/plantillas/v2/:tid/:vid` | Carga inicial | `GET .../versions/:vid/save` | — | canvas/blocks/revision | Canvas listo / error |
| Editor | Autosave (2s debounce) | `PUT .../versions/:vid/save` | payload + `revision` | `{ ok, revision, updatedAt }` o `409` | Badge Guardando/Guardado/Error |
| Editor | Guardar manual (⌘S / botón) | mismo PUT | idem | idem | Banner error si falla |
| Editor | Nueva versión | `POST .../save-as-new-version` | payload + branch | `{ versionId }` | Navega a nueva versión |
| Editor | Subir imagen | `POST .../versions/:vid/image-upload` | multipart `file` | `{ url, storageKey? }` | Inserta src en bloque |
| Editor | Validar | *(sin UI)* → `POST .../validate` | draft opcional | `{ valid, errors, warnings }` | — |
| Dashboard/API | Duplicar | `POST .../duplicate` | `{ name? }` | nuevo templateId | *(sin botón UI aún)* |
| Editor | Cerrar con dirty | modal salida | — | — | Guardar / salir / cancelar |
| Editor | Conflicto 409 | PUT save | `revision` obsoleta | `409 revision_conflict` | Banner + bloqueo save + Recargar |

**Notas**

- Dimensiones default create: **1200×1800** (el E2E siembra 1080×1350 vía save).
- `Texto(T)` activa herramienta de colocación; **Variable** / **Forma** insertan bloques.
- Preview PNG server: `POST /api/template-v2/preview` → **image/png** (P0-05; Chromium; draft sin guardar).
- Privadas ajenas → **404** (no 403).

## Framework

- **Playwright** (`@playwright/test`), alineado con FotoRank.
- Config: `apps/compramelafoto/playwright.config.ts`
- Specs: `apps/compramelafoto/e2e/template-v2*.spec.ts`
- Evidencias on failure: screenshot, trace, video, HTML report.

## Arquitectura del test

```text
login API (dnx_session)
  → UI dashboard/editor (smoke)
  → helpers API (validate/duplicate/conflict/auth/vars/versions)
  → cleanup DELETE / listado por prefijo E2E
```

No mockea el frontend: el navegador usa Next real + APIs restauradas.

## Fixtures

- Usuarios: `e2e.template.v2.a@test.local` / `.b@test.local` (script ensure, solo localhost DB).
- Payload legacy: `e2e/fixtures/legacy-school-payload.json`
- Imagen: PNG 1×1 inline en spec de upload.
- Nombres: `E2E TEMPLATE V2 — <runId> …`

## Autenticación

```bash
CLF_E2E_PHOTOGRAPHER_PASSWORD='…' \
  pnpm --filter compramelafoto e2e:ensure-template-v2-photographers
# escribe apps/compramelafoto/.env.e2e.local (gitignored)
```

Variables:

| Var | Uso |
|---|---|
| `CLF_E2E_PHOTOGRAPHER_A_EMAIL` / `_PASSWORD` | Fotógrafo A |
| `CLF_E2E_PHOTOGRAPHER_B_EMAIL` / `_PASSWORD` | Fotógrafo B |
| `PLAYWRIGHT_BASE_URL` | default `http://127.0.0.1:3002` |
| `CLF_E2E_RUN_ID` | opcional, aislación de nombres |

Nunca commitear credenciales.

## Escenarios

1. **Smoke principal** — create UI → editor → edit → save → reload → validate → duplicate
2. **Concurrencia** — dos contextos; A guarda; B 409; UI banner + no overwrite
3. **Autorización** — B no GET/PUT/duplicate/DELETE plantilla de A (404)
4. **Variables** — `{alumno}` / `student.fullName` OK; `__proto__` / `constructor.prototype` rechazados
5. **Legacy round-trip** — fixture escolar → save → read
6. **Versionado** — list versions; revision++; save-as-new-version (versión ≠ revisión)
7. **Image upload** — MIME; skip/blocked si R2 staging ausente
8. **Preview PNG** — draft no guardado → botón Vista previa → dialog + imagen blob; binding escolar con datos de ejemplo
9. **Clickatón presets** — crear Bienvenid@ / Soy parte → preview; catálogo `participant.*`; Instagram vacío OK

## Selectores

| testid | Uso |
|---|---|
| `template-v2-dashboard` | listado |
| `template-v2-create-button` | crear |
| `template-v2-editor` | shell |
| `template-v2-canvas` | lienzo |
| `template-v2-save-button` | guardar |
| `template-v2-save-status` | badge |
| `template-v2-error-banner` | errores / 409 |
| `template-v2-conflict-reload` | CTA recarga |
| `template-v2-preview-button` | abrir preview PNG |
| `template-v2-preview-dialog` | modal preview |
| `template-v2-preview-image` | `<img>` blob PNG |
| `template-v2-preview-error` | error estructurado |

Preferencia: role/label primero; testids solo donde hace falta.

## Comandos

```bash
# preparar usuarios (local DB)
CLF_E2E_PHOTOGRAPHER_PASSWORD='…' pnpm --filter compramelafoto e2e:ensure-template-v2-photographers

# cargar env E2E
set -a && source apps/compramelafoto/.env.e2e.local && set +a

# suite focalizada
pnpm --filter compramelafoto test:e2e:template-v2
```

### Local

- base URL: `http://127.0.0.1:3002`
- DB: localhost (script ensure aborta si no)
- storage: R2 staging/test si está en `.env.local`; si no, image-upload se marca blocked

### Staging

- `PLAYWRIGHT_BASE_URL=https://<staging>`
- mismas vars de fotógrafos E2E (secrets CI)
- **no** producción

## Limpieza

- `DELETE /api/template-v2/templates/:id` al final de cada spec
- `cleanupE2ETemplatesByPrefix` por nombre `E2E TEMPLATE V2`
- No borra assets R2 compartidos

## Conflicto 409 (UI)

Mensaje:

> Esta plantilla fue modificada en otra pestaña o por otra persona. Recargá la versión más reciente antes de volver a guardar.

Comportamiento: **sin retry automático**, banner `role="alert"`, botón Recargar, `revisionConflictLocked` hasta reload.

## Deuda / limitaciones

- Create UI no pide nombre ni dimensiones (se siembra vía API en smoke).
- Duplicate / Validate sin botón en UI → helpers API.
- Image upload depende de R2 configurado (escenario skipped si falta bucket).
- DB local puede no tener tablas TemplateV2*: usar `e2e:ensure-template-v2-tables` (DDL local-only, no migración Prisma).
- Modal “ubicación de trabajo” se suprime vía sessionStorage + “Ahora no”.
- Preview PNG fuera de alcance.
- Typecheck global CLF puede fallar por BigInt/`@repo/payments` (preexistente).

Errores de consola permitidos (documentados): 404/400 de assets chrome (`LOGO CLF.png`), HMR/DevTools.

## Evidencias

- `apps/compramelafoto/test-results/template-v2/`
- `apps/compramelafoto/playwright-report/template-v2/`
