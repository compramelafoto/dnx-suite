# ETAPA LEGAL — IMPLEMENTACIÓN 01  
## Propiedad intelectual y denuncias de contenido

**Estado técnico:** PARTIAL (flujo funcional implementado; **no** es cumplimiento legal definitivo)  
**ACCIÓN LEGAL REQUERIDA:** **SÍ**  
**Fecha:** 2026-08-03  
**Ramas:** `feat/legal-ip-content-reports-etapa01` (Legacy y Monorepo)

---

## 1. Resumen

Se auditaron **CLF Legacy** (`/Users/danielcuart/Desktop/compramelafoto`) y **CLF Monorepo** (`dnx-suite/apps/compramelafoto` + `packages/db`).

Ambos tenían términos, privacidad/ARCO, consentimiento biométrico y remoción por **derecho de imagen** (`RemovalRequest`).  
**No** existía un sistema de denuncias de **propiedad intelectual**, página dedicada, cola admin, ocultamiento preventivo trazable por denuncia PI, ni contraparte/descargo formal.

Esta etapa implementa el **mínimo sistema funcional** de forma aditiva, sin deploy, sin push y sin migraciones productivas aplicadas.

---

## 2. Qué existía (no duplicado)

### Legacy y Monorepo (equivalente)

| Elemento | Ruta / archivo | Notas |
|----------|----------------|-------|
| Términos | `/terminos`, `lib/terms/photographerTerms*.ts` | Declaran autoría, licencia operativa, derechos de imagen, remoción |
| Privacidad | `/privacidad` + ARCO `/privacidad/solicitud` | Incluye “Ocultar foto” |
| Remoción derecho de imagen | `/a/[id]/remover/[photoId]`, `RemovalRequest` | Decisión hoy en panel fotógrafo |
| Visibilidad foto | `Photo.isRemoved` | Ya excluye de galería/compra en varios flujos |
| Aceptación términos álbum | `Album.termsAcceptedAt` / `termsVersion` | Trazable |
| Rate limit / email | `lib/rate-limit`, `emails/send`, Resend | Reutilizado |
| Admin ARCO | `/admin/privacidad/solicitudes` | Patrón UI reutilizado |
| Contacto privacidad | `privacidad@compramelafoto.com` / `PRIVACY_CONTACT_EMAIL` | Sin email legal dedicado verificado |

**No se reescribieron** términos completos ni se creó un sistema paralelo de remoción por imagen.

---

## 3. Qué faltaba e implementado

1. Página pública `/propiedad-intelectual`
2. Formulario `/propiedad-intelectual/denunciar`
3. Modelo `ContentReport` + `ContentReportEvent`
4. API pública `POST /api/content-reports`
5. Admin `/admin/propiedad-intelectual/denuncias` (+ detalle)
6. APIs admin GET/PATCH
7. Ocultamiento preventivo / restauración / retiro lógico vía `Photo.isRemoved` + razón `content_report:{id}:…`
8. Notificaciones (si hay `RESEND_API_KEY` + `EMAIL_FROM`; si no, skip seguro en local)
9. Footer: enlaces PI + Denunciar
10. Contadores de reincidencia en detalle admin (sin sanción automática)
11. Tests unitarios de validación, compra bloqueada por `isRemoved`, footer
12. Migración SQL aditiva (no aplicada a producción)

---

## 4. Bases de datos

| Proyecto | Schema | Migración |
|----------|--------|-----------|
| Legacy | `prisma/schema.prisma` | `prisma/migrations/20260803120000_content_reports_ip/` |
| Monorepo | `packages/db/prisma/schema.prisma` | `packages/db/prisma/migrations/20260803120000_content_reports_ip/` |

**Bases independientes.** No compartir migración entre Legacy y Monorepo en runtime.

**No se aplicó migrate en producción.** Para local/staging:

```bash
# Legacy (solo local/staging autorizado)
npx dotenv-cli -e .env.local -- prisma migrate deploy

# Monorepo (según proceso de @repo/db / staging)
pnpm --filter @repo/db … # seguir runbook interno; backup si staging
```

