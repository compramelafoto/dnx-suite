# Validación cross-app Staging — identidad DNX

**Fecha:** 2026-07-29  
**Etapa:** 10B.6.2  

**Estado:**

```text
FOTORANK DOMAIN MIGRATION BLOCKED
```

---

## 1. Credencial / acceso Neon

| Chequeo | Resultado |
| ------- | --------- |
| `NEON_API_KEY` en env del proceso | Ausente |
| Auth efectiva | OAuth `neonctl` — válida |
| Clickatón Staging `plain-sky-50672248` / `ep-divine-smoke…` | OK |
| DNX Staging Identity `fragrant-union-80829821` / `ep-round-fog…` / `neondb` | OK |
| FotoRank `ep-empty-moon…` | **No** en org — permission/visibility insuficiente para ese host |

No se usó Production.

---

## 2. Topología post-cutover (sanitizada)

| App / rol | Host | DB | Estado |
| --------- | ---- | -- | ------ |
| Clickatón Staging (runtime) | `ep-round-fog-a4xgibtv-pooler…` | `neondb` | **Identidad compartida** — health 6 ediciones |
| Origen Clickatón (conservado) | `ep-divine-smoke-av8hmt7s…` | `clickaton_staging` | Intacta (no delete) |
| ComprameLaFoto monorepo Preview | `ep-round-fog…` | `neondb` | Misma DB identidad |
| FotoRank Preview (objetivo) | override Encrypted branch → identidad | `neondb` | Env alineada; **deploy ERROR**; dominio vacío (0 contests) |
| FotoRank histórico | `ep-empty-moon…` | ? | Inaccesible vía Neon API org Dnx |

`source != destination` en el cutover: divine-smoke ≠ round-fog.

---

## 3. Backups

| Nombre lógico | Branch Neon | Endpoint | Verificado |
| ------------- | ----------- | -------- | ---------- |
| `backup-before-identity-cutover` | `br-polished-night-avzrcfq6` | `ep-winter-unit…` | Editions 6 / Users 7 / Regs 11 / migs 85 |
| `backup-before-clickaton-import` | `br-patient-breeze-a4zmb4pl` | `ep-purple-dawn…` | Users 3 / Sessions 40 / sin Clickatón |

---

## 4. Cutover Clickatón

| Paso | Estado |
| ---- | ------ |
| migrate deploy destino | OK (~89 migrations) |
| Dry-run | Limpio |
| Execute phase 1 (users + map) | OK — batch `cutover-2026-07-29T07:13:48.698Z` |
| Phase 2 (dominio + remap FK) | OK |
| Integridad crítica | **0** diffs (Editions/Venues/Tickets/Regs) |
| Orphan FKs | 0 |
| Email duplicates | 0 |

Deploy Clickatón Staging: `dpl_4XU5Xd9aCGgZGHBfEVnoS8LnKfLg`.

---

## 5. Fixtures 1–6

Comando: `pnpm auth:cross-app:fixtures` (DB = round-fog).

```text
ALL FIXTURES PASS
```

Mismo `User.id` en registro/login/reset/Google para los casos 2–6; fixture 1 confirma seed histórico CLF monorepo.

---

## 6. FotoRank — por qué no READY

1. No hay proyecto Neon con `ep-empty-moon…` en la org → no backup API ni export dominio.  
2. Round-fog tiene tablas Fotorank* WIP (jury/results/rules) **sin** modelos Prisma alineados → Preview build ERROR.  
3. `FotorankContest` count en destino = **0** → no hay migración de dominio de concursos.  
4. Production FotoRank no se tocó (correcto).

Desbloqueo mínimo para pasar a READY:

- Recuperar acceso al proyecto/host empty-moon **o** confirmar que Preview nunca tuvo datos críticos.  
- Alinear `schema.prisma` + client con migraciones ya aplicadas (o revertir tablas WIP).  
- Deploy Preview verde apuntando a round-fog.  
- Re-ejecutar fixtures + smoke login FotoRank.

---

## 7. Controles de seguridad Staging

| Control | Estado |
| ------- | ------ |
| Production DBs | No modificadas |
| MP LIVE OAuth | No ejecutado |
| Credenciales MP Staging | `credenciales_de_prueba` |
| Rollout `@repo/auth-ui` | Pendiente READY |
| Guest registration decision | Intacta (doc Clickatón) |

---

## 8. Veredicto

```text
FOTORANK DOMAIN MIGRATION BLOCKED
```

No declarar `DNX UNIVERSAL ACCOUNT READY IN STAGING` hasta que FotoRank Preview use la identidad compartida con dominio preservado (o explícitamente vacío y aceptado) y deploy saludable.
