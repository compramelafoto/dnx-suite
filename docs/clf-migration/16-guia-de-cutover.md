# 16 — Guía de cutover

Qué falta para migrar, en orden de ejecución. Cada paso dice qué hacer, cómo verificarlo
y cómo volver atrás.

**Rama:** `feat/clf-migracion-monorepo-etapa06`
**Estado al 2026-08-31:** todo lo técnico verificado. Falta ejecutar.

---

## Lo que ya está resuelto y verificado

| | Evidencia |
|--|--|
| Base de datos compatible | migración aplicada sobre copia real: 188 alumnos, 751 usuarios, 240.110 fotos, 854 álbumes, 2.784 órdenes intactos |
| `Student` no se toca | `prisma migrate diff` contra producción: **0 operaciones** sobre esa tabla |
| Legacy sobrevive a la migración | lo único que se borra son 2 objetos que legacy **no conoce** |
| 186 pantallas | todas responden, 0 errores de servidor |
| 89 imágenes rotas | recuperadas y desplegadas |
| Venta de 765 álbumes | restaurada — el mismo álbum vende igual en los dos sitios |
| Login con Google y con contraseña | funcionando |
| Compra completa | 2 pedidos reales: cobro, comisión 15%, correo, ZIP en 0,6s, descarga |
| Reembolso | 2 revertidos, enlaces de descarga eliminados — idéntico a legacy |
| Buscadores | sitio de prueba cerrado a Google |

---

## Lo que falta

### 0. Juntar `main` con la rama

`main` avanzó **11 commits** desde que se abrió la rama (portal del socio, editor).
La rama tiene 16 que `main` no tiene.

```bash
git checkout feat/clf-migracion-monorepo-etapa06
git merge main
pnpm --filter compramelafoto build     # el build completo, no sólo tsc
```

**Hacerlo con tiempo, no el día del cambio.** Si hay conflictos, mejor descubrirlos antes.

---

### 1. Aplicar la migración a producción

**Antes: backup.** Crear una rama Neon de `production` — es instantánea y es el rollback
de datos.

```bash
PROD="<DATABASE_URL de producción>"
prisma migrate diff --from-url "$PROD" \
  --to-schema-datamodel packages/db/prisma/schema.prisma --script > migracion.sql

# arreglo obligatorio: poblar la columna platform en las 5 tablas de blog
sed -i '' "s/ADD COLUMN     \"platform\" TEXT NOT NULL/& DEFAULT 'compramelafoto'/g" migracion.sql

prisma db execute --url "$PROD" --file migracion.sql
```

Corre **dentro de una transacción**: si algo falla, revierte solo y no queda a medias.

**Verificar:** `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`
debe pasar de 213 a ~453. Y `SELECT count(*) FROM "Student"` debe seguir en 188.

---

### 2. Marcar el registro de migraciones al día

```bash
for m in $(ls packages/db/prisma/migrations | grep -E "^[0-9]" | sort); do
  prisma migrate resolve --applied "$m" --schema packages/db/prisma/schema.prisma
done
prisma migrate status   # debe decir "Database schema is up to date!"
```

Algunas van a fallar con "ya está aplicada". Es esperable: son las que comparten nombre
con el historial de legacy.

---

### 3. Cambiar 11 variables en Vercel

Proyecto `compramelafoto-dnxsuite` (`prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He`).

| Variable | De | A |
|--|--|--|
| `DATABASE_URL` | copia | **producción** |
| `DIRECT_URL` | copia | **producción** |
| `APP_URL` | `compramelafoto.dnxsuite.com` | `https://www.compramelafoto.com` |
| `AUTH_URL` | idem | idem |
| `NEXT_PUBLIC_APP_URL` | idem | idem |
| `APP_BASE_URL` | idem | idem |
| `NEXTAUTH_URL` | idem | idem |
| `GOOGLE_REDIRECT_URI` | `…dnxsuite.com/api/auth/google/callback` | `https://www.compramelafoto.com/api/auth/google/callback` |
| `MP_REDIRECT_URI` | `…dnxsuite.com/api/mercadopago/oauth/callback` | `https://www.compramelafoto.com/api/mercadopago/oauth/callback` |
| `COOKIE_DOMAIN` | `.dnxsuite.com` | `.compramelafoto.com` |
| `CLF_ALLOW_SEARCH_INDEXING` | (ausente) | **`true`** |

**Cuidado con `COOKIE_DOMAIN`:** si queda en `.dnxsuite.com`, nadie mantiene la sesión.

**Cuidado con las que se cargan como secretas:** en producción Vercel las guarda
write-only y al leerlas vuelven vacías. Eso **no** significa que estén mal. Para
verificar, desplegar y probar; no confiar en `vercel env pull`.

**No hace falta tocar Google ni Mercado Pago.** Las direcciones de `compramelafoto.com`
ya están registradas — son las que usa legacy hoy.

---

### 4. Desplegar **y promover**

```bash
vercel deploy --prod --yes
vercel promote <deployment-id>
```

**Son dos pasos.** Desplegar no publica: el dominio no se mueve solo. Si ves que subiste
algo y el sitio sigue igual, es esto.

---

### 5. Mover el dominio

Pasar `compramelafoto.com` y `www.compramelafoto.com` del proyecto `compramelafoto` al
proyecto `compramelafoto-dnxsuite`.

**Momento:** horario de poco movimiento. Producción vende de forma constante — el
2026-08-30 hubo pedidos a las 20:55, 21:00, 22:17 y 22:44.

---

### 6. Congelar legacy

Deshabilitar sus crons y sus deploys. Los dos sitios apuntan a la misma base: si legacy
sigue vivo, las tareas automáticas corren dos veces sobre los mismos datos.

**No apagarlo del todo:** es el rollback.

---

### 7. Mirar 24–48 horas

- Que entren ventas y lleguen los avisos de Mercado Pago
- Que salgan los correos
- Que se suban fotos y se generen los ZIP
- Que `robots.txt` diga `Allow: /` (no `Disallow`)

---

## Qué va a notar la gente

**Todos van a tener que volver a iniciar sesión, una vez.** Es inevitable: legacy guarda
la sesión en una galletita del navegador y el monorepo la anota en la base. Las sesiones
viejas no se pueden traducir. Conviene avisarlo antes.

Fuera de eso: mismo dominio, mismas direcciones, mismos datos, mismas fotos. Google no se
entera y no se pierde posicionamiento.

---

## Rollback

Mover el dominio de vuelta al proyecto `compramelafoto`. Legacy sigue funcionando con los
mismos datos porque la migración no rompe nada de lo suyo — verificado.

Se pierden sólo los pedidos hechos en la ventana entre el cambio y la vuelta atrás.

Si además hubiera que revertir los datos, está la rama Neon del paso 1.

---

## Antes de empezar, decidir

1. **Cuándo.** Es lo único que falta definir. Horario de poco movimiento.
2. **Si se avisa el relogin** a fotógrafos y clientes, y cómo.

Después del cutover quedan los pendientes de
[`15-pendientes-post-cutover.md`](15-pendientes-post-cutover.md) — ninguno bloquea.