---

## 5. Rutas

### Públicas
- `/propiedad-intelectual`
- `/propiedad-intelectual/denunciar`
- `POST /api/content-reports`

### Administrativas (rol ADMIN)
- `/admin/propiedad-intelectual/denuncias`
- `/admin/propiedad-intelectual/denuncias/[id]`
- `GET /api/admin/content-reports`
- `GET|PATCH /api/admin/content-reports/[id]`

---

## 6. Flujo de denuncia

1. Usuario completa formulario (validación Zod, honeypot, rate limit 5/h/IP).
2. Se resuelve foto/álbum/fotógrafo desde URL cuando es posible.
3. Se crea `ContentReport` (`RECEIVED`) + evento `CREATED`.
4. Email de confirmación al denunciante (si Resend configurado).
5. Aviso al fotógrafo **sin** datos personales del denunciante (si hay email).
6. Admin revisa, puede pedir info, ocultar, restaurar o retirar (con razón + auditoría `AdminLog` + `ContentReportEvent`).
7. Foto con `isRemoved=true` no aparece en listados públicos ni en varios flujos de compra existentes.

---

## 7. Ocultamiento y restauración

- **Preventivo / retiro:** `Photo.isRemoved = true` + `removedReason = content_report:{id}:temporary|removed`.
- **Álbum completo (sin photoId):** `Album.isPublic=false`, `isHidden=true` + fotos del álbum marcadas.
- **No** se eliminan archivos de R2 automáticamente.
- **Restauración:** solo si `removedReason` pertenece a esa denuncia (no pisa remociones por derecho de imagen).

---

## 8. Declaraciones del fotógrafo

No se agregaron checkboxes por cada subida.  
Las declaraciones de autoría/licencia/imagen ya viven en `photographerTerms` / `photographerTermsExtended` con aceptación versionada.  
La página PI las resume y enlaza a Términos.

**[LEGAL_REVIEW]** Confirmar si basta la aceptación contractual actual o se requiere checkbox adicional en onboarding.

---

## 9. Textos que requieren revisión jurídica

- Redacción final de Términos y Política de PI
- Alcance de licencias a ComprameLaFoto
- Procedimiento de retiro y descargo / plazos
- Tratamiento de datos de denunciantes y conservación de evidencias
- Responsabilidad de la plataforma
- Jurisdicción y ley aplicable
- Aplicación o no de DMCA formal
- Derechos de imagen y menores
- Consecuencias de reclamos abusivos / reincidencias
- Completar `[PLACEHOLDER_LEGAL]` (razón social, domicilio, CUIT, representante) con datos reales

---

## 10. Riesgos técnicos pendientes

1. **Crítico preexistente:** `POST/PATCH /api/dashboard/removal-requests` aún tienen `TODO: Implementar autenticación` (aceptan `photographerId` del cliente). Fuera del alcance mínimo PI, pero debe corregirse antes de depender del flujo de imagen.
2. ARCO `OCULTAR_FOTO` no oculta automáticamente la foto al resolverse (preexistente).
3. No hay política/banner de cookies dedicado (preexistente).
4. Divergencia Legacy vs Mono en términos fotógrafo Info Spot (`docs/clf-migration/09-legal-human-review.md`) — **LEGAL_BLOQUEANTE** para cutover, no introducida por esta etapa.
5. Migración aún no aplicada en ningún entorno de este trabajo.

---

## 11. Pruebas

```bash
# Legacy
npm run test:content-reports

# Monorepo
pnpm --filter compramelafoto run test:content-reports
```

---

## 12. Confirmaciones operativas

- No deploy a producción
- No push
- No commit (salvo instrucción expresa posterior)
- No se alteró contenido real de usuarios
- No se afirmar cumplimiento legal completo
- Working tree ajeno (cuantocobro / clickaton / partners) no se modificó intencionalmente
