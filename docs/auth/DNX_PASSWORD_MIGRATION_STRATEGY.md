# Estrategia de migración de contraseñas DNX

**Etapa:** 10B.4

---

## Formatos auditados

| Formato | Origen | Campo | Estado |
| ------- | ------ | ----- | ------ |
| **scrypt** `saltHex:digestHex` | `@repo/auth`, InfoSpot, FotoRank, FotoOffice, Clickatón | `User.password` | **Canónico** (`scrypt_v1`) |
| **bcrypt** `$2a$` / `$2b$` / `$2y$` | Histórico CLF (register/login/reset) | `User.password` | Legacy aceptado |
| Base64 JSON | Cookie CLF `auth-token` | N/A (no es hash de password) | Legacy sesión |
| scrypt en `passwordHash` | `FotorankJudgeAccount` | Paralelo (no User) | Fuera de alcance User |

No se encontró argon2 ni plaintext persistido en `User.password`.

---

## Formato canónico

```text
scrypt_v1 = `${salt16bytesHex}:${scryptDigest64bytesHex}`
```

API: `hashPassword()` / `detectPasswordHashFormat()` en `@repo/auth`.

---

## Migración progresiva (sin reset masivo)

En cada login exitoso vía `verifyUserPassword`:

1. Detectar formato (`bcrypt_legacy` | `scrypt_v1` | `unknown`).
2. Verificar con `verifyPassword` (dual).
3. Si válido y legacy → rehashear con `hashPassword`.
4. Guardar formato canónico en `User.password`.
5. Invalidar el hash anterior (overwrite).
6. Mantener sesión válida.

**No** migrar sin conocer el texto plano.  
**No** pedir restablecimiento masivo si la verificación dual funciona.

---

## Casos especiales

| Caso | Acción |
| ---- | ------ |
| Usuario solo Google (`password` null) | Sin migración; opcional set password vía reset |
| Hash `unknown` | Login falla; campaña de reset controlada |
| Jurado FotoRank | Identidad paralela; no mezclar con User hasta ADR de unificación |
| Escritura nueva | Siempre `hashPassword` (scrypt) — CLF ya migrado en 10B.4 |

---

## Apps actualizadas (escritura)

- CLF register / reset / change-password / admin create → `hashPassword`
- CLF / Clickatón / FotoRank / InfoSpot / FotoOffice login → `verifyUserPassword` (rehash)

---

## Campaña de reset (solo si hace falta)

Activar únicamente si aparecen hashes no verificables (`unknown`) o corrupción.  
Alcance: email + token central `PasswordResetToken` (`requestPasswordReset`).
