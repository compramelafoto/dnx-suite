# ComprameLaFoto — Diagnóstico runtime Preview monorepo

**Fecha:** 2026-07-09  
**Preview URL:** `https://compramelafoto-dnxsuite-b5dmuuqr3-compramelafotos-projects.vercel.app`  
**Deployment:** `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK`  
**Commit:** `79b07129fee8172e1889b705f2fdfbbe125cd358`  
**Rama:** `migration-legacy-clf-to-monorepo`

**Restricciones respetadas:** sin producción · sin DNS · sin deploy · sin modificar variables · sin migraciones.

---

## Resumen ejecutivo

| Síntoma reportado                         | Causa más probable                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Home sin álbumes                          | **DB staging vacía** (`Album`: 0 filas)                                |
| Login no funciona con usuarios existentes | **Usuarios solo en producción** (`User`: 0 filas en staging)           |
| `/blog` → 500                             | **Tablas blog no existen** en DB (`BlogPost`, `BlogCategory` = `null`) |
| Botones sin efecto                        | **DB vacía + env preview incompleto** (sin R2, MP, Resend, AWS)        |

**Causa raíz combinada:** el preview despliega código monorepo correctamente, pero apunta a una **base staging recién migrada y vacía**, con **schema incompleto para blog** (modelos en Prisma sin migración aplicada) y **solo 10 variables de entorno** en target preview (faltan integraciones críticas).

---

## 1. Logs runtime Vercel

**Deployment auditado:** `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK`  
**Proyecto:** `compramelafoto-dnxsuite` (`prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He`)

| Fuente                                            | Resultado     |
| ------------------------------------------------- | ------------- |
| `GET /v1/projects/.../runtime-logs`               | **0 eventos** |
| `GET /v3/deployments/.../events` (runtime filter) | **0 eventos** |
| Build logs vía API                                | **0 eventos** |

**Interpretación:** la API de logs no devolvió trazas runtime para este deployment (común en serverless sin tail activo o retención limitada). **No se pudieron extraer errores reales de logs** en esta sesión.

### Probe HTTP automatizado (limitación)

Requests sin sesión Vercel al preview URL devuelven **`Login – Vercel`** (Deployment Protection), no la app CLF:

| Ruta                 | HTTP | Respuesta observada             |
| -------------------- | ---- | ------------------------------- |
| `/`                  | 200  | HTML `Login – Vercel`           |
| `/blog`              | 200  | HTML `Login – Vercel`           |
| `/login`             | 200  | HTML `Login – Vercel`           |
| `/api/auth/session`  | 200  | HTML `Login – Vercel` (no JSON) |
| `/api/public/albums` | 200  | HTML `Login – Vercel` (no JSON) |

> El usuario con acceso Vercel ve la app real; los probes automatizados no atraviesan Deployment Protection. Los síntomas manuales se correlacionan con DB + schema + env, no con el gate de Vercel.

### Errores inferidos por código + DB (no desde logs)

| Ruta / área              | Error esperado en servidor                                             |
| ------------------------ | ---------------------------------------------------------------------- |
| `/blog`                  | `PrismaClientKnownRequestError` — `relation "BlogPost" does not exist` |
| `/api/public/albums`     | 200 con `[]` (sin error, lista vacía)                                  |
| `/login` (credenciales)  | Auth falla — usuario no encontrado en `User`                           |
| Features con R2/MP/email | Fallo en runtime al invocar SDK sin credenciales                       |

---

## 2. Variables ENV Preview (`compramelafoto-dnxsuite`)

**Solo nombres — valores no expuestos.**

### Variables presentes en target `preview` (10)

| Variable               | En preview |
| ---------------------- | ---------- |
| `DATABASE_URL`         | ✅         |
| `DIRECT_URL`           | ✅         |
| `AUTH_SECRET`          | ✅         |
| `AUTH_URL`             | ✅         |
| `APP_URL`              | ✅         |
| `COOKIE_DOMAIN`        | ✅         |
| `GOOGLE_CLIENT_ID`     | ✅         |
| `GOOGLE_CLIENT_SECRET` | ✅         |
| `GOOGLE_REDIRECT_URI`  | ✅         |
| `NEXT_PUBLIC_APP_URL`  | ✅         |

### Checklist solicitado

| Variable                       | Estado en proyecto Vercel |
| ------------------------------ | ------------------------- |
| `DATABASE_URL`                 | ✅ (preview + production) |
| `DIRECT_URL`                   | ✅ (preview + production) |
| `AUTH_SECRET`                  | ✅                        |
| `JWT_SECRET`                   | ❌ no configurada         |
| `SESSION_SECRET`               | ❌ no configurada         |
| `NEXTAUTH_SECRET`              | ❌ no configurada         |
| `RESEND_API_KEY`               | ❌ no configurada         |
| `R2_ACCOUNT_ID`                | ❌ no configurada         |
| `R2_ACCESS_KEY_ID`             | ❌ no configurada         |
| `R2_SECRET_ACCESS_KEY`         | ❌ no configurada         |
| `R2_BUCKET_NAME` / `R2_BUCKET` | ❌ no configurada         |
| `R2_PUBLIC_URL`                | ❌ no configurada         |
| `AWS_ACCESS_KEY_ID`            | ❌ no configurada         |
| `AWS_SECRET_ACCESS_KEY`        | ❌ no configurada         |
| `AWS_REGION`                   | ❌ no configurada         |
| `REKOGNITION_COLLECTION_ID`    | ❌ no configurada         |
| `MERCADOPAGO_ACCESS_TOKEN`     | ❌ no configurada         |
| `MERCADOPAGO_PUBLIC_KEY`       | ❌ no configurada         |
| `MP_ACCESS_TOKEN`              | ❌ no configurada         |
| `NEXT_PUBLIC_APP_URL`          | ✅                        |
| `NEXT_PUBLIC_BASE_URL`         | ❌ no configurada         |

