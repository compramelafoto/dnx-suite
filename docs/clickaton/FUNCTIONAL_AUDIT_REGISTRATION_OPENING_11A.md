# CLICKATÓN — ETAPA 11A — AUDITORÍA FUNCIONAL COMPLETA PARA APERTURA DE INSCRIPCIONES

**Fecha:** 2026-07-23
**Rama:** `migration-legacy-clf-to-monorepo`
**HEAD:** `abcf27a`
**Alcance:** solo auditoría (sin push, deploy, OAuth, flags, LIVE, DNX Payments mutaciones, WIP ajeno)
**Veredicto:** **NO GO**

---

## Pregunta única

¿Clickatón está listo para abrir las inscripciones al público?

**No.** El funnel técnico de reserva → checkout TEST → confirmación → credencial/QR en DB existe, pero la experiencia de venta pública, entrega al participante, emails, cobro LIVE, SEO de lanzamiento y operación de sede no están cerrados.

---

## 1. Estado Git (auditoría)

| Ítem | Valor |
|---|---|
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD | `abcf27a` |
| Ahead/behind | 0 behind / 12 ahead |
| Push | no |
| Stashes `@{0}`–`@{4}` | intactos |
| WIP ajeno | intacto (no mezclado) |

---

## 2. Inventario por módulos

Leyenda: ✅ COMPLETO · 🟡 FUNCIONA CON AJUSTES · 🔴 INCOMPLETO · ⚫ NO IMPLEMENTADO

### Sitio público

| Módulo | Estado | % | Observaciones |
|---|---|---:|---|
| Home | 🟡 | 72 | Editorial fuerte; eventos = placeholder “Próximamente”; robots noindex |
| Navbar | ✅ | 92 | `mainNavigation` coherente |
| Footer | ✅ | 90 | Incluye Nosotros / Contacto / Manual |
| SEO | 🔴 | 20 | `robots.ts` disallow `/`; prelanzamiento intencional |
| Responsive | 🟡 | 78 | DS presente; sin Lighthouse medido en esta etapa |
| Accesibilidad | 🟡 | 70 | Secciones con aria; sin auditoría a11y formal |
| Performance | 🟡 | 62 | Sin medición Lighthouse; imágenes/placeholders mixtos |
| Landing principal | 🟡 | 72 | Misma que Home |
| Cómo funciona | ✅ | 95 | Contenido + FAQ |
| Sponsors / Formá parte | 🟡 | 82 | Landing comercial sólida; sin CRM ni precios checkout |
| Organizar sede | ✅ | 90 | Landing completa (`/organizar`) |
| Comunidad | 🟡 | 65 | Editorial; sin perfiles/ranking; CTA “sin formulario” |
| Nosotros | 🟡 | 70 | Relato + badges “pendiente aprobación editorial” |
| FAQ | ✅ | 90 | Home + cómo funciona + organizar |
| Contacto | 🟡 | 68 | Persiste en DB; **no envía email** |

### Inscripción / postventa operativa

| Módulo | Estado | % | Observaciones |
|---|---|---:|---|
| Formulario inscripción | 🟡 | 78 | Wizard sede→entrada→datos→review |
| Validaciones | 🟡 | 80 | Server-side OK; rate-limit solo in-memory |
| UX inscripción | 🔴 | 45 | Copy “pago se habilitará después” + `nextStepMessage` “Próximamente” con checkout cableado |
| Carga de foto | ⚫ | 0 | No en wizard |
| Bases / consentimiento | 🟡 | 75 | Terms/privacy; legales mínimos desactualizados |
| Emails inscripción | ⚫ | 5 | Sin templates/triggers |
| Estados | 🟡 | 75 | PENDING_PAYMENT / CONFIRMED; free tickets stuck |
| Recuperación / edición / cancelación | 🔴 | 25 | Solo token `?t=`; sin cancel/edit público |
| Checkout | 🟡 | 70 | TEST/staging OK; flags OFF; sin LIVE |
| Credencial | 🔴 | 40 | Emisión DB al pagar; sin entrega UI/email |
| QR | 🔴 | 35 | Hash-only; plaintext descartado; no llega al usuario |
| Check-in | ⚫ | 15 | Schema + dominio in-memory; sin UI operador |
| Panel participante | 🔴 | 18 | `/mi-cuenta` stub |
| Panel organizador | ⚫ | 10 | Solo landing pública; sin panel autenticado |
| Panel administrador | 🟡 | 78 | Ediciones/sedes/catálogo/inscripciones reales; sponsors stub |
| Jurados | 🔴 | 30 | Frontera FotoRank; sin módulo Clickatón |
| Sponsors CRM | ⚫ | 20 | Admin empty; packs editoriales sin compra |
| Merchandising | 🟡 | 55 | Catálogo admin + kits; sin tienda; operación kit “próximamente” |
| Expo sponsors | 🔴 | 35 | Conceptual en landing |
| Consignas | 🔴 | 25 | Lectura FR / notice; sin release engine |
| Ranking / resultados | 🔴 | 20 | Placeholder público |
| Certificados | ⚫ | 15 | Promesa comercial; no emisión |
| Emails (todos) | ⚫ | 8 | Contacto sin mail; post-pago sin mail |
| WhatsApp | ⚫ | 0 | Sin automatizaciones |
| Integraciones | 🟡 | 55 | FR adaptador; Payments TEST; InfoSpot/CLF copy |
| Seguridad | 🟡 | 65 | Admin allowlist; middleware sin auth; rate-limit débil |
| Base de datos | 🟡 | 72 | Modelos inscripción OK; holds sin cron; anti-dup app-level |

