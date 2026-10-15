# Verificación de punta a punta del portfolio

Las 11 comprobaciones de la §11 de la spec, automatizadas y corriendo contra **Postgres de verdad**,
no contra simulaciones. Es lo que contesta "¿esto funciona de verdad?" sin tocar ninguna base
compartida.

**No corre con `pnpm test`, y eso es a propósito:** la batería normal no puede depender de que haya
una base levantada. Esto se corre a mano.

## Cómo correrla

```bash
# 1. Una base descartable. El nombre importa: el guion se niega a correr contra otra.
psql -h 127.0.0.1 -U "$USER" -d postgres -c "DROP DATABASE IF EXISTS fotoffice_portfolio_e2e"
psql -h 127.0.0.1 -U "$USER" -d postgres -c "CREATE DATABASE fotoffice_portfolio_e2e"

# 2. El esquema, desde el schema (no desde la historia de migraciones, que no se reproduce
#    desde cero — ver el informe de la etapa 1).
cd ../../../packages/db
DATABASE_URL="postgresql://$USER@127.0.0.1:5432/fotoffice_portfolio_e2e" \
DIRECT_URL="postgresql://$USER@127.0.0.1:5432/fotoffice_portfolio_e2e" \
  pnpm exec prisma db push --skip-generate --accept-data-loss

# 3. Los datos de prueba.
cd ../../apps/fotoffice
DATABASE_URL="postgresql://$USER@127.0.0.1:5432/fotoffice_portfolio_e2e" \
DIRECT_URL="postgresql://$USER@127.0.0.1:5432/fotoffice_portfolio_e2e" \
  pnpm exec tsx test/e2e-portfolio/seed.ts

# 4. Las comprobaciones.
DATABASE_URL="postgresql://$USER@127.0.0.1:5432/fotoffice_portfolio_e2e" \
DIRECT_URL="postgresql://$USER@127.0.0.1:5432/fotoffice_portfolio_e2e" \
  pnpm exec vitest run --config vitest.e2e-portfolio.config.ts

# 5. Borrar la base.
psql -h 127.0.0.1 -U "$USER" -d postgres -c "DROP DATABASE fotoffice_portfolio_e2e"
```

El `DATABASE_URL` va **explícito en la línea de comando**: el `.env` de `packages/db` apunta a una
base real de otra plataforma, y confiar en él sería escribir donde no corresponde.

## Qué institución arma el seed

Una sociedad con seis personas, cada una parada en una condición distinta de la regla de
visibilidad, para poder ver las siete en una sola corrida:

| N.º | Quién | Qué prueba |
|---|---|---|
| 100 | Juan Pérez | El caso completo: se ve. Es el que se baja y se restaura |
| 101 | Ana Álvarez | Tiene todo pero no dio el consentimiento |
| 102 | Carlos Benítez | Debe 4 cuotas |
| 103 | Diana Córdoba | Debe 4 cuotas y la institución lo publicó igual |
| 104 | Elena Duarte | Suspendida |
| 105 | Fabián Esquivel | Sin una sola foto |

Las fotos del seed son panorámicas, verticales y cuadradas a propósito: es lo que verifica que la
grilla y el visor aguanten obra real y no sólo cuadrados.

**Las comprobaciones se pisan entre sí** —bajan un portfolio, lo restauran, dan de baja al socio,
apagan el módulo— así que corren en orden y sin paralelismo. Está puesto en la configuración.

## Qué NO cubre

Dos cosas, y conviene tenerlas presentes:

1. **El dibujo en pantalla.** Esto verifica los datos y las reglas, no cómo se ven. Para mirarlo en
   un navegador hay que levantar el servidor contra esta misma base y, además, ponerle contraseña a
   los usuarios del seed, que nacen sin ninguna.
2. **La subida real a R2.** La subida directa necesita credenciales y CORS del bucket, y el bucket
   es compartido con las otras apps del monorepo: no se escribe en él desde una prueba local. Las
   fotos del seed se insertan directo en la base, con direcciones de relleno. El camino de subida
   queda verificado sólo por sus tests unitarios hasta que se haga el encendido.