**Total variables únicas en proyecto:** 10 keys (cada una con entradas preview y/o production).

**Impacto:** uploads (R2), pagos (Mercado Pago), emails (Resend), reconocimiento facial (AWS), y muchas acciones de UI que dependen de esas APIs **no pueden funcionar** en preview hasta configurarlas (fuera de alcance de este diagnóstico).

---

## 3. Base de datos staging (solo lectura)

**Conexión:** Neon staging (misma URL usada en operaciones previas de migrate).  
**Migraciones aplicadas:** 6 (`20260422085720` … `20260428192455_add_evaluaciones_engine`)

### Conteos

| Entidad                     | Count               |
| --------------------------- | ------------------- |
| **Users** (`User`)          | **0**               |
| **Álbumes** (`Album`)       | **0**               |
| **Fotos** (`Photo`)         | **0**               |
| **Blog posts** (`BlogPost`) | **tabla no existe** |
| **Orders** (`Order`)        | **0**               |
| **Schools** (`School`)      | **0**               |

### Schema vs código

| Aspecto                           | Estado                                          |
| --------------------------------- | ----------------------------------------------- |
| Tablas totales en `public`        | 152                                             |
| `BlogPost` / `BlogCategory` en DB | **No existen** (`to_regclass` = `null`)         |
| `BlogPost` en `schema.prisma`     | **Sí** (código monorepo)                        |
| Migraciones SQL con blog          | **Ninguna** en `packages/db/prisma/migrations/` |
| `UserSession`                     | 0 filas                                         |
| `AppConfig`                       | 0 filas                                         |

**Conclusión DB:** staging tiene **esquema parcial** (baseline monorepo sin módulo blog migrado) y **cero datos de negocio**. Los usuarios "existentes" del entorno productivo **no están** en esta base.

---

## 4. Correlación síntoma → causa

```mermaid
flowchart TD
    A[Preview deploy OK - código 79b0712] --> B[DATABASE_URL preview]
    B --> C[Neon staging vacío]
    C --> D[0 álbumes / 0 usuarios]
    D --> E[Home vacío + login falla]

    A --> F[/blog server component]
    F --> G[prisma.blogPost.*]
    G --> H[Tabla BlogPost no existe]
    H --> I[HTTP 500]

    A --> J[UI botones]
    J --> K[Sin R2 / MP / Resend / AWS en env]
    K --> L[Acciones fallan o no-op]
```

---

## 5. Causa más probable (priorizada)

1. **DB staging vacía** — explica home sin álbumes y login imposible con usuarios de producción.
2. **Migraciones blog faltantes** — explica `/blog` 500 (schema drift: modelos en Prisma, tablas no creadas).
3. **Env preview mínimo** — explica botones/features rotos (storage, pagos, email, AWS).
4. **Deployment Protection Vercel** — dificulta probes automatizados; no explica síntomas del usuario autenticado en Vercel.

---

## 6. Próximos pasos (sin ejecutar en esta sesión)

| Prioridad | Acción                                                                                     | Notas                                                                |
| --------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| P0        | **Generar y aplicar migración blog** (`BlogPost`, categorías, tags, etc.) en staging       | Requiere plan de migrate — no ejecutado aquí                         |
| P0        | **Seed o import selectivo** de datos de prueba (usuarios, álbumes públicos) en staging     | Sin tocar producción; dump anonimizado o fixtures                    |
| P1        | **Completar env preview** con R2, MP (sandbox), Resend, AWS según `.env.example`           | Solo nombres auditados; configuración es decisión ops                |
| P1        | **Verificar `AUTH_URL` / `COOKIE_DOMAIN` / `NEXT_PUBLIC_APP_URL`** apuntan al host preview | Valores no leídos; diffs preview/prod ya detectados en staging audit |
| P2        | **Habilitar log drain o tail** en Vercel para capturar errores runtime en próximas pruebas | Logs API devolvió 0                                                  |
| P2        | **Smoke test** tras datos + env: `/`, `/blog`, `/login`, `/api/public/albums`              | Con bypass de Deployment Protection si aplica                        |

**Explícitamente fuera de alcance (por política):** deploy production, DNS, `release_execute`, modificar variables, ejecutar migraciones.

---

## Referencias

- [`compramelafoto-real-preview-validation.md`](./compramelafoto-real-preview-validation.md)
- [`compramelafoto-staging-prisma-migrations-plan.md`](./compramelafoto-staging-prisma-migrations-plan.md)
- Preview: `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK`
- `.env.example`: `apps/compramelafoto/.env.example`