---

## 3. UX — hallazgos

1. **Confianza rota en el funnel de pago:** la página de inscripción afirma que el pago se habilitará “en una etapa posterior” mientras el resumen puede ofrecer checkout.
2. **Home sin ediciones vendibles:** “Próximamente anunciaremos las primeras ciudades” — no hay CTA de compra creíble.
3. **Mi cuenta vacía** tras login: no refuerza la compra.
4. **Legales cortos** y copy que niega pagos actuales.
5. **QR invisible** para el participante → la promesa de acreditación no se cumple en UX.
6. **Sponsors** fuertes en narrativa, débiles en conversión (sin pack comprable).
7. **futureAreas** en navegación aún lista “inscripciones públicas / checkout / términos” como futuros (desfasado).

---

## 4. Seguridad

| Tema | Hallazgo |
|---|---|
| Auth | `dnx_session` + Google OAuth |
| Admin | Allowlist 3 emails / SUPER_ADMIN; no roles por sede |
| Middleware | Solo pathname; auth en layout admin |
| Access token inscripción | HMAC `?t=` — único canal de recuperación |
| Rate limit | In-memory (multi-instancia frágil) |
| Payments LIVE | Owner no conectado; flags OFF (correcto para no vender aún) |
| Secretos | No auditados en esta etapa (restricción: no tocar Payments) |

---

## 5. Performance

Sin Lighthouse CI en esta etapa. Estimación cualitativa:

| Factor | Nota |
|---|---|
| App Next | Estructura app router estándar |
| Imágenes | Mixto: assets reales + placeholders |
| Cache FR | `revalidate` presente en adaptador |
| Bundle | No medido |
| Crons | Ausentes en `vercel.json` (holds) |

**Score estimado performance:** ~62/100 (no bloqueante vs gaps de producto).

---

## 6. Negocio — ¿Hoy puedo vender una inscripción?

| Pregunta | Respuesta |
|---|---|
| ¿Existe un evento publicado comprable con confianza? | **No** (home placeholder / fixtures) |
| ¿El usuario entiende que puede pagar ahora? | **No** (copy contrario) |
| ¿Recibe confirmación por email? | **No** |
| ¿Recibe QR/credencial usable? | **No** |
| ¿Puedo cobrar LIVE con MP Clickatón? | **No** (I1 owner no conectado; flags OFF) |
| ¿Operación de sede puede acreditar? | **No** (sin check-in UI) |

**Conclusión de negocio:** se puede hacer **QA staging** del funnel, no abrir **venta pública**.

---

## 7. Bugs / gaps clasificados

### Críticos (bloquean apertura)

1. Cobro LIVE / owner MP / flags producción no listos (I1 pendiente autorización).
2. Copy inscripción/resumen contradice checkout (“próximamente”).
3. QR/credencial no se entregan al participante.
4. Sin emails de reserva/confirmación.
5. SEO `disallow: /` — sitio no indexable (lanzamiento).
6. Sin edición real publicada alineada ficha pública + Prisma.
7. Entradas `totalAmount === 0` quedan en `PENDING_PAYMENT` sin auto-confirm.
8. Sin cron de expiración de holds → cupos fantasma.

### Altos

9. Panel participante stub.
10. Check-in sin UI.
11. Legales insuficientes / desactualizados.
12. Rate limit no durable.
13. Cancelación/edición pública ausente.
14. Home/CTA sin calendario vendible.

### Medios

15. Sponsors CRM stub.
16. Panel organizador ausente.
17. Resultados/ranking placeholder.
18. Operación kits “próximamente” en admin.
19. Contacto sin notificación email.
20. `futureAreas` desfasado.

### Bajos

21. WhatsApp no implementado.
22. Certificados / consignas release / expo operativa.
23. Galería / hall de la fama / perfiles.
24. Favicon/SVG definitivos.

---

## 8. READY SCORE

| Área | % |
|---|---:|
| Landing / Home | 72 |
| Navbar / Footer | 91 |
| SEO | 20 |
| Cómo funciona | 95 |
| Sponsors / Formá parte | 82 |
| Organizar sede | 90 |
| Comunidad | 65 |
| Nosotros | 70 |
| FAQ | 90 |
| Contacto | 68 |
| Inscripción | 55 |
| Checkout (TEST) | 70 |
| Checkout (LIVE listo) | 15 |
| Credencial | 40 |
| QR (usable) | 35 |
| Check-in | 15 |
| Panel participante | 18 |
| Panel organizador | 10 |
| Panel admin | 78 |
| Jurados | 30 |
| Merchandising | 55 |
| Ranking / resultados | 20 |
| Certificados | 15 |
| Emails | 8 |
| WhatsApp | 0 |
| Seguridad | 65 |
| Performance | 62 |
| Integraciones | 55 |
| Base de datos | 72 |

### READY SCORE GENERAL (ponderado a “abrir venta”)

Pesos altos en: inscripción, checkout LIVE, emails, QR usable, edición publicada, legales, SEO lanzamiento, mi-cuenta mínima.

## **47 / 100**

---

## 9. GO / NO GO

# 🔴 NO GO

**Justificación técnica:** el core de reserva/pago TEST está avanzado, pero abrir al público hoy implicaría vender sin (1) cobro LIVE confiable, (2) confirmación por email, (3) entrega de QR/credencial, (4) copy/legal coherentes, (5) edición real anunciada, (6) recuperación de acceso robusta, (7) operación de holds y (8) indexación/lanzamiento controlado. Eso es riesgo de reputación y soporte inaceptable.

---

## 10. Qué falta exactamente para abrir la venta (P0)

1. Publicar al menos **una edición real** (Prisma + ficha pública alineada + fechas/cupos).
2. Corregir **copy** de inscripción/resumen (eliminar “pago próximamente”).
3. Cerrar **legales** (términos/privacidad con pagos y datos).
4. Completar **I1 owner MP** + configuración app + microtx controlada (etapas I posteriores; fuera de 11A).
5. Activar checkout productivo solo tras gates I1–I9 (no en 11A).
6. **Email** mínimo: reserva + pago confirmado (+ link acceso).
7. **Entrega QR/credencial** (email y/o mi-cuenta).
8. Path **entradas gratis** (auto-confirm + credencial).
9. **Cron** expire holds.
10. **Mi cuenta**: listar inscripción + estado + acceso token.
11. Activar **robots** indexables en go-live.
12. Runbook ops: MANUAL_REVIEW, webhook fail, soporte.

---

## 11. Roadmap de cierre — prompts sugeridos (2–6 h c/u)

### PRIORIDAD CRÍTICA

1. **11A1 — Copy funnel inscripción/pago**
   Eliminar mensajes “próximamente” inconsistentes; alinear CTA home→maratón→inscripción.

2. **11A2 — Legales v1 pagos + consentimiento versionado**
   Términos/privacidad reales; timestamps con versión de bases.

3. **11A3 — Emails mínimos post-reserva y post-pago**
   Templates + trigger; link con `?t=`; sin WhatsApp aún.

4. **11A4 — Entrega credencial/QR al participante**
   Mostrar/descargar en resumen + mi-cuenta; no loguear plaintext.

5. **11A5 — Auto-confirm entradas gratis**
   `totalAmount=0` → CONFIRMED + credencial sin checkout.

6. **11A6 — Cron expire registration holds**
   Vercel cron o job managed; métricas cupo.

7. **11A7 — Edición piloto publicada end-to-end**
   Admin publish + ficha pública + fixture/FR sync checklist.

8. **11B — Cierre pagos LIVE (continuación I1→I6 acotada)**
   Solo tras autorización owner; fuera del alcance de “features Clickatón UI”.

### PRIORIDAD ALTA (primera semana de venta)

9. **11C — Mi cuenta: mis inscripciones**
10. **11D — Check-in operador MVP (scan QR)**
11. **11E — Cancelación / política de reembolso UI**
12. **11F — Rate limit durable + hardening prod**
13. **11G — SEO go-live (robots, OG, sitemap)**
14. **11H — Runbook soporte + MANUAL_REVIEW queue**

### PRIORIDAD MEDIA

15. **11I — Panel organizador sede (lectura + check-in)**
16. **11J — Sponsors CRM básico (10E)**
17. **11K — Export CSV inscripciones**
18. **11L — Operación kits en acreditación**

### PRIORIDAD BAJA

19. WhatsApp automatizaciones
20. Ranking/resultados públicos
21. Certificados
22. Expo stands
23. Comunidad perfiles
24. Tienda merch standalone

---

## 12. Limitaciones de esta auditoría

- Sin Lighthouse CI numérico.
- Sin browse E2E productivo (restricción no deploy / no LIVE).
- Sin modificar Payments ni abrir OAuth.
- Evidencia principalmente código + docs + selfchecks previos (H2 sandbox).

---

## 13. Veredicto final

> **Clickatón todavía no está listo para abrir inscripciones.** Falta cerrar el funnel de venta creíble (edición real + copy/legal), la entrega post-pago (email + QR/credencial + mi-cuenta), la operación de cupos (cron holds), el path gratis, y el cobro LIVE (continuación controlada de I1→I6) antes de un GO.
